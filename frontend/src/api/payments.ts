import { post } from './client'

export const paymentsApi = {
  createPaymentIntent: (orderId: string) =>
    post<{ clientSecret: string }>('/payments/create-payment-intent', { orderId }),
}
