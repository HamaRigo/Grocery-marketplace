import { and, between, count, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { orders, payments, stores, users, commissionSettlements, reviews, deliveryJobs, riders, orderStatusHistory } from '../../db/schema'

export const ReportingService = {
  async overview() {
    const [orderStats] = await db.select({
      total:     count(orders.id),
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
      active:    sql<number>`count(*) filter (where ${orders.status} not in ('delivered','cancelled','rejected'))`,
    }).from(orders)

    const [revenueStats] = await db.select({
      totalRevenue: sql<number>`coalesce(sum(${payments.amountMinor}), 0)`,
    }).from(payments).where(eq(payments.status, 'captured'))

    const [commissionStats] = await db.select({
      totalEarned: sql<number>`coalesce(sum(${commissionSettlements.amountMinor}), 0)`,
      unpaid:      sql<number>`coalesce(sum(${commissionSettlements.amountMinor}) filter (where ${commissionSettlements.paidAt} is null), 0)`,
    }).from(commissionSettlements)

    const [storeStats] = await db.select({
      total:  count(stores.id),
      active: sql<number>`count(*) filter (where ${stores.status} = 'active')`,
    }).from(stores)

    const [userStats] = await db.select({ total: count(users.id) }).from(users)

    return {
      orders:     orderStats,
      revenue:    revenueStats,
      commission: commissionStats,
      stores:     storeStats,
      users:      userStats,
    }
  },

  // Store breakdown with store name joined
  async storeBreakdown() {
    return db.select({
      tenantId:     orders.tenantId,
      storeName:    stores.name,
      orderCount:   count(orders.id),
      totalRevenue: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
      avgOrderSize: sql<number>`round(avg(${orders.totalMinor}), 0)`,
    })
    .from(orders)
    .leftJoin(stores, eq(stores.id, orders.tenantId))
    .where(eq(orders.status, 'delivered'))
    .groupBy(orders.tenantId, stores.name)
    .orderBy(sql`count(*) desc`)
  },

  async storeRatings(tenantId: string) {
    const [r] = await db.select({
      avgStore: sql<number>`round(avg(${reviews.storeRating}), 2)`,
      avgRider: sql<number>`round(avg(${reviews.riderRating}), 2)`,
      total:    count(reviews.id),
    }).from(reviews).where(eq(reviews.tenantId, tenantId))
    return r
  },

  async revenueOverTime(from: string, to: string) {
    return db.select({
      day:        sql<string>`date_trunc('day', ${orders.placedAt})`,
      orderCount: count(orders.id),
      revenue:    sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
    })
    .from(orders)
    .where(and(
      eq(orders.status, 'delivered'),
      between(orders.placedAt, new Date(from), new Date(to)),
    ))
    .groupBy(sql`date_trunc('day', ${orders.placedAt})`)
    .orderBy(sql`date_trunc('day', ${orders.placedAt})`)
  },

  // Average minutes between 'accepted' and 'ready' status transitions
  async avgPrepTimeMinutes(tenantId?: string) {
    const acceptedHistory = db.select({
      orderId: orderStatusHistory.orderId,
      at:      orderStatusHistory.at,
    }).from(orderStatusHistory).where(eq(orderStatusHistory.status, 'accepted')).as('accepted_h')

    const readyHistory = db.select({
      orderId: orderStatusHistory.orderId,
      at:      orderStatusHistory.at,
    }).from(orderStatusHistory).where(eq(orderStatusHistory.status, 'ready')).as('ready_h')

    const conds = tenantId
      ? sql`accepted_h.order_id = ready_h.order_id AND o.tenant_id = ${tenantId}`
      : sql`accepted_h.order_id = ready_h.order_id`

    const [r] = await db.execute(sql`
      SELECT round(avg(extract(epoch from (rh.at - ah.at)) / 60), 1) AS avg_minutes,
             count(*) AS sample_count
      FROM order_status_history ah
      JOIN order_status_history rh ON rh.order_id = ah.order_id AND rh.status = 'ready'
      JOIN orders o ON o.id = ah.order_id
      WHERE ah.status = 'accepted'
        ${tenantId ? sql`AND o.tenant_id = ${tenantId}` : sql``}
    `)
    return r as { avg_minutes: number; sample_count: number }
  },

  // Delivery stats per rider: count + earnings (flat rate configurable via env)
  async riderEarnings(riderId: string, days = 7) {
    const since = new Date(Date.now() - days * 86400_000)
    const [r] = await db.select({
      deliveries: sql<number>`count(*)`,
      totalMinor: sql<number>`coalesce(sum(p.amount_minor), 0)`,
    })
    .from(deliveryJobs)
    .leftJoin(payments, and(eq(payments.orderId, deliveryJobs.orderId), eq(payments.status, 'captured')))
    .where(and(
      eq(deliveryJobs.riderId, riderId),
      eq(deliveryJobs.status, 'delivered'),
      sql`${deliveryJobs.deliveredAt} >= ${since}`,
    ))
    return { ...r, days }
  },
}
