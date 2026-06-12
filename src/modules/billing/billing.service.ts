import { randomUUID } from 'crypto'
import { and, between, eq, isNull } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { commissionSettlements, subscriptions, stores, orders, payments } from '../../db/schema'

const PLANS = {
  free:     { amountMinor: 0,    currency: 'USD' },
  standard: { amountMinor: 1000, currency: 'USD' }, // $10 / month
  premium:  { amountMinor: 2500, currency: 'USD' }, // $25 / month
} as const

export const BillingService = {
  // ── Commission ────────────────────────────────────────────────────────────

  async settleCommission(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order) return null
    const [store] = await db.select().from(stores).where(eq(stores.id, order.tenantId))
    if (!store) return null

    const amountMinor = Math.round(order.totalMinor * store.commissionBps / 10_000)
    const [settlement] = await db.insert(commissionSettlements).values({
      tenantId: order.tenantId, orderId,
      orderTotalMinor: order.totalMinor,
      commissionBps:   store.commissionBps,
      amountMinor,
    }).returning()

    emit(Events.CommissionSettled, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: order.tenantId,
      payload: { settlementId: settlement.id, orderId, amountMinor },
    })
    return settlement
  },

  async listSettlements(tenantId?: string, from?: string, to?: string) {
    const conds: any[] = []
    if (tenantId) conds.push(eq(commissionSettlements.tenantId, tenantId))
    if (from && to)  conds.push(between(commissionSettlements.settledAt, new Date(from), new Date(to)))
    return db.select().from(commissionSettlements)
      .where(conds.length ? and(...conds) : undefined)
  },

  async markSettlementPaid(settlementId: string) {
    const [s] = await db.update(commissionSettlements)
      .set({ paidAt: new Date() })
      .where(eq(commissionSettlements.id, settlementId))
      .returning()
    return s
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async getSubscription(tenantId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId))
    return sub ?? null
  },

  async upsertSubscription(tenantId: string, plan: keyof typeof PLANS) {
    const { amountMinor, currency } = PLANS[plan]
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

    const existing = await BillingService.getSubscription(tenantId)
    if (existing) {
      const [sub] = await db.update(subscriptions)
        .set({ plan, amountMinor, status: 'active', currentPeriodEnd })
        .where(eq(subscriptions.tenantId, tenantId)).returning()
      return sub
    }
    const [sub] = await db.insert(subscriptions)
      .values({ tenantId, plan, amountMinor, currency, status: 'active', currentPeriodEnd })
      .returning()
    return sub
  },

  async chargeSubscription(tenantId: string) {
    const sub = await BillingService.getSubscription(tenantId)
    if (!sub || sub.amountMinor === 0) return { message: 'Free tier — no charge' }

    // Stub: swap for real gateway call
    const [payment] = await db.insert(payments).values({
      tenantId, type: 'subscription',
      gatewayRef: `stub_sub_${randomUUID()}`,
      amountMinor: sub.amountMinor,
      status: 'captured',
    }).returning()

    const nextPeriodEnd = new Date(sub.currentPeriodEnd ?? new Date())
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
    await db.update(subscriptions)
      .set({ status: 'active', currentPeriodEnd: nextPeriodEnd })
      .where(eq(subscriptions.tenantId, tenantId))

    emit(Events.SubscriptionPaymentSucceeded, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId, payload: { tenantId, amountMinor: sub.amountMinor },
    })
    return payment
  },

  async cancelSubscription(tenantId: string) {
    const [sub] = await db.update(subscriptions)
      .set({ status: 'cancelled' })
      .where(eq(subscriptions.tenantId, tenantId))
      .returning()
    emit(Events.SubscriptionPaymentFailed, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId, payload: { tenantId },
    })
    return sub
  },

  // ── Refund ────────────────────────────────────────────────────────────────

  async refund(orderId: string) {
    const [payment] = await db.select().from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'captured')))
    if (!payment) throw Object.assign(new Error('No captured payment to refund'), { statusCode: 400 })

    const [updated] = await db.update(payments)
      .set({ status: 'refunded' }).where(eq(payments.id, payment.id)).returning()

    emit(Events.PaymentRefunded, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: payment.tenantId, payload: { orderId, amountMinor: payment.amountMinor },
    })
    return updated
  },
}
