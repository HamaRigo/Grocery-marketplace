import { get, post, del } from './client'

export interface CartLine { productId: string; name: string; priceMinor: number; qty: number }
export interface Cart { tenantId: string; lines: CartLine[] }

export const cartApi = {
  get:        (tenantId: string) =>
    get<Cart>(`/cart/${tenantId}`),
  addLine:    (tenantId: string, line: CartLine) =>
    post<Cart>(`/cart/${tenantId}/lines`, line),
  removeLine: (tenantId: string, productId: string) =>
    del<Cart>(`/cart/${tenantId}/lines/${productId}`),
  clear:      (tenantId: string) =>
    del<void>(`/cart/${tenantId}`),
}
