import { get, post } from './client'

export interface Store {
  id: string
  name: string
  status: string
  dispatchPolicy: string
  commissionBps: number
  lat?: number
  lng?: number
  radiusKm?: number
}

export const storesApi = {
  list:    (lat?: number, lng?: number) =>
    get<Store[]>(`/stores${lat != null ? `?lat=${lat}&lng=${lng}` : ''}`),
  get:     (id: string) => get<Store>(`/stores/${id}`),
  approve: (id: string) => post<Store>(`/stores/${id}/approve`),
  suspend: (id: string) => post<Store>(`/stores/${id}/suspend`),
  onboard: (body: { name: string; lat?: number; lng?: number }) =>
    post<Store>('/stores', body),
}
