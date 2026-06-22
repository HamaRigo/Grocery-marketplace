import { sql } from 'drizzle-orm'
import { db } from '../platform/db'

const INTERVAL_MS = 60_000 // every minute

async function tick() {
  // Single atomic CTE: delete expired rows and release their inventory in one statement.
  // Replaces the previous N-transaction loop (was: 2 queries × N expired rows).
  const result = await db.execute(sql`
    WITH expired AS (
      DELETE FROM stock_reservations
      WHERE id IN (
        SELECT id FROM stock_reservations WHERE expires_at < NOW() LIMIT 200
      )
      RETURNING tenant_id, product_id, qty
    )
    UPDATE inventory i
    SET reserved = GREATEST(0, i.reserved - e.qty)
    FROM expired e
    WHERE i.tenant_id = e.tenant_id
      AND i.product_id = e.product_id
  `)

  const count = result.length ?? 0
  if (count > 0) console.log(`[ReservationExpiry] released ${count} expired reservation(s)`)
}

export function startReservationExpiryWorker(): void {
  const run = () => tick().catch(err => console.error('[ReservationExpiry]', err.message)).finally(() => setTimeout(run, INTERVAL_MS))
  setTimeout(run, INTERVAL_MS)
  console.log('[ReservationExpiry] worker started (1 min interval)')
}
