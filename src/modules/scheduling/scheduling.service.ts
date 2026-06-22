import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { deliverySlots } from '../../db/schema'

export const SchedulingService = {
  async listSlots(tenantId: string, date: string) {
    return db.select().from(deliverySlots)
      .where(and(eq(deliverySlots.tenantId, tenantId), eq(deliverySlots.date, date)))
      .orderBy(deliverySlots.startTime)
  },

  async createSlot(tenantId: string, date: string, startTime: string, endTime: string, capacity: number) {
    const [slot] = await db.insert(deliverySlots)
      .values({ tenantId, date, startTime, endTime, capacity })
      .returning()
    return slot
  },

  async bookSlot(slotId: string): Promise<boolean> {
    const result = await db.update(deliverySlots)
      .set({ bookedCount: sql`${deliverySlots.bookedCount} + 1` })
      .where(
        and(
          eq(deliverySlots.id, slotId),
          sql`${deliverySlots.bookedCount} < ${deliverySlots.capacity}`,
        )
      )
      .returning({ id: deliverySlots.id })
    return result.length > 0
  },
}
