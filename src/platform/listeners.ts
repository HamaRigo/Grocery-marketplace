import { on, emit, Events } from './events'
import { FulfillmentService } from '../modules/fulfillment/fulfillment.service'
import { OrderingService } from '../modules/ordering/ordering.service'
import { BillingService } from '../modules/billing/billing.service'
import { randomUUID } from 'crypto'

export function registerListeners(): void {
  on<{ orderId: string; fulfillmentType?: string }>(Events.OrderReady, async ({ tenantId, payload }) => {
    if (!tenantId) return
    // fulfillmentType is included in the event payload — no extra DB query needed
    if (payload.fulfillmentType === 'curbside') return
    await FulfillmentService.createJob(tenantId, payload.orderId)
  })

  on<{ orderId: string; riderId: string }>(Events.OrderAssigned, async ({ tenantId, payload }) => {
    await OrderingService.setStatus(payload.orderId, 'assigned', 'fulfillment')
  })

  on<{ orderId: string }>(Events.OrderPickedUp, async ({ tenantId, payload }) => {
    await OrderingService.setStatus(payload.orderId, 'out_for_delivery', 'fulfillment')
    emit(Events.OrderOutForDelivery, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId, payload: { orderId: payload.orderId },
    })
  })

  on<{ orderId: string }>(Events.OrderDelivered, async ({ tenantId, payload }) => {
    await OrderingService.setStatus(payload.orderId, 'delivered', 'fulfillment')
    emit(Events.PaymentCaptured, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId, payload: { orderId: payload.orderId },
    })
    // Settle commission after capture
    await BillingService.settleCommission(payload.orderId)
  })
}
