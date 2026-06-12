import { on, Events } from '../../platform/events'

const messages: Partial<Record<string, string>> = {
  [Events.PaymentRefunded]:               'Your refund has been processed.',
  [Events.CommissionSettled]:             'Commission settled for a delivered order.',
  [Events.SubscriptionPaymentSucceeded]:  'Subscription renewed successfully.',
  [Events.SubscriptionPaymentFailed]:     'Subscription payment failed — please update billing.',
  [Events.UserRegistered]:      'Welcome to Bakala! 🛒',
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

export function registerNotificationListeners(): void {
  for (const [event, msg] of Object.entries(messages)) {
    on(event, ({ payload }) => {
      // Swap console.log for FCM / APNs / SMS / email in production
      console.log(`[Notification] ${msg} — payload:`, JSON.stringify(payload))
    })
  }
}
