import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cartApi, type CartLine } from '../../api/cart'
import { ordersApi } from '../../api/orders'
import { schedulingApi } from '../../api/scheduling'
import { useAuth } from '../../context/auth'

export default function CartPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [slotId, setSlotId] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart', tenantId],
    queryFn: () => cartApi.get(tenantId!),
    enabled: !!tenantId,
  })

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', tenantId, slotDate],
    queryFn: () => schedulingApi.listSlots(tenantId!, slotDate),
    enabled: !!tenantId && !!slotDate,
  })

  const { mutate: removeLine } = useMutation({
    mutationFn: (productId: string) => cartApi.removeLine(tenantId!, productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', tenantId] }),
  })

  const { mutate: checkout, isPending } = useMutation({
    mutationFn: () => ordersApi.checkout(tenantId!, address, cart!.lines, slotId || undefined),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['cart', tenantId] })
      navigate(`/orders/${order.id}/track`)
    },
    onError: (err) => setError((err as Error).message),
  })

  if (!user) return null

  const lines: CartLine[] = cart?.lines ?? []
  const total = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0)
  const availableSlots = slots.filter(s => s.bookedCount < s.capacity)

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('cart.title')}</h1>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      {lines.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">{t('cart.empty')}</p>
      )}

      <div className="space-y-3 mb-6">
        {lines.map((line: CartLine) => (
          <div key={line.productId} className="bg-white rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{line.name}</p>
              <p className="text-sm text-gray-500">
                ${(line.priceMinor / 100).toFixed(2)} × {line.qty}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-green-700">
                ${(line.priceMinor * line.qty / 100).toFixed(2)}
              </span>
              <button onClick={() => removeLine(line.productId)} className="text-red-400 hover:text-red-600 text-sm">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex justify-between font-semibold">
            <span>{t('cart.total')}</span>
            <span className="text-green-700">${(total / 100).toFixed(2)}</span>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('cart.deliveryAddress')}</label>
            <input
              required value={address} onChange={e => setAddress(e.target.value)}
              placeholder={t('cart.addressPlaceholder')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Scheduled delivery slot picker */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t('cart.scheduleDelivery')}</p>
            <input
              type="date" min={today} value={slotDate}
              onChange={e => { setSlotDate(e.target.value); setSlotId('') }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full mb-2"
            />
            {slotDate && (
              availableSlots.length === 0
                ? <p className="text-xs text-gray-400">{t('cart.noSlots')}</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSlotId(id => id === s.id ? '' : s.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                          slotId === s.id
                            ? 'bg-green-600 text-white border-green-600'
                            : 'border-gray-300 text-gray-700 hover:border-green-400'
                        }`}
                      >
                        {s.startTime} – {s.endTime}
                      </button>
                    ))}
                  </div>
                )
            )}
          </div>

          <button
            onClick={() => checkout()}
            disabled={isPending || !address}
            className="w-full bg-green-600 text-white rounded-lg py-2 font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? t('cart.placingOrder') : t('cart.placeOrder')}
          </button>
        </div>
      )}
    </div>
  )
}
