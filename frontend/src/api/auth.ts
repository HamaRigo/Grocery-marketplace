import { get, post } from './client'

export interface SessionUser {
  userId: string
  roles: Array<{ role: string; tenantId: string | null }>
}

export const authApi = {
  me:          () => get<SessionUser>('/auth/me'),
  phoneLogin:  (phone: string)                    => post<SessionUser>('/auth/phone', { phone }),
  login:       (email: string, password: string)  => post<SessionUser>('/auth/login', { email, password }),
  register:    (email: string, password: string, phone?: string) =>
    post<{ userId: string }>('/auth/register', { email, password, phone }),
  logout:      () => post<{ ok: boolean }>('/auth/logout'),
}
