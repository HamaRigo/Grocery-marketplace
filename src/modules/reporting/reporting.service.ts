import { and, between, count, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { orders, payments, stores, users, commissionSettlements, reviews } from '../../db/schema'

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

  async storeBreakdown() {
    return db.select({
      tenantId:     orders.tenantId,
      orderCount:   count(orders.id),
      totalRevenue: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
      avgOrderSize: sql<number>`round(avg(${orders.totalMinor}), 0)`,
    })
    .from(orders)
    .where(eq(orders.status, 'delivered'))
    .groupBy(orders.tenantId)
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
}
