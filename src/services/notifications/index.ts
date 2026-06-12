/**
 * Standalone Notifications Service
 * Reads domain events from Redis Streams and dispatches push/SMS/email.
 * No HTTP port — pure consumer.
 */
import 'dotenv/config'
import { ensureConsumerGroup, readBatch, ack } from '../../platform/broker'

const GROUP    = 'notifications-svc'
const CONSUMER = `notif-${process.pid}`

const MESSAGES: Record<string, string> = {
  UserRegistered:               'Welcome to Bakala! 🛒',
  OrderPlaced:                  'Order placed — awaiting store confirmation.',
  OrderAccepted:                'Your order has been accepted.',
  OrderRejected:                'Sorry, the store could not accept your order.',
  OrderPreparing:               'Your order is being prepared.',
  OrderReady:                   'Order ready — assigning a rider.',
  OrderAssigned:                'A rider is heading to the store.',
  OrderOutForDelivery:          "Your order is on the way!",
  OrderDelivered:               'Delivered! Enjoy your groceries.',
  OrderCancelled:               'Your order has been cancelled.',
  PaymentRefunded:              'Your refund has been processed.',
  CommissionSettled:            'Commission settled for a delivered order.',
  SubscriptionPaymentSucceeded: 'Your subscription has been renewed.',
  SubscriptionPaymentFailed:    'Subscription payment failed — please update billing.',
}

async function main() {
  await ensureConsumerGroup(GROUP)
  console.log(`[NotificationSvc] consumer=${CONSUMER}`)

  while (true) {
    const batch = await readBatch(GROUP, CONSUMER)
    for (const msg of batch) {
      const text = MESSAGES[msg.type]
      if (text) {
        const payload = (msg.data as any).payload ?? {}
        // Swap console.log for FCM / APNs / SMS / email SDK here
        console.log(`[Notification] ${msg.type} → "${text}" | order=${payload.orderId ?? '-'}`)
      }
      await ack(GROUP, msg.id)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
