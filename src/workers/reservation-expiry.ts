import { eq, sql } from 'drizzle-orm'
import { db } from '../platform/db'
import { orders, orderStatusHistory } from '../db/schema'
import { PaymentsService } from '../modules/payments/payments.service'

const INTERVAL_MS = 60_000 // every minute

async function tick() {
  // Single atomic CTE: delete expired rows and release their inventory in one statement.
  // Replaces the previous N-transaction loop (was: 2 queries × N expired rows).
  // Also surfaces the distinct order ids touched, so an order that never got
  // paid within its reservation window can be cancelled below.
  const result = await db.execute<{ order_id: string }>(sql`
    WITH expired AS (
      DELETE FROM stock_reservations
      WHERE id IN (
        SELECT id FROM stock_reservations WHERE expires_at < NOW() LIMIT 200
      )
      RETURNING tenant_id, product_id, qty, order_id
    ),
    released AS (
      UPDATE inventory i
      SET reserved = GREATEST(0, i.reserved - e.qty)
      FROM expired e
      WHERE i.tenant_id = e.tenant_id
        AND i.product_id = e.product_id
      RETURNING 1
    )
    SELECT DISTINCT order_id FROM expired
  `)

  const orderIds = result.map(r => r.order_id)
  if (orderIds.length > 0) console.log(`[ReservationExpiry] released reservations for ${orderIds.length} order(s)`)

  // An order still pending_payment means the customer never completed
  // checkout within the reservation window — cancel it and release the hold.
  for (const orderId of orderIds) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order || order.status !== 'pending_payment') continue

    await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId))
    await db.insert(orderStatusHistory).values({ orderId, status: 'cancelled', actor: 'system' })
    await PaymentsService.voidIntent(orderId)
  }
}

export function startReservationExpiryWorker(): void {
  const run = () => tick().catch(err => console.error('[ReservationExpiry]', err.message)).finally(() => setTimeout(run, INTERVAL_MS))
  setTimeout(run, INTERVAL_MS)
  console.log('[ReservationExpiry] worker started (1 min interval)')
}
