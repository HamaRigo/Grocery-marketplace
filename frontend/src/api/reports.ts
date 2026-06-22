import { get } from './client'

export interface Overview {
  ordersByStatus: Record<string, number>
  capturedRevenueMajor: number
  commissionEarnedMajor: number
  commissionUnpaidMajor: number
  storeCount: number
  userCount: number
}

export interface StoreBreakdown {
  tenantId: string
  storeName: string | null
  orderCount: number
  revenueMajor: number
  avgOrderSize: number
}

export interface PrepTime {
  avg_minutes: number
  sample_count: number
}

export interface RiderEarnings {
  deliveries: number
  totalMinor: number
  days: number
}

export const reportsApi = {
  overview:       () => get<Overview>('/reports/overview'),
  storeBreakdown: () => get<StoreBreakdown[]>('/reports/stores'),
  revenue:        (from: string, to: string) =>
    get<Array<{ date: string; revenueMajor: number }>>(`/reports/revenue?from=${from}&to=${to}`),
  prepTime:       (tenantId?: string) =>
    get<PrepTime>(`/reports/prep-time${tenantId ? `?tenantId=${tenantId}` : ''}`),
  riderEarnings:  (riderId: string, days = 7) =>
    get<RiderEarnings>(`/reports/rider-earnings?riderId=${riderId}&days=${days}`),
}
