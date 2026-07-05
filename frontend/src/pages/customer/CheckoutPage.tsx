import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { ordersApi } from '../../api/orders'
import { paymentsApi } from '../../api/payments'
import { formatMinor } from '../../lib/money'

// Load once at module scope, not per render, per Stripe.js guidance.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? t('checkout.genericError'))
      setSubmitting(false)
      return
    }

    // The card was accepted, but the order only moves out of pending_payment
    // once the Stripe webhook confirms it — never trust this callback alone.
    navigate('/orders')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? t('checkout.processing') : t('checkout.payNow')}
      </button>
    </form>
  )
}

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { t } = useTranslation()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId!),
    enabled: !!orderId,
  })

  useEffect(() => {
    if (!orderId) return
    paymentsApi.createPaymentIntent(orderId)
      .then(({ clientSecret }) => setClientSecret(clientSecret))
      .catch(e => setError((e as Error).message))
  }, [orderId])

  if (order && order.status !== 'pending_payment') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-gray-500 mb-4">{t('checkout.notAwaitingPayment')}</p>
        <Link to="/orders" className="text-green-600 hover:underline">{t('checkout.backToOrders')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('checkout.title')}</h1>

      {order && (
        <div className="bg-white rounded-xl border p-5 mb-6 flex justify-between items-center">
          <span className="text-sm text-gray-500">{t('checkout.orderTotal')}</span>
          <span className="font-semibold text-green-700">{formatMinor(order.totalMinor)}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm />
        </Elements>
      ) : (
        !error && <p className="text-gray-500">{t('checkout.loadingForm')}</p>
      )}
    </div>
  )
}
