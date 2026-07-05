import { randomUUID } from 'crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { BillingService } from '../billing/billing.service'
import { PaymentsService } from '../payments/payments.service'
import { orders, orderLines, orderStatusHistory, stockReservations, inventory, payments, reviews, stores, users } from '../../db/schema'

type OrderStatus = typeof orders.$inferSelect['status']

// Attaches each order's payment (for payment-status/refund badges) via a flat
// second query rather than a join, so callers keep working with Order[]-shaped rows.
async function withPayments<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return rows
  const pays = await db.select().from(payments).where(inArray(payments.orderId, rows.map(r => r.id)))
  const byOrder = new Map(pays.map(p => [p.orderId, p]))
  return rows.map(r => ({ ...r, payment: byOrder.get(r.id) ?? null }))
}

export const OrderingService = {
  async get(orderId: string) {
    // Fetch order and lines in parallel — independent queries
    const [orderResult, lines] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, orderId)),
      db.select().from(orderLines).where(eq(orderLines.orderId, orderId)),
    ])
    const order = orderResult[0]
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
    return { ...order, lines }
  },

  async listByTenant(tenantId: string, status?: string, limit = 20, offset = 0) {
    const conds = [eq(orders.tenantId, tenantId)]
    if (status) conds.push(eq(orders.status, status as OrderStatus))
    const rows = await db.select().from(orders).where(and(...conds))
      .orderBy(desc(orders.placedAt)).limit(limit).offset(offset)
    return withPayments(rows)
  },

  async listByCustomer(customerId: string, limit = 20, offset = 0) {
    const rows = await db.select().from(orders).where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.placedAt)).limit(limit).offset(offset)
    return withPayments(rows)
  },

  /** Admin-wide order + payment view, across every tenant. */
  async listAllForAdmin(paymentStatus?: string, limit = 20, offset = 0) {
    const conds = paymentStatus ? [eq(payments.status, paymentStatus as typeof payments.$inferSelect['status'])] : []
    return db.select({
      order:         orders,
      payment:       payments,
      storeName:     stores.name,
      customerEmail: users.email,
    })
      .from(orders)
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .leftJoin(stores, eq(stores.id, orders.tenantId))
      .leftJoin(users, eq(users.id, orders.customerId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(orders.placedAt))
      .limit(limit).offset(offset)
  },

  async setStatus(orderId: string, status: OrderStatus, actor: string) {
    // Fire both writes in parallel — history insert doesn't depend on the update result
    await Promise.all([
      db.update(orders).set({ status }).where(eq(orders.id, orderId)),
      db.insert(orderStatusHistory).values({ orderId, status, actor }),
    ])
  },

  async cancel(orderId: string, actor: string) {
    return db.transaction(async (tx) => {
      // Fetch the order first to get tenantId (needed for event) and validate
      const [order] = await tx.select({ tenantId: orders.tenantId })
        .from(orders).where(eq(orders.id, orderId))
      if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })

      // Single UPDATE ... FROM to release all reserved inventory in one round-trip
      await tx.execute(
        sql`UPDATE inventory i
            SET reserved = GREATEST(0, i.reserved - sr.qty)
            FROM stock_reservations sr
            WHERE sr.order_id = ${orderId}
              AND i.tenant_id = sr.tenant_id
              AND i.product_id = sr.product_id`
      )

      // Three independent writes — run in parallel inside the transaction
      await Promise.all([
        tx.delete(stockReservations).where(eq(stockReservations.orderId, orderId)),
        tx.update(payments).set({ status: 'voided' }).where(eq(payments.orderId, orderId)),
        tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId)),
      ])
      await tx.insert(orderStatusHistory).values({ orderId, status: 'cancelled', actor })

      emit(Events.OrderCancelled, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId: order.tenantId, payload: { orderId },
      })
    })

    // Outside the transaction — an external Stripe call shouldn't hold the DB lock.
    await PaymentsService.voidIntent(orderId)
  },

  async submitReview(orderId: string, customerId: string, storeRating: number, riderRating?: number, comment?: string) {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customerId), eq(orders.status, 'delivered')))
    if (!order) throw Object.assign(new Error('Not eligible for review'), { statusCode: 400 })
    return db.insert(reviews).values({ tenantId: order.tenantId, orderId, customerId, storeRating, riderRating, comment }).returning()
  },

  async checkIn(orderId: string) {
    const [order] = await db.update(orders)
      .set({ checkedIn: true })
      .where(eq(orders.id, orderId))
      .returning()
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
    emit(Events.CurbsideCheckedIn, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: order.tenantId, payload: { orderId },
    })
    return order
  },

  async handoff(orderId: string, actor: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
    if (order.fulfillmentType !== 'curbside')
      throw Object.assign(new Error('Not a curbside order'), { statusCode: 400 })
    if (order.status !== 'ready')
      throw Object.assign(new Error('Order is not ready'), { statusCode: 400 })

    // Capture payment and update status in parallel
    await Promise.all([
      db.update(payments).set({ status: 'captured' }).where(eq(payments.orderId, orderId)),
      OrderingService.setStatus(orderId, 'delivered', actor),
    ])
    await BillingService.settleCommission(orderId)

    emit(Events.OrderDelivered, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: order.tenantId, payload: { orderId },
    })

    return { ok: true }
  },
}
