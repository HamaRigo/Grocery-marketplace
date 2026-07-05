import Stripe from 'stripe'
import { randomUUID } from 'crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import {
  orders, orderLines, orderStatusHistory, payments, products,
  webhookEvents, stockReservations, inventory,
} from '../../db/schema'

// Constructed lazily so importing this module (e.g. transitively, from a unit
// test that never touches Stripe) doesn't require STRIPE_SECRET_KEY to be set.
let _stripe: Stripe | undefined
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    return Reflect.get(_stripe, prop)
  },
})

// Pure — extracted so "tampered cart price rejected" is unit-testable without a DB.
export function recomputeOrderAmount(
  lines: { productId: string; qty: number }[],
  priceByProductId: Map<string, number>,
  deliveryFeeMinor: number,
): number {
  let subtotal = 0
  for (const line of lines) {
    const currentPrice = priceByProductId.get(line.productId)
    if (currentPrice == null)
      throw Object.assign(new Error('A product in this order is no longer available'), { statusCode: 409 })
    subtotal += currentPrice * line.qty
  }
  return subtotal + deliveryFeeMinor
}

// Pure — the idempotent state guard: a payment_intent.succeeded/.payment_failed
// event only ever applies to an order still actually awaiting payment.
export function canTransitionOnPaymentEvent(orderStatus: string): boolean {
  return orderStatus === 'pending_payment'
}

export function isFullyRefunded(amountRefundedMinor: number, amountMinor: number): boolean {
  return amountRefundedMinor >= amountMinor
}

export const PaymentsService = {
  async createIntentForOrder(orderId: string, customerId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
    if (order.customerId !== customerId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    if (order.status !== 'pending_payment')
      throw Object.assign(new Error('Order is not awaiting payment'), { statusCode: 400 })

    // Recompute the charge from current product prices — never trust the
    // order's stored totalMinor, which was derived from client-supplied cart prices.
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId))
    const productIds = lines.map(l => l.productId)
    const currentProducts = productIds.length
      ? await db.select().from(products).where(inArray(products.id, productIds))
      : []
    const priceById = new Map(currentProducts.map(p => [p.id, p.priceMinor]))

    const amountMinor = recomputeOrderAmount(lines, priceById, order.deliveryFeeMinor)

    const [existing] = await db.select().from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')))

    let intent: Stripe.PaymentIntent
    if (existing?.stripePaymentIntentId) {
      intent = await stripe.paymentIntents.update(existing.stripePaymentIntentId, { amount: amountMinor })
      await db.update(payments).set({ amountMinor }).where(eq(payments.id, existing.id))
    } else {
      intent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: order.currency.toLowerCase(),
        metadata: { orderId: order.id, tenantId: order.tenantId },
      }, { idempotencyKey: `order-${orderId}` })

      await db.insert(payments).values({
        tenantId: order.tenantId, orderId, type: 'order',
        provider: 'stripe', stripePaymentIntentId: intent.id,
        amountMinor, currency: order.currency, status: 'pending',
      })
    }

    return { clientSecret: intent.client_secret }
  },

  /** Cancel the pending PaymentIntent for an order, e.g. when the order itself is cancelled. */
  async voidIntent(orderId: string) {
    const [payment] = await db.select().from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')))
    if (!payment?.stripePaymentIntentId) return
    try {
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    } catch {
      // Already succeeded or canceled on Stripe's side — nothing to reconcile.
    }
  },

  /** Verify, dedupe, and dispatch an incoming Stripe webhook delivery. */
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)

    // Idempotency ledger: a retried delivery of an already-seen event id is a no-op.
    const [inserted] = await db.insert(webhookEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning()
    if (!inserted) return

    if (event.type.startsWith('payment_intent.') || event.type === 'charge.refunded') {
      await handleOrderPaymentEvent(event)
    } else if (event.type.startsWith('customer.subscription.') || event.type.startsWith('invoice.')) {
      const { SubscriptionsService } = await import('../billing/subscriptions.service')
      await SubscriptionsService.handleSubscriptionEvent(event)
    }
  },
}

async function handleOrderPaymentEvent(event: Stripe.Event) {
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId
    if (!orderId) return

    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update')
      if (!order || !canTransitionOnPaymentEvent(order.status)) return // already handled, or no longer awaiting payment

      await tx.update(payments)
        .set({ status: 'captured' })
        .where(eq(payments.stripePaymentIntentId, intent.id))
      await tx.update(orders).set({ status: 'placed' }).where(eq(orders.id, orderId))
      await tx.insert(orderStatusHistory).values({ orderId, status: 'placed', actor: 'stripe' })

      emit(Events.PaymentCaptured, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId: order.tenantId, payload: { orderId, amountMinor: intent.amount },
      })
      emit(Events.OrderPlaced, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId: order.tenantId, payload: { orderId, customerId: order.customerId, totalMinor: order.totalMinor },
      })
    })
    return
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId
    if (!orderId) return

    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update')
      if (!order || !canTransitionOnPaymentEvent(order.status)) return

      await tx.update(payments).set({ status: 'failed' }).where(eq(payments.stripePaymentIntentId, intent.id))
      await tx.update(orders).set({ status: 'payment_failed' }).where(eq(orders.id, orderId))
      await tx.insert(orderStatusHistory).values({ orderId, status: 'payment_failed', actor: 'stripe' })

      // Release the inventory reservation held since checkout — same pattern as OrderingService.cancel.
      await tx.execute(sql`
        UPDATE inventory i
        SET reserved = GREATEST(0, i.reserved - sr.qty)
        FROM stock_reservations sr
        WHERE sr.order_id = ${orderId}
          AND i.tenant_id = sr.tenant_id
          AND i.product_id = sr.product_id`)
      await tx.delete(stockReservations).where(eq(stockReservations.orderId, orderId))
    })
    return
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
    if (!intentId) return

    const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, intentId))
    if (!payment) return

    const fullyRefunded = isFullyRefunded(charge.amount_refunded, charge.amount)
    await db.update(payments)
      .set({ status: fullyRefunded ? 'refunded' : 'partially_refunded', refundedMinor: charge.amount_refunded })
      .where(eq(payments.id, payment.id))

    emit(Events.PaymentRefunded, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: payment.tenantId, payload: { orderId: payment.orderId, amountMinor: charge.amount_refunded },
    })
  }
}
