import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '../platform/db'
import { stockReservations, inventory } from '../db/schema'

const INTERVAL_MS = 60_000 // every minute

async function tick() {
  const expired = await db.select().from(stockReservations)
    .where(lt(stockReservations.expiresAt, new Date()))
    .limit(200)

  if (!expired.length) return

  for (const r of expired) {
    await db.transaction(async (tx) => {
      await tx.update(inventory)
        .set({ reserved: sql`greatest(0, ${inventory.reserved} - ${r.qty})` })
        .where(and(eq(inventory.tenantId, r.tenantId), eq(inventory.productId, r.productId)))
      await tx.delete(stockReservations).where(eq(stockReservations.id, r.id))
    }).catch(err => console.error('[ReservationExpiry] tx error:', err.message))
  }

  console.log(`[ReservationExpiry] released ${expired.length} expired reservation(s)`)
}

export function startReservationExpiryWorker(): void {
  const run = () => tick().catch(err => console.error('[ReservationExpiry]', err.message)).finally(() => setTimeout(run, INTERVAL_MS))
  setTimeout(run, INTERVAL_MS)
  console.log('[ReservationExpiry] worker started (1 min interval)')
}
