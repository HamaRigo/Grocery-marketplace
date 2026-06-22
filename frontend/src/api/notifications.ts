import { get, post } from './client'

export interface AppNotification {
  id: string
  message: string
  type: string
  createdAt: string
  read: boolean
}

export const notificationsApi = {
  list: () => get<AppNotification[]>('/notifications'),
  markRead: () => post<{ ok: boolean }>('/notifications/read'),
}
