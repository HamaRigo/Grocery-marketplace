import { EventEmitter } from 'events'

export const bus = new EventEmitter()
bus.setMaxListeners(50)

export type DomainEvent<T = unknown> = {
  eventId:        string
  occurredAt:     string
  tenantId?:      string
  correlationId?: string   // carry req.id across service boundaries
  payload:        T
}

export function emit<T>(type: string, event: DomainEvent<T>): void {
  bus.emit(type, event)
}

export function on<T>(type: string, handler: (e: DomainEvent<T>) => void): void {
  bus.on(type, handler)
}

export const Events = {
  UserRegistered:      'UserRegistered',
  StoreApproved:       'StoreApproved',
  StoreSuspended:      'StoreSuspended',
  StoreProfileUpdated: 'StoreProfileUpdated',
  ProductUpdated:      'ProductUpdated',
  PriceChanged:        'PriceChanged',
  OutOfStock:          'OutOfStock',
  StockReserved:       'StockReserved',
  StockReleased:       'StockReleased',
  OrderPlaced:         'OrderPlaced',
  OrderAccepted:       'OrderAccepted',
  OrderRejected:       'OrderRejected',
  OrderPreparing:      'OrderPreparing',
  OrderReady:          'OrderReady',
  OrderAssigned:       'OrderAssigned',
  OrderPickedUp:       'OrderPickedUp',
  OrderOutForDelivery: 'OrderOutForDelivery',
  OrderDelivered:      'OrderDelivered',
  OrderCancelled:      'OrderCancelled',
  PaymentCaptured:                'PaymentCaptured',
  PaymentRefunded:                'PaymentRefunded',
  CommissionSettled:              'CommissionSettled',
  SubscriptionPaymentSucceeded:   'SubscriptionPaymentSucceeded',
  SubscriptionPaymentFailed:      'SubscriptionPaymentFailed',
} as const

export type EventName = typeof Events[keyof typeof Events]
