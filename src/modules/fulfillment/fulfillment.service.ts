import { randomUUID } from 'crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { deliveryJobs, riders, stores, payments, reviews } from '../../db/schema'

export const FulfillmentService = {
  async createJob(tenantId: string, orderId: string) {
    const [job] = await db.insert(deliveryJobs).values({ tenantId, orderId, status: 'pending' }).returning()
    await FulfillmentService.dispatch(job.id, tenantId)
    return job
  },

  async dispatch(jobId: string, tenantId: string) {
    const [store] = await db.select().from(stores).where(eq(stores.id, tenantId))
    if (!store) return

    // Rank available riders by avg rating (higher is better; unrated defaults to 5.0)
    const ratingSubq = db.select({
      riderId:   deliveryJobs.riderId,
      avgRating: sql<number>`coalesce(avg(${reviews.riderRating}), 5)`.as('avg_rating'),
    })
    .from(deliveryJobs)
    .leftJoin(reviews, eq(reviews.orderId, deliveryJobs.orderId))
    .where(sql`${deliveryJobs.riderId} is not null`)
    .groupBy(deliveryJobs.riderId)
    .as('ratings')

    const rankedRiders = (cond: any) =>
      db.select({ id: riders.id })
        .from(riders)
        .leftJoin(ratingSubq, sql`ratings.rider_id = ${riders.id}`)
        .where(cond)
        .orderBy(sql`coalesce(ratings.avg_rating, 5) desc`)
        .limit(1)

    let rider: { id: string } | null = null

    if (store.dispatchPolicy !== 'POOL_ONLY') {
      const [own] = await rankedRiders(and(eq(riders.ownedByTenantId, tenantId), eq(riders.status, 'online')))
      rider = own ?? null
    }

    if (!rider && store.dispatchPolicy !== 'OWN_ONLY') {
      const [pool] = await rankedRiders(and(isNull(riders.ownedByTenantId), eq(riders.status, 'online')))
      rider = pool ?? null
    }

    if (!rider) { console.warn(`[Dispatch] No rider for job ${jobId}`); return }

    await db.update(deliveryJobs)
      .set({ riderId: rider.id, status: 'assigned', assignedAt: new Date() })
      .where(eq(deliveryJobs.id, jobId))
    await db.update(riders).set({ status: 'busy' }).where(eq(riders.id, rider.id))

    const [job] = await db.select().from(deliveryJobs).where(eq(deliveryJobs.id, jobId))
    emit(Events.OrderAssigned, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId, payload: { orderId: job.orderId, riderId: rider.id },
    })
  },

  async confirmPickup(jobId: string) {
    await db.update(deliveryJobs).set({ status: 'picked_up', pickedUpAt: new Date() }).where(eq(deliveryJobs.id, jobId))
    const [job] = await db.select().from(deliveryJobs).where(eq(deliveryJobs.id, jobId))
    emit(Events.OrderPickedUp, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: job.tenantId, payload: { orderId: job.orderId },
    })
  },

  async confirmDelivery(jobId: string) {
    await db.update(deliveryJobs).set({ status: 'delivered', deliveredAt: new Date() }).where(eq(deliveryJobs.id, jobId))
    const [job] = await db.select().from(deliveryJobs).where(eq(deliveryJobs.id, jobId))
    if (job.riderId) await db.update(riders).set({ status: 'online' }).where(eq(riders.id, job.riderId))
    // Capture payment (stub)
    await db.update(payments).set({ status: 'captured' }).where(eq(payments.orderId, job.orderId))
    emit(Events.OrderDelivered, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: job.tenantId, payload: { orderId: job.orderId },
    })
  },

  async setAvailability(riderId: string, status: 'online' | 'offline') {
    return db.update(riders).set({ status }).where(eq(riders.id, riderId)).returning()
  },

  async listJobs(riderId: string) {
    return db.select().from(deliveryJobs).where(eq(deliveryJobs.riderId, riderId))
  },

  async listRiders(tenantId?: string) {
    if (tenantId) return db.select().from(riders).where(eq(riders.ownedByTenantId, tenantId))
    return db.select().from(riders).where(isNull(riders.ownedByTenantId))
  },

  async addRider(userId: string, tenantId: string | null, vehicle: string) {
    const [r] = await db.insert(riders).values({ userId, ownedByTenantId: tenantId, vehicle, status: 'offline' }).returning()
    return r
  },

  async getRiderByUserId(userId: string) {
    const [rider] = await db.select().from(riders).where(eq(riders.userId, userId))
    return rider ?? null
  },
}
