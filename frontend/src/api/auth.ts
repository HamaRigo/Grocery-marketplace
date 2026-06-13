import { post } from './client'

export interface LoginResponse { token: string; userId: string; phone?: string }

export const authApi = {
  phoneLogin: (phone: string) =>
    post<LoginResponse>('/auth/phone', { phone }),
  login:    (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),
  register: (email: string, password: string, phone?: string) =>
    post<LoginResponse>('/auth/register', { email, password, phone }),
}
