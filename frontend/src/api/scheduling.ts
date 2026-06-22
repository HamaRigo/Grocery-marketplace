import { get, post } from './client'

export interface DeliverySlot {
  id: string
  tenantId: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
}

export const schedulingApi = {
  listSlots: (tenantId: string, date: string) =>
    get<DeliverySlot[]>(`/scheduling/${tenantId}/slots?date=${date}`),

  createSlot: (tenantId: string, body: { date: string; startTime: string; endTime: string; capacity: number }) =>
    post<DeliverySlot>(`/scheduling/${tenantId}/slots`, body),
}
