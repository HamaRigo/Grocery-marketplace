import { randomUUID } from 'crypto'
import { eq, and, like } from 'drizzle-orm'
import { db } from '../../platform/db'
import { redis } from '../../platform/redis'
import { emit, Events } from '../../platform/events'
import { products, categories } from '../../db/schema'

const CACHE_TTL = 300 // 5 min

export const CatalogService = {
  async listProducts(tenantId: string, search?: string) {
    if (!search) {
      const cached = await redis.get(`catalog:${tenantId}`)
      if (cached) return JSON.parse(cached)
    }
    const conditions = [eq(products.tenantId, tenantId), eq(products.status, 'active')]
    if (search) conditions.push(like(products.name, `%${search}%`))
    const rows = await db.select().from(products).where(and(...conditions))
    if (!search) await redis.setex(`catalog:${tenantId}`, CACHE_TTL, JSON.stringify(rows))
    return rows
  },

  async createProduct(tenantId: string, data: typeof products.$inferInsert) {
    const [p] = await db.insert(products).values({ ...data, tenantId }).returning()
    await redis.del(`catalog:${tenantId}`)
    emit(Events.ProductUpdated, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: p })
    return p
  },

  async updateProduct(tenantId: string, productId: string, data: Partial<typeof products.$inferInsert>) {
    const [p] = await db.update(products)
      .set(data).where(and(eq(products.id, productId), eq(products.tenantId, tenantId))).returning()
    await redis.del(`catalog:${tenantId}`)
    if (data.priceMinor) emit(Events.PriceChanged, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: { productId, priceMinor: data.priceMinor } })
    else emit(Events.ProductUpdated, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: p })
    return p
  },

  async delistProduct(tenantId: string, productId: string) {
    await db.update(products)
      .set({ status: 'delisted' }).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    await redis.del(`catalog:${tenantId}`)
  },

  async listCategories(tenantId: string) {
    return db.select().from(categories).where(eq(categories.tenantId, tenantId))
  },

  async createCategory(tenantId: string, name: string, parentId?: string) {
    const [c] = await db.insert(categories).values({ tenantId, name, parentId }).returning()
    return c
  },
}
