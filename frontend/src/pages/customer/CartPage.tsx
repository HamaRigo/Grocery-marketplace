import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, MapPin, ShoppingBag, Trash2 } from 'lucide-react'
import { cartApi, type CartLine } from '../../api/cart'
import { ordersApi } from '../../api/orders'
import { schedulingApi } from '../../api/scheduling'
import { useAuth } from '../../context/auth'
import { formatMinor } from '../../lib/money'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Chip from '../../components/ui/Chip'
import EmptyState from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Skeleton'

const STEPS = ['Cart', 'Address', 'Checkout']

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
      navigate(`/checkout/${order.id}`)
    },
    onError: (err) => setError((err as Error).message),
  })

  if (!user) return null

  const lines: CartLine[] = cart?.lines ?? []
  const total = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0)
  const availableSlots = slots.filter(s => s.bookedCount < s.capacity)
  const step = lines.length === 0 ? 0 : address ? 2 : 1

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('cart.title')}</h1>
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= step ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-faint'
              }`}>{i + 1}</div>
              <span className={`text-xs font-medium hidden sm:inline ${i <= step ? 'text-ink' : 'text-ink-faint'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-brand-500' : 'bg-line'}`} />}
            </div>
          ))}
        </div>
      </div>

      {isLoading && <PageSpinner />}

      {lines.length === 0 && !isLoading && (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title={t('cart.empty')}
          description="Browse a store and add items to get started."
          actionLabel="Find stores"
          onAction={() => navigate('/stores')}
        />
      )}

      <div className="space-y-3">
        {lines.map((line: CartLine) => (
          <Card key={line.productId} padding="sm" className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{line.name}</p>
              <p className="text-sm text-ink-muted">{formatMinor(line.priceMinor)} × {line.qty}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-brand-700 dark:text-brand-500">{formatMinor(line.priceMinor * line.qty)}</span>
              <Button variant="ghost" size="icon" onClick={() => removeLine(line.productId)} aria-label="Remove">
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {lines.length > 0 && (
        <Card className="space-y-4">
          <div className="flex justify-between text-base font-bold">
            <span>{t('cart.total')}</span>
            <span className="text-brand-700 dark:text-brand-500">{formatMinor(total)}</span>
          </div>

          {error && (
            <div className="rounded-2xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">{error}</div>
          )}

          <Input
            label={t('cart.deliveryAddress')}
            required
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={t('cart.addressPlaceholder')}
            leftIcon={<MapPin className="h-4 w-4" />}
          />

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
              <CalendarClock className="h-4 w-4 text-brand-600" /> {t('cart.scheduleDelivery')}
            </p>
            <Input
              type="date"
              min={today}
              value={slotDate}
              onChange={e => { setSlotDate(e.target.value); setSlotId('') }}
            />
            {slotDate && (
              availableSlots.length === 0
                ? <p className="mt-2 text-xs text-ink-faint">{t('cart.noSlots')}</p>
                : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableSlots.map(s => (
                      <Chip key={s.id} active={slotId === s.id} onClick={() => setSlotId(id => id === s.id ? '' : s.id)}>
                        {s.startTime} – {s.endTime}
                      </Chip>
                    ))}
                  </div>
                )
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => checkout()}
            disabled={isPending || !address}
            loading={isPending}
          >
            {isPending ? t('cart.placingOrder') : t('cart.placeOrder')}
          </Button>

          <Link to={`/stores/${tenantId}`} className="block text-center text-sm text-brand-700 hover:underline">
            Continue shopping
          </Link>
        </Card>
      )}
    </div>
  )
}
