import { randomUUID } from 'crypto'
import { and, between, eq, isNull } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { stripe } from '../payments/payments.service'
import { commissionSettlements, subscriptions, stores, orders, payments, refunds } from '../../db/schema'

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

  // ── Refund ────────────────────────────────────────────────────────────────

  /** Full refund when amountMinor is omitted, partial otherwise. */
  async refund(orderId: string, amountMinor: number | undefined, actor: string | undefined) {
    const [payment] = await db.select().from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'captured')))
    if (!payment) throw Object.assign(new Error('No captured payment to refund'), { statusCode: 400 })

    const remaining = payment.amountMinor - payment.refundedMinor
    const refundAmount = amountMinor ?? remaining
    if (refundAmount <= 0 || refundAmount > remaining)
      throw Object.assign(new Error(`Refund amount must be between 1 and ${remaining} minor units`), { statusCode: 400 })

    let stripeRefundId: string | undefined
    if (payment.provider === 'stripe' && payment.stripePaymentIntentId) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmount,
      }, { idempotencyKey: `refund-${payment.id}-${payment.refundedMinor}-${refundAmount}` })
      stripeRefundId = refund.id
    }
    // Non-Stripe payments (cash/curbside) have no gateway to call — the refund
    // is handed back to the customer in person; we just record it below.

    const newRefundedMinor = payment.refundedMinor + refundAmount
    const fullyRefunded = newRefundedMinor >= payment.amountMinor

    const [updated] = await db.update(payments)
      .set({ status: fullyRefunded ? 'refunded' : 'partially_refunded', refundedMinor: newRefundedMinor })
      .where(eq(payments.id, payment.id)).returning()

    await db.insert(refunds).values({
      paymentId: payment.id, stripeRefundId, amountMinor: refundAmount, actor,
    })

    // A full refund on an already-settled order reverses the commission via an
    // offsetting ledger entry rather than rewriting settlement history.
    if (fullyRefunded) {
      const [settlement] = await db.select().from(commissionSettlements).where(eq(commissionSettlements.orderId, orderId))
      if (settlement && settlement.amountMinor > 0) {
        await db.insert(commissionSettlements).values({
          tenantId: settlement.tenantId, orderId,
          orderTotalMinor: -settlement.orderTotalMinor,
          commissionBps:   settlement.commissionBps,
          amountMinor:     -settlement.amountMinor,
        })
      }
    }

    emit(Events.PaymentRefunded, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: payment.tenantId, payload: { orderId, amountMinor: refundAmount },
    })
    return updated
  },
}
