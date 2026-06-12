import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { orders, orderLines, orderStatusHistory, stockReservations, inventory, payments } from '../../db/schema'

export interface CheckoutItem {
  productId:  string
  name:       string
  priceMinor: number
  qty:        number
}

export interface CheckoutInput {
  tenantId:   string
  customerId: string
  currency:   string
  addressGeo: { lat: number; lng: number; address: string }
  items:      CheckoutItem[]
}

export async function checkoutSaga(input: CheckoutInput) {
  const orderId = randomUUID()

  return db.transaction(async (tx) => {
    // 1. Reserve inventory — atomic check-and-update per item
    for (const item of input.items) {
      const updated = await tx.update(inventory)
        .set({ reserved: sql`${inventory.reserved} + ${item.qty}` })
        .where(and(
          eq(inventory.tenantId, input.tenantId),
          eq(inventory.productId, item.productId),
          sql`${inventory.onHand} - ${inventory.reserved} >= ${item.qty}`,
        ))
        .returning()

      if (!updated.length)
        throw Object.assign(new Error(`Insufficient stock: ${item.name}`), { statusCode: 422 })

      await tx.insert(stockReservations).values({
        tenantId: input.tenantId, orderId,
        productId: item.productId, qty: item.qty,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
    }

    // 2. Authorize payment (stub — swap for real gateway call)
    const subtotal    = input.items.reduce((s, i) => s + i.priceMinor * i.qty, 0)
    const deliveryFee = 200 // 2.00 flat for MVP
    const total       = subtotal + deliveryFee

    await tx.insert(payments).values({
      tenantId:    input.tenantId,
      orderId,
      type:        'order',
      gatewayRef:  `stub_auth_${randomUUID()}`,
      amountMinor: total,
      status:      'authorized',
    })

    // 3. Create order
    const [order] = await tx.insert(orders).values({
      id:               orderId,
      tenantId:         input.tenantId,
      customerId:       input.customerId,
      status:           'placed',
      subtotalMinor:    subtotal,
      deliveryFeeMinor: deliveryFee,
      totalMinor:       total,
      currency:         input.currency,
      addressGeo:       input.addressGeo,
    }).returning()

    await tx.insert(orderLines).values(
      input.items.map(i => ({
        orderId,
        productId:      i.productId,
        nameSnapshot:   i.name,
        unitPriceMinor: i.priceMinor,
        qty:            i.qty,
      }))
    )

    await tx.insert(orderStatusHistory).values({ orderId, status: 'placed', actor: 'customer' })

    emit(Events.OrderPlaced, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: input.tenantId, payload: { orderId, customerId: input.customerId, totalMinor: total },
    })

    return order
  })
}
