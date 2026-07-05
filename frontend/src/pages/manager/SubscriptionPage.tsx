import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/auth'
import { billingApi } from '../../api/billing'
import Badge from '../../components/Badge'
import { formatMinor } from '../../lib/money'

export default function SubscriptionPage() {
  const { tenantId } = useAuth()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')

  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscription', tenantId],
    queryFn: () => billingApi.getSubscription(tenantId!),
    enabled: !!tenantId,
  })

  const { mutate: subscribe, isPending: subscribing } = useMutation({
    mutationFn: () => billingApi.createCheckoutSession(tenantId!),
    onSuccess: ({ url }) => { window.location.href = url },
  })

  const { mutate: manageBilling, isPending: opening } = useMutation({
    mutationFn: () => billingApi.createPortalSession(tenantId!),
    onSuccess: ({ url }) => { window.location.href = url },
  })

  if (!tenantId) return <p className="text-red-500">No store assigned to your account.</p>
  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>

  const isFreeTrial = sub?.status === 'trialing' && !sub.amountMinor
  const hasPaidSubscription = !!sub?.currentPeriodEnd && sub.status !== 'trialing'

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('subscription.title', 'Subscription')}</h1>

      {checkoutResult === 'success' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {t('subscription.checkoutSuccess', 'Subscription set up — thank you!')}
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          {t('subscription.checkoutCancelled', 'Checkout cancelled — no changes made.')}
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('subscription.status', 'Status')}</span>
          {sub ? <Badge status={sub.status} /> : <span className="text-gray-400">—</span>}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('subscription.price', 'Price')}</span>
          <span className="font-semibold text-gray-900">
            {sub && sub.amountMinor > 0 ? `${formatMinor(sub.amountMinor)} / ${sub.billingInterval}` : '—'}
          </span>
        </div>

        {sub?.currentPeriodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {isFreeTrial
                ? t('subscription.trialEnds', 'Free trial ends')
                : t('subscription.renewsOn', 'Renews on')}
            </span>
            <span className="text-gray-700">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
          </div>
        )}

        {sub?.status === 'past_due' && sub.graceUntil && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {t('subscription.overdue', 'Payment overdue — store will be disabled if unpaid past')}{' '}
            {new Date(sub.graceUntil).toLocaleDateString()}
          </div>
        )}

        <div className="pt-2 flex gap-2">
          {!hasPaidSubscription && (
            <button
              onClick={() => subscribe()}
              disabled={subscribing || !sub?.amountMinor}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              title={!sub?.amountMinor ? t('subscription.noPriceSet', 'No price set yet — ask an admin') : undefined}
            >
              {subscribing ? t('common.loading') : t('subscription.subscribe', 'Subscribe')}
            </button>
          )}
          {hasPaidSubscription && (
            <button
              onClick={() => manageBilling()}
              disabled={opening}
              className="flex-1 py-2 border rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {opening ? t('common.loading') : t('subscription.manageBilling', 'Manage billing')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
