import { get, put } from './client'

export interface InventoryRow {
  id: string
  tenantId: string
  productId: string
  onHand: number
  reserved: number
  lowStockThreshold: number | null
}

export const inventoryApi = {
  listByTenant: (tenantId: string) =>
    get<InventoryRow[]>(`/inventory/${tenantId}`),

  setStock: (tenantId: string, productId: string, onHand: number, lowStockThreshold?: number) =>
    put<InventoryRow[]>(`/inventory/${tenantId}/${productId}`, { onHand, lowStockThreshold }),
}
