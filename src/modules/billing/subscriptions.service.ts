import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import Stripe from 'stripe'
import { stripe } from '../payments/payments.service'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { subscriptions, stores, userRoles, users } from '../../db/schema'

const GRACE_DAYS = 15 // days a store may keep selling after a real Stripe payment failure

type SubscriptionStatus = typeof subscriptions.$inferSelect['status']

// Stripe uses American spelling ('canceled'); our enum keeps the existing
// British spelling ('cancelled') already used elsewhere in this schema.
export const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing:          'trialing',
  active:            'active',
  past_due:          'past_due',
  canceled:          'cancelled',
  incomplete:        'incomplete',
  incomplete_expired: 'incomplete',
  unpaid:            'unpaid',
  paused:            'past_due',
}

// Pure predicates — extracted so the admin-vs-billing suspension rule can be
// unit-tested without a DB: a billing event never overrides an admin action.
export function shouldSuspendForBilling(storeStatus: string): boolean {
  return storeStatus !== 'suspended'
}
export function shouldReinstateFromBilling(storeStatus: string, suspendedReason: string | null): boolean {
  return storeStatus === 'suspended' && suspendedReason === 'billing'
}

async function getSubscription(tenantId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId))
  if (!sub) throw Object.assign(new Error('No subscription found for this store'), { statusCode: 404 })
  return sub
}

async function getManagerEmail(tenantId: string): Promise<string | undefined> {
  const [row] = await db.select({ email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.role, 'manager')))
    .limit(1)
  return row?.email
}

export const SubscriptionsService = {
  async getOrCreateStripeCustomer(tenantId: string): Promise<string> {
    const sub = await getSubscription(tenantId)
    if (sub.stripeCustomerId) return sub.stripeCustomerId

    const [store] = await db.select().from(stores).where(eq(stores.id, tenantId))
    const email = await getManagerEmail(tenantId)

    const customer = await stripe.customers.create({
      email,
      name: store?.name,
      metadata: { tenantId },
    })
    await db.update(subscriptions).set({ stripeCustomerId: customer.id }).where(eq(subscriptions.tenantId, tenantId))
    return customer.id
  },

  async createCheckoutSession(tenantId: string) {
    const sub = await getSubscription(tenantId)
    if (!sub.amountMinor)
      throw Object.assign(new Error('This store has no subscription price set yet — ask an admin to set one'), { statusCode: 400 })

    const customerId = await SubscriptionsService.getOrCreateStripeCustomer(tenantId)
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

    // If the store is still inside its free month, delay the first real charge
    // until that period ends instead of granting a second free trial on top.
    const now = new Date()
    const trialEnd = sub.currentPeriodEnd && sub.currentPeriodEnd > now
      ? Math.floor(sub.currentPeriodEnd.getTime() / 1000)
      : undefined

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: sub.currency.toLowerCase(),
          unit_amount: sub.amountMinor,
          recurring: { interval: sub.billingInterval as Stripe.Price.Recurring.Interval },
          product: process.env.STRIPE_PRODUCT_ID!,
        },
        quantity: 1,
      }],
      subscription_data: trialEnd ? { trial_end: trialEnd, metadata: { tenantId } } : { metadata: { tenantId } },
      success_url: `${frontendUrl}/manager/subscription?checkout=success`,
      cancel_url:  `${frontendUrl}/manager/subscription?checkout=cancelled`,
    })

    return { url: session.url }
  },

  async createPortalSession(tenantId: string) {
    const customerId = await SubscriptionsService.getOrCreateStripeCustomer(tenantId)
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/manager/subscription`,
    })
    return { url: session.url }
  },

  async setPrice(tenantId: string, amountMinor: number, currency: string) {
    const [sub] = await db.update(subscriptions)
      .set({ amountMinor, currency })
      .where(eq(subscriptions.tenantId, tenantId))
      .returning()
    return sub
  },

  async listAll() {
    return db.select({ subscription: subscriptions, store: stores })
      .from(subscriptions)
      .leftJoin(stores, eq(stores.id, subscriptions.tenantId))
  },

  async handleSubscriptionEvent(event: Stripe.Event) {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object as Stripe.Subscription
      const tenantId = stripeSub.metadata?.tenantId
      if (!tenantId) return

      const status = STATUS_MAP[stripeSub.status]
      const priceId = stripeSub.items.data[0]?.price?.id ?? null
      const periodEndItem = stripeSub.items.data[0]?.current_period_end
      const currentPeriodEnd = periodEndItem ? new Date(periodEndItem * 1000) : undefined

      await db.update(subscriptions).set({
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        status,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        graceUntil: status === 'active' || status === 'trialing' ? null : undefined,
      }).where(eq(subscriptions.tenantId, tenantId))

      if (status === 'unpaid') await suspendForBilling(tenantId)
      if (status === 'active' || status === 'trialing') await reinstateIfBillingSuspended(tenantId)
      return
    }

    if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as Stripe.Subscription
      const tenantId = stripeSub.metadata?.tenantId
      if (!tenantId) return
      await db.update(subscriptions).set({ status: 'cancelled' }).where(eq(subscriptions.tenantId, tenantId))
      await suspendForBilling(tenantId)
      return
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const tenantId = await tenantIdFromCustomer(invoice.customer)
      if (!tenantId) return

      const graceUntil = new Date()
      graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS)
      await db.update(subscriptions).set({ status: 'past_due', graceUntil }).where(eq(subscriptions.tenantId, tenantId))

      emit(Events.SubscriptionPaymentFailed, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId, payload: { tenantId },
      })
      return
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const tenantId = await tenantIdFromCustomer(invoice.customer)
      if (!tenantId) return

      await db.update(subscriptions).set({ status: 'active', graceUntil: null }).where(eq(subscriptions.tenantId, tenantId))
      await reinstateIfBillingSuspended(tenantId)

      emit(Events.SubscriptionPaymentSucceeded, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        tenantId, payload: { tenantId },
      })
    }
  },
}

async function tenantIdFromCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | undefined> {
  const customerId = typeof customer === 'string' ? customer : customer?.id
  if (!customerId) return undefined
  const [sub] = await db.select({ tenantId: subscriptions.tenantId }).from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
  return sub?.tenantId
}

async function suspendForBilling(tenantId: string) {
  const [store] = await db.select().from(stores).where(eq(stores.id, tenantId))
  if (!store || !shouldSuspendForBilling(store.status)) return // admin-suspended or already suspended — don't overwrite
  await db.update(stores).set({ status: 'suspended', suspendedReason: 'billing' }).where(eq(stores.id, tenantId))
}

async function reinstateIfBillingSuspended(tenantId: string) {
  const [store] = await db.select().from(stores).where(eq(stores.id, tenantId))
  if (!store || !shouldReinstateFromBilling(store.status, store.suspendedReason)) return
  await db.update(stores).set({ status: 'active', suspendedReason: null }).where(eq(stores.id, tenantId))
}
