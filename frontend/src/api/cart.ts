import { get, post, del } from './client'

export interface CartLine { productId: string; name: string; priceMinor: number; qty: number }
export interface Cart { tenantId: string; lines: CartLine[] }

/** Normalize legacy array responses and the current `{ tenantId, lines }` shape. */
function normalizeCart(tenantId: string, data: Cart | CartLine[] | null | undefined): Cart {
  if (Array.isArray(data)) return { tenantId, lines: data }
  if (data && Array.isArray(data.lines)) return { tenantId: data.tenantId || tenantId, lines: data.lines }
  return { tenantId, lines: [] }
}

export const cartApi = {
  get: async (tenantId: string) =>
    normalizeCart(tenantId, await get<Cart | CartLine[]>(`/cart/${tenantId}`)),
  addLine: async (tenantId: string, line: CartLine) =>
    normalizeCart(tenantId, await post<Cart | CartLine[]>(`/cart/${tenantId}/lines`, line)),
  removeLine: async (tenantId: string, productId: string) =>
    normalizeCart(tenantId, await del<Cart | CartLine[]>(`/cart/${tenantId}/lines/${productId}`)),
  clear: (tenantId: string) =>
    del<void>(`/cart/${tenantId}`),
}
