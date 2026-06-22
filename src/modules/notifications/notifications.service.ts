import { randomUUID } from 'crypto'
import { on, Events } from '../../platform/events'
import { redis } from '../../platform/redis'
import { db } from '../../platform/db'
import { orders } from '../../db/schema'
import { eq } from 'drizzle-orm'

const MAX = 50
const KEY = (userId: string) => `notifs:${userId}`

const messages: Record<string, string> = {
  [Events.PaymentRefunded]:               'Your refund has been processed.',
  [Events.CommissionSettled]:             'Commission settled for a delivered order.',
  [Events.SubscriptionPaymentSucceeded]:  'Subscription renewed successfully.',
  [Events.SubscriptionPaymentFailed]:     'Subscription payment failed — please update billing.',
  [Events.UserRegistered]:      'Welcome to Bakala!',
  [Events.OrderPlaced]:         'Order placed — the store will confirm shortly.',
  [Events.OrderAccepted]:       'Good news: the store accepted your order.',
  [Events.OrderRejected]:       'Sorry, the store could not accept your order.',
  [Events.OrderPreparing]:      'Your order is being prepared.',
  [Events.OrderReady]:          'Order ready — a rider is being assigned.',
  [Events.OrderAssigned]:       'A rider is heading to the store.',
  [Events.OrderOutForDelivery]: 'Your order is on the way!',
  [Events.OrderDelivered]:      'Delivered! Enjoy your groceries.',
  [Events.OrderCancelled]:      'Your order has been cancelled.',
}

async function push(userId: string, message: string, type: string) {
  const notif = JSON.stringify({
    id: randomUUID(), message, type,
    createdAt: new Date().toISOString(), read: false,
  })
  await redis.lpush(KEY(userId), notif)
  await redis.ltrim(KEY(userId), 0, MAX - 1)
}

async function notifyForOrder(orderId: string, message: string, type: string) {
  try {
    const [row] = await db.select({ customerId: orders.customerId })
      .from(orders).where(eq(orders.id, orderId))
    if (row?.customerId) await push(row.customerId, message, type)
  } catch { /* non-critical */ }
}

export function registerNotificationListeners(): void {
  for (const [event, msg] of Object.entries(messages)) {
    on<{ orderId?: string; userId?: string }>(event, async ({ payload }) => {
      if (payload && payload.userId) {
        await push(payload.userId!, msg, event).catch(() => {})
      } else if (payload && payload.orderId) {
        await notifyForOrder(payload.orderId!, msg, event).catch(() => {})
      }
    })
  }
}

export async function getNotifications(userId: string) {
  const raw = await redis.lrange(KEY(userId), 0, 49)
  return raw.map(r => JSON.parse(r) as {
    id: string; message: string; type: string; createdAt: string; read: boolean
  })
}

export async function markAllRead(userId: string) {
  const raw = await redis.lrange(KEY(userId), 0, 49)
  if (!raw.length) return
  const updated = raw.map(r => JSON.stringify({ ...JSON.parse(r), read: true }))
  await redis.del(KEY(userId))
  if (updated.length) await redis.rpush(KEY(userId), ...updated)
}
