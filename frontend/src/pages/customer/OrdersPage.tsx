import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { MapPinned, Package, RotateCcw, Star, CreditCard, XCircle } from 'lucide-react'
import { ordersApi, type Order } from '../../api/orders'
import { cartApi } from '../../api/cart'
import Badge from '../../components/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Input'
import { formatMinor } from '../../lib/money'

const TRACKABLE = ['assigned', 'out_for_delivery']
const REVIEWABLE = ['delivered']
const CANCELLABLE = ['pending_payment', 'placed', 'accepted']
const AWAITING_PAYMENT = ['pending_payment']

const TIMELINE = ['placed', 'accepted', 'preparing', 'ready', 'assigned', 'out_for_delivery', 'delivered']

function statusIndex(status: string) {
  const i = TIMELINE.indexOf(status)
  return i >= 0 ? i : 0
}

export default function OrdersPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reordering, setReordering] = useState<string | null>(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-mine'],
    queryFn: () => ordersApi.listMine(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => ordersApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-mine'] }),
  })

  const { mutate: submitReview, isPending: reviewing } = useMutation({
    mutationFn: () => ordersApi.review(reviewOrderId!, rating, comment || undefined),
    onSuccess: () => {
      setReviewOrderId(null)
      setRating(5)
      setComment('')
      qc.invalidateQueries({ queryKey: ['orders-mine'] })
    },
  })

  async function reorder(order: Order) {
    if (!order.lines?.length) {
      order = await ordersApi.get(order.id)
    }
    if (!order.lines?.length || !order.tenantId) return
    setReordering(order.id)
    try {
      await Promise.all(
        order.lines.map(l =>
          cartApi.addLine(order.tenantId, {
            productId: l.productId,
            name: l.name,
            priceMinor: l.priceMinor,
            qty: l.qty,
          })
        )
      )
      navigate(`/cart/${order.tenantId}`)
    } finally {
      setReordering(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">My Orders</h1>
        <p className="text-sm text-ink-muted mt-1">Track, review, and reorder your groceries</p>
      </div>

      {isLoading && <PageSpinner />}

      <div className="space-y-4">
        {orders?.map((order: Order) => {
          const idx = statusIndex(order.status)
          return (
            <Card key={order.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink flex items-center gap-2">
                    <Package className="h-4 w-4 text-brand-600" />
                    Order #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-ink-faint mt-0.5">{new Date(order.placedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={order.status} />
                  {(order.payment?.status === 'refunded' || order.payment?.status === 'partially_refunded') && (
                    <Badge status={order.payment.status} />
                  )}
                </div>
              </div>

              {/* Mini timeline */}
              <div className="flex gap-1">
                {TIMELINE.map((step, i) => (
                  <div
                    key={step}
                    title={step.replace(/_/g, ' ')}
                    className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-brand-600' : 'bg-line'}`}
                  />
                ))}
              </div>

              <p className="text-sm text-ink-muted flex items-start gap-1.5">
                <MapPinned className="h-4 w-4 mt-0.5 shrink-0 text-brand-600" />
                {order.addressGeo?.address ?? '—'}
              </p>
              <p className="font-bold text-brand-700 dark:text-brand-500">{formatMinor(order.totalMinor)}</p>

              <div className="flex flex-wrap gap-2">
                {AWAITING_PAYMENT.includes(order.status) && (
                  <Link to={`/checkout/${order.id}`}>
                    <Button size="sm" leftIcon={<CreditCard className="h-3.5 w-3.5" />}>Pay now</Button>
                  </Link>
                )}
                {TRACKABLE.includes(order.status) && (
                  <Link to={`/orders/${order.id}/track`}>
                    <Button size="sm" variant="outline" leftIcon={<MapPinned className="h-3.5 w-3.5" />}>Track</Button>
                  </Link>
                )}
                {REVIEWABLE.includes(order.status) && (
                  <Button size="sm" variant="secondary" leftIcon={<Star className="h-3.5 w-3.5" />} onClick={() => setReviewOrderId(order.id)}>
                    Review
                  </Button>
                )}
                {CANCELLABLE.includes(order.status) && (
                  <Button size="sm" variant="ghost" className="text-danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => cancel(order.id)}>
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  loading={reordering === order.id}
                  onClick={() => reorder(order)}
                >
                  Order again
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {orders?.length === 0 && !isLoading && (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No orders yet"
          description="When you place an order, it will show up here with live tracking."
          actionLabel="Browse stores"
          onAction={() => navigate('/stores')}
        />
      )}

      <Modal
        open={!!reviewOrderId}
        onClose={() => setReviewOrderId(null)}
        title="Leave a review"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOrderId(null)}>Cancel</Button>
            <Button onClick={() => submitReview()} loading={reviewing}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1"
                  aria-label={`${n} stars`}
                >
                  <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-line-strong'}`} />
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="How was your order?"
          />
        </div>
      </Modal>
    </div>
  )
}
