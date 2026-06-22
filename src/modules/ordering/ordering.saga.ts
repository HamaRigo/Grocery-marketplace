import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { orders, orderLines, orderStatusHistory, stockReservations, inventory, payments, deliverySlots } from '../../db/schema'
import { SchedulingService } from '../scheduling/scheduling.service'

export interface CheckoutItem {
  productId:  string
  name:       string
  priceMinor: number
  qty:        number
}

export interface CheckoutInput {
  tenantId:        string
  customerId:      string
  currency:        string
  addressGeo:      { lat: number; lng: number; address: string }
  items:           CheckoutItem[]
  scheduledSlotId?: string
}

export interface CurbsideCheckoutInput {
  tenantId:      string
  guestName:     string
  vehicle:       { make: string; model: string; color: string; plate?: string }
  paymentMethod: 'cash' | 'card'
  currency:      string
  items:         CheckoutItem[]
}

export async function checkoutSaga(input: CheckoutInput) {
  const orderId = randomUUID()

  return db.transaction(async (tx) => {
    // 1. Reserve inventory — atomic check-and-update per item (must remain serial for stock safety)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const reservationRows: typeof stockReservations.$inferInsert[] = []

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

      reservationRows.push({
        tenantId: input.tenantId, orderId,
        productId: item.productId, qty: item.qty,
        expiresAt,
      })
    }
    // Batch insert all reservations in a single round-trip
    await tx.insert(stockReservations).values(reservationRows)

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

    // 3. Book delivery slot if requested (outside main tx to avoid lock contention)
    if (input.scheduledSlotId) {
      const booked = await SchedulingService.bookSlot(input.scheduledSlotId)
      if (!booked) throw Object.assign(new Error('Selected delivery slot is full'), { statusCode: 409 })
    }

    // 4. Create order
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
      scheduledSlotId:  input.scheduledSlotId ?? null,
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

export async function curbsideCheckoutSaga(input: CurbsideCheckoutInput) {
  const orderId = randomUUID()

  return db.transaction(async (tx) => {
    // 1. Reserve inventory — must remain serial per item for atomicity
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1-hour window
    const reservationRows: typeof stockReservations.$inferInsert[] = []

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

      reservationRows.push({
        tenantId: input.tenantId, orderId,
        productId: item.productId, qty: item.qty,
        expiresAt,
      })
    }
    await tx.insert(stockReservations).values(reservationRows)

    const subtotal = input.items.reduce((s, i) => s + i.priceMinor * i.qty, 0)

    // 2. Pending payment — collected at car (cash or card terminal)
    await tx.insert(payments).values({
      tenantId:    input.tenantId,
      orderId,
      type:        `curbside_${input.paymentMethod}`,
      amountMinor: subtotal,
      status:      'authorized',
    })

    // 3. Create order (no customerId, no addressGeo)
    const [order] = await tx.insert(orders).values({
      id:              orderId,
      tenantId:        input.tenantId,
      customerId:      null,
      fulfillmentType: 'curbside',
      curbsideName:    input.guestName,
      curbsideVehicle: input.vehicle,
      paymentMethod:   input.paymentMethod,
      status:          'placed',
      subtotalMinor:   subtotal,
      totalMinor:      subtotal,
      currency:        input.currency,
      addressGeo:      null,
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

    await tx.insert(orderStatusHistory).values({ orderId, status: 'placed', actor: 'guest' })

    emit(Events.OrderPlaced, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: input.tenantId, payload: { orderId, customerId: 'guest', totalMinor: subtotal },
    })

    return order
  })
}
