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

  async setStock(tenantId: string, productId: string, onHand: number, lowStockThreshold?: number) {
    const existing = await InventoryService.get(tenantId, productId)
    const data: any = { onHand }
    if (lowStockThreshold !== undefined) data.lowStockThreshold = lowStockThreshold
    if (existing) {
      const [row] = await db.update(inventory).set(data).where(eq(inventory.id, existing.id)).returning()
      InventoryService._checkAlerts(row, tenantId, productId)
      return [row]
    }
    return db.insert(inventory).values({ tenantId, productId, onHand, reserved: 0, lowStockThreshold }).returning()
  },

  async adjustStock(tenantId: string, productId: string, delta: number) {
    const [row] = await db.update(inventory)
      .set({ onHand: sql`${inventory.onHand} + ${delta}` })
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.productId, productId)))
      .returning()
    if (row) InventoryService._checkAlerts(row, tenantId, productId)
  },

  _checkAlerts(row: typeof inventory.$inferSelect, tenantId: string, productId: string) {
    const available = row.onHand - row.reserved
    if (available <= 0) {
      emit(Events.OutOfStock, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: { productId } })
    } else if (row.lowStockThreshold != null && available <= row.lowStockThreshold) {
      emit(Events.LowStock, { eventId: randomUUID(), occurredAt: new Date().toISOString(), tenantId, payload: { productId, available } })
    }
  },
}
