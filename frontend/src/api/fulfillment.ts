import { get, post, put } from './client'

export interface Rider {
  id: string
  userId: string
  ownedByTenantId: string | null
  vehicle: string | null
  status: 'online' | 'offline' | 'busy'
}

export interface Job {
  id: string
  tenantId: string
  orderId: string
  riderId: string | null
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'failed'
  assignedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
}

export const fulfillmentApi = {
  me:        ()                                    => get<Rider>('/fulfillment/me'),
  myJobs:    (riderId: string)                     => get<Job[]>(`/fulfillment/jobs?riderId=${riderId}`),
  setStatus: (riderId: string, status: Rider['status']) =>
    put<Rider>('/fulfillment/availability', { riderId, status }),
  pickup:    (jobId: string)                       => post<{ ok: boolean }>(`/fulfillment/jobs/${jobId}/pickup`),
  deliver:   (jobId: string)                       => post<{ ok: boolean }>(`/fulfillment/jobs/${jobId}/deliver`),
  ping:      (orderId: string, lat: number, lng: number) =>
    post<void>('/tracking/ping', { orderId, lat, lng }),
  earnings:  (days = 7) =>
    get<{ deliveries: number; totalMinor: number; days: number }>(`/fulfillment/earnings?days=${days}`),
}
