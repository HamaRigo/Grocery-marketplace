import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { ordersApi } from '../../api/orders'
import { paymentsApi } from '../../api/payments'
import { formatMinor } from '../../lib/money'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { PageSpinner } from '../../components/ui/Skeleton'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

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

    navigate('/orders')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="rounded-2xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">{error}</div>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={!stripe} loading={submitting} leftIcon={<Lock className="h-4 w-4" />}>
        {submitting ? t('checkout.processing') : t('checkout.payNow')}
      </Button>
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
      <div className="mx-auto max-w-lg text-center py-16">
        <p className="text-ink-muted mb-4">{t('checkout.notAwaitingPayment')}</p>
        <Link to="/orders" className="text-brand-700 font-medium hover:underline">{t('checkout.backToOrders')}</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-brand-600" /> {t('checkout.title')}
        </h1>
        <p className="text-sm text-ink-muted mt-1 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Secure payment powered by Stripe
        </p>
      </div>

      {order && (
        <Card className="flex justify-between items-center">
          <span className="text-sm text-ink-muted">{t('checkout.orderTotal')}</span>
          <span className="text-lg font-bold text-brand-700 dark:text-brand-500">{formatMinor(order.totalMinor)}</span>
        </Card>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">{error}</div>
      )}

      <Card>
        {!stripePromise ? (
          <p className="text-sm text-danger">Payments are not configured. Set VITE_STRIPE_PUBLISHABLE_KEY and redeploy.</p>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm />
          </Elements>
        ) : (
          !error && <PageSpinner label={t('checkout.loadingForm')} />
        )}
      </Card>
    </div>
  )
}
