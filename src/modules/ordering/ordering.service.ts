import { randomUUID } from 'crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { orders, orderLines, orderStatusHistory, stockReservations, inventory, payments, reviews } from '../../db/schema'

type OrderStatus = typeof orders.$inferSelect['status']

export const OrderingService = {
  async get(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId))
    return { ...order, lines }
  },

  async listByTenant(tenantId: string, status?: string, limit = 20, offset = 0) {
    const conds = [eq(orders.tenantId, tenantId)]
    if (status) conds.push(eq(orders.status, status as OrderStatus))
    return db.select().from(orders).where(and(...conds))
      .orderBy(desc(orders.placedAt)).limit(limit).offset(offset)
  },

  async listByCustomer(customerId: string, limit = 20, offset = 0) {
    return db.select().from(orders).where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.placedAt)).limit(limit).offset(offset)
  },

  async setStatus(orderId: string, status: OrderStatus, actor: string) {
    await db.update(orders).set({ status }).where(eq(orders.id, orderId))
    await db.insert(orderStatusHistory).values({ orderId, status, actor })
  },

  async cancel(orderId: string, actor: string) {
    return db.transaction(async (tx) => {
      // Release stock reservations
      const reservations = await tx.select().from(stockReservations).where(eq(stockReservations.orderId, orderId))
      for (const r of reservations) {
        await tx.update(inventory)
          .set({ reserved: sql`${inventory.reserved} - ${r.qty}` })
          .where(and(eq(inventory.tenantId, r.tenantId), eq(inventory.productId, r.productId)))
      }
      await tx.delete(stockReservations).where(eq(stockReservations.orderId, orderId))
      await tx.update(payments).set({ status: 'voided' }).where(eq(payments.orderId, orderId))
      await tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId))
      await tx.insert(orderStatusHistory).values({ orderId, status: 'cancelled', actor })

      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId))
      emit(Events.OrderCancelled, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId: order.tenantId, payload: { orderId },
      })
    })
  },

  async submitReview(orderId: string, customerId: string, storeRating: number, riderRating?: number, comment?: string) {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customerId), eq(orders.status, 'delivered')))
    if (!order) throw Object.assign(new Error('Not eligible for review'), { statusCode: 400 })
    return db.insert(reviews).values({ tenantId: order.tenantId, orderId, customerId, storeRating, riderRating, comment }).returning()
  },
}
