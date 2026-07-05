import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { stores, serviceAreas, storeHours, userRoles, subscriptions } from '../../db/schema'

const GRACE_DAYS = 15 // days a store may keep selling after its subscription first goes past-due

// Pure gating decision — extracted so it can be unit-tested without a DB.
export function canSellWithSubscription(status: string, graceUntil: Date | null, now: Date): boolean {
  const withinGrace = status === 'past_due' && graceUntil != null && now <= graceUntil
  return status === 'trialing' || status === 'active' || withinGrace
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const d = (a: number, b: number) => (b - a) * Math.PI / 180
  const a = Math.sin(d(lat1, lat2) / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(d(lng1, lng2) / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const TenantService = {
  async onboard(name: string, managerId: string) {
    const [store] = await db.insert(stores).values({ name }).returning()
    await db.insert(userRoles).values({ userId: managerId, role: 'manager', tenantId: store.id })
    return store
  },

  async approve(storeId: string) {
    const [store] = await db.update(stores)
      .set({ status: 'active', suspendedReason: null }).where(eq(stores.id, storeId)).returning()

    // First-ever approval starts a 30-day free trial — no Stripe subscription
    // needed until the store owner picks a paid plan (see subscriptions.service.ts).
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)
    await db.insert(subscriptions)
      .values({ tenantId: storeId, plan: 'free', status: 'trialing', amountMinor: 0, currentPeriodEnd: trialEnd })
      .onConflictDoNothing({ target: subscriptions.tenantId })

    emit(Events.StoreApproved, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: storeId, payload: { storeId },
    })
    return store
  },

  async suspend(storeId: string) {
    const [store] = await db.update(stores)
      .set({ status: 'suspended', suspendedReason: 'admin' }).where(eq(stores.id, storeId)).returning()
    emit(Events.StoreSuspended, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId: storeId, payload: { storeId } })
    return store
  },

  async updateProfile(storeId: string, data: Partial<{ name: string; logoUrl: string; dispatchPolicy: string; escalationTimeoutS: number }>) {
    const [store] = await db.update(stores).set(data as any).where(eq(stores.id, storeId)).returning()
    emit(Events.StoreProfileUpdated, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId: storeId, payload: data })
    return store
  },

  async setServiceArea(storeId: string, lat: number, lng: number, radiusKm: number) {
    await db.delete(serviceAreas).where(eq(serviceAreas.tenantId, storeId))
    return db.insert(serviceAreas).values({ tenantId: storeId, geoData: { lat, lng, radiusKm } }).returning()
  },

  async findNearby(lat: number, lng: number) {
    const active = await db.select().from(stores).where(eq(stores.status, 'active'))
    const areas  = await db.select().from(serviceAreas)
    const areaMap = Object.fromEntries(areas.map(a => [a.tenantId, a.geoData as any]))
    return active.filter(s => {
      const area = areaMap[s.id]
      if (!area) return false
      return haversineKm(lat, lng, area.lat, area.lng) <= area.radiusKm
    })
  },

  async get(storeId: string) {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId))
    return store
  },

  async updateCommission(storeId: string, commissionBps: number) {
    const [store] = await db.update(stores)
      .set({ commissionBps })
      .where(eq(stores.id, storeId))
      .returning()
    return store
  },

  /** Throws unless this store is approved and its subscription is in good standing. */
  async assertCanSell(storeId: string) {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId))
    if (!store) throw Object.assign(new Error('Store not found'), { statusCode: 404 })
    if (store.status !== 'active')
      throw Object.assign(new Error('This store is not currently accepting orders'), { statusCode: 403 })

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, storeId))
    if (!sub) return // no subscription row yet — don't block sales over a data gap

    const now = new Date()
    let status = sub.status
    let graceUntil = sub.graceUntil

    // Free trial month elapsed with no paid subscription ever started —
    // begin the grace clock the first time this is detected.
    if (status === 'trialing' && sub.currentPeriodEnd && now > sub.currentPeriodEnd && !graceUntil) {
      graceUntil = new Date(sub.currentPeriodEnd)
      graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS)
      status = 'past_due'
      await db.update(subscriptions).set({ status, graceUntil }).where(eq(subscriptions.tenantId, storeId))
    }

    if (canSellWithSubscription(status, graceUntil, now)) return

    // Grace has fully expired, or Stripe reports the subscription unpaid/cancelled.
    await db.update(stores).set({ status: 'suspended', suspendedReason: 'billing' }).where(eq(stores.id, storeId))
    throw Object.assign(new Error("This store's subscription payment is overdue"), { statusCode: 403 })
  },
}
