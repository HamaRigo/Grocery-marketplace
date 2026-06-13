import { post } from './client'

export interface LoginResponse { token: string }

export const authApi = {
  login:    (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),
  register: (email: string, password: string, phone?: string) =>
    post<LoginResponse>('/auth/register', { email, password, phone }),
}
