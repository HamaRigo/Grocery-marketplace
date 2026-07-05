import { get, post, patch } from './client'
import type { Store } from './stores'
import type { Payment } from './orders'

export interface Subscription {
  id: string
  tenantId: string
  plan: string
  status: string
  amountMinor: number
  currency: string
  billingInterval: string
  cancelAtPeriodEnd: boolean
  graceUntil: string | null
  currentPeriodEnd: string | null
}

export const billingApi = {
  getSubscription: (tenantId: string) =>
    get<Subscription | null>(`/billing/subscriptions/${tenantId}`),
  createCheckoutSession: (tenantId: string) =>
    post<{ url: string }>(`/billing/subscriptions/${tenantId}/checkout-session`),
  createPortalSession: (tenantId: string) =>
    post<{ url: string }>(`/billing/subscriptions/${tenantId}/portal-session`),
  // Admin only
  listSubscriptions: () =>
    get<Array<{ subscription: Subscription; store: Store | null }>>('/billing/subscriptions'),
  setPrice: (tenantId: string, amountMinor: number, currency: string) =>
    patch<Subscription>(`/billing/subscriptions/${tenantId}/price`, { amountMinor, currency }),
  refund: (orderId: string, amountMinor?: number) =>
    post<Payment>(`/billing/refund/${orderId}`, amountMinor ? { amountMinor } : undefined),
}
