import { get, post } from './client'

export interface OrderLine { productId: string; name: string; priceMinor: number; qty: number }
export interface CurbsideVehicle { make: string; model: string; color: string; plate?: string }
export interface AddressGeo { lat: number; lng: number; address: string }
export interface Payment {
  id: string
  orderId: string | null
  provider: string
  stripePaymentIntentId: string | null
  amountMinor: number
  refundedMinor: number
  currency: string
  status: string
  createdAt: string
}
export interface AdminOrderRow {
  order: Order
  payment: Payment | null
  storeName: string | null
  customerEmail: string | null
}
export interface Order {
  id: string
  tenantId: string
  customerId: string | null
  status: string
  fulfillmentType: string
  curbsideName: string | null
  curbsideVehicle: CurbsideVehicle | null
  paymentMethod: string | null
  checkedIn: boolean
  totalMinor: number
  addressGeo: AddressGeo | null
  placedAt: string
  lines?: OrderLine[]
  payment?: Payment | null
}

export const ordersApi = {
  checkout:   (tenantId: string, address: string, lines: OrderLine[], scheduledSlotId?: string) =>
    post<Order>('/orders/checkout', { tenantId, addressGeo: { lat: 0, lng: 0, address }, lines, scheduledSlotId }),
  curbsideCheckout: (
    tenantId: string,
    guestName: string,
    vehicle: CurbsideVehicle,
    paymentMethod: 'cash' | 'card',
    items: OrderLine[],
    currency = 'QAR',
  ) => post<Order>('/orders/curbside', { tenantId, guestName, vehicle, paymentMethod, currency, items }),
  checkIn:    (id: string) => post<{ ok: boolean; orderId: string }>(`/orders/${id}/checkin`),
  handoff:    (id: string) => post<{ ok: boolean }>(`/orders/${id}/handoff`),
  listMine:   (limit = 20, offset = 0) =>
    get<Order[]>(`/orders/mine?limit=${limit}&offset=${offset}`),
  listTenant: (tenantId: string, status?: string, limit = 20, offset = 0) =>
    get<Order[]>(`/orders?tenantId=${tenantId}${status ? `&status=${status}` : ''}&limit=${limit}&offset=${offset}`),
  listAdmin:  (paymentStatus?: string, limit = 20, offset = 0) =>
    get<AdminOrderRow[]>(`/orders/admin?${paymentStatus ? `paymentStatus=${paymentStatus}&` : ''}limit=${limit}&offset=${offset}`),
  get:        (id: string) => get<Order>(`/orders/${id}`),
  accept:     (id: string) => post<Order>(`/orders/${id}/accept`),
  reject:     (id: string) => post<Order>(`/orders/${id}/reject`),
  preparing:  (id: string) => post<Order>(`/orders/${id}/preparing`),
  ready:      (id: string) => post<Order>(`/orders/${id}/ready`),
  cancel:     (id: string) => post<Order>(`/orders/${id}/cancel`),
  review:     (id: string, storeRating: number, comment?: string) =>
    post<void>(`/orders/${id}/review`, { storeRating, comment }),
}
