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
  orderCount: number
  revenueMajor: number
}

export const reportsApi = {
  overview:       () => get<Overview>('/reports/overview'),
  storeBreakdown: () => get<StoreBreakdown[]>('/reports/stores'),
  revenue:        (from: string, to: string) =>
    get<Array<{ date: string; revenueMajor: number }>>(`/reports/revenue?from=${from}&to=${to}`),
}
