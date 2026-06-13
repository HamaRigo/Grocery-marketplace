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
  listProducts:   (tenantId: string, q?: string) =>
    get<Product[]>(`/catalog/${tenantId}/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  listCategories: (tenantId: string) =>
    get<Category[]>(`/catalog/${tenantId}/categories`),
  createProduct:  (tenantId: string, body: Omit<Product, 'id' | 'tenantId' | 'status'>) =>
    post<Product>(`/catalog/${tenantId}/products`, body),
  updateProduct:  (tenantId: string, id: string, body: Partial<Product>) =>
    put<Product>(`/catalog/${tenantId}/products/${id}`, body),
  deleteProduct:  (tenantId: string, id: string) =>
    del<void>(`/catalog/${tenantId}/products/${id}`),
}
