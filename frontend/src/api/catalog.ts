import { get, post, put, del } from './client'

export interface Category { id: string; name: string }
export interface Product {
  id: string
  tenantId: string
  name: string
  description?: string
  priceMinor: number
  categoryId?: string
  status: string
}

export const catalogApi = {
  listProducts: (tenantId: string, q?: string, categoryId?: string, maxPrice?: number) => {
    const params = new URLSearchParams()
    if (q)          params.set('q', q)
    if (categoryId) params.set('categoryId', categoryId)
    if (maxPrice)   params.set('maxPrice', String(maxPrice))
    const qs = params.toString()
    return get<Product[]>(`/catalog/${tenantId}/products${qs ? `?${qs}` : ''}`)
  },
  listCategories: (tenantId: string) =>
    get<Category[]>(`/catalog/${tenantId}/categories`),
  createProduct:  (tenantId: string, body: Omit<Product, 'id' | 'tenantId' | 'status'>) =>
    post<Product>(`/catalog/${tenantId}/products`, body),
  updateProduct:  (tenantId: string, id: string, body: Partial<Product>) =>
    put<Product>(`/catalog/${tenantId}/products/${id}`, body),
  deleteProduct:  (tenantId: string, id: string) =>
    del<void>(`/catalog/${tenantId}/products/${id}`),
  importCsv: (tenantId: string, csv: string) =>
    fetch(`/catalog/${tenantId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'include',
      body: csv,
    }).then(r => r.json() as Promise<{ imported: number; products: Product[] }>),
}
