import { get, post } from './client'

export interface OrderLine { productId: string; name: string; priceMinor: number; qty: number }
export interface Order {
  id: string
  tenantId: string
  customerId: string
  status: string
  totalMinor: number
  deliveryAddress: string
  createdAt: string
  lines?: OrderLine[]
}

export const ordersApi = {
  checkout:   (tenantId: string, deliveryAddress: string, lines: OrderLine[]) =>
    post<Order>('/orders/checkout', { tenantId, deliveryAddress, lines }),
  listMine:   (limit = 20, offset = 0) =>
    get<Order[]>(`/orders/mine?limit=${limit}&offset=${offset}`),
  listTenant: (tenantId: string, status?: string, limit = 20, offset = 0) =>
    get<Order[]>(`/orders?tenantId=${tenantId}${status ? `&status=${status}` : ''}&limit=${limit}&offset=${offset}`),
  get:        (id: string) => get<Order>(`/orders/${id}`),
  accept:     (id: string) => post<Order>(`/orders/${id}/accept`),
  reject:     (id: string) => post<Order>(`/orders/${id}/reject`),
  preparing:  (id: string) => post<Order>(`/orders/${id}/preparing`),
  ready:      (id: string) => post<Order>(`/orders/${id}/ready`),
  cancel:     (id: string) => post<Order>(`/orders/${id}/cancel`),
  review:     (id: string, storeRating: number, comment?: string) =>
    post<void>(`/orders/${id}/review`, { storeRating, comment }),
}
