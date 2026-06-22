import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { stores, serviceAreas, storeHours, userRoles } from '../../db/schema'

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
      .set({ status: 'active' }).where(eq(stores.id, storeId)).returning()
    emit(Events.StoreApproved, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: storeId, payload: { storeId },
    })
    return store
  },

  async suspend(storeId: string) {
    const [store] = await db.update(stores)
      .set({ status: 'suspended' }).where(eq(stores.id, storeId)).returning()
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
}
