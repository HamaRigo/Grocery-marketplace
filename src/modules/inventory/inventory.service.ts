import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { inventory } from '../../db/schema'
import { randomUUID } from 'crypto'

export const InventoryService = {
  async get(tenantId: string, productId: string) {
    const [row] = await db.select().from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.productId, productId)))
    return row
  },

  async listByTenant(tenantId: string) {
    return db.select().from(inventory).where(eq(inventory.tenantId, tenantId))
  },

  async setStock(tenantId: string, productId: string, onHand: number) {
    const existing = await InventoryService.get(tenantId, productId)
    if (existing) {
      return db.update(inventory).set({ onHand }).where(eq(inventory.id, existing.id)).returning()
    }
    return db.insert(inventory).values({ tenantId, productId, onHand, reserved: 0 }).returning()
  },

  async adjustStock(tenantId: string, productId: string, delta: number) {
    await db.update(inventory)
      .set({ onHand: sql`${inventory.onHand} + ${delta}` })
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.productId, productId)))
    const row = await InventoryService.get(tenantId, productId)
    if (row && row.onHand - row.reserved <= 0) {
      emit(Events.OutOfStock, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: { productId } })
    }
  },
}
