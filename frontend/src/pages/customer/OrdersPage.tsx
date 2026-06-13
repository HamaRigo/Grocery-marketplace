import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi, type Order } from '../../api/orders'
import Badge from '../../components/Badge'

const TRACKABLE = ['assigned', 'out_for_delivery']
const REVIEWABLE = ['delivered']
const CANCELLABLE = ['placed', 'accepted']

export default function OrdersPage() {
  const qc = useQueryClient()
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-mine'],
    queryFn: () => ordersApi.listMine(),
    refetchInterval: 10_000,
  })

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => ordersApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-mine'] }),
  })

  const { mutate: submitReview } = useMutation({
    mutationFn: () => ordersApi.review(reviewOrderId!, rating, comment || undefined),
    onSuccess: () => {
      setReviewOrderId(null)
      setRating(5)
      setComment('')
      qc.invalidateQueries({ queryKey: ['orders-mine'] })
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {orders?.map((order: Order) => (
          <div key={order.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900 text-sm">{order.id.slice(0, 8)}…</p>
                <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <Badge status={order.status} />
            </div>

            <p className="text-sm text-gray-700 mb-1">{order.deliveryAddress}</p>
            <p className="font-semibold text-green-700 mb-3">${(order.totalMinor / 100).toFixed(2)}</p>

            <div className="flex gap-2 flex-wrap">
              {TRACKABLE.includes(order.status) && (
                <Link to={`/orders/${order.id}/track`}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                  Track
                </Link>
              )}
              {REVIEWABLE.includes(order.status) && (
                <button onClick={() => setReviewOrderId(order.id)}
                  className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">
                  Review
                </button>
              )}
              {CANCELLABLE.includes(order.status) && (
                <button onClick={() => cancel(order.id)}
                  className="px-3 py-1 text-xs border border-red-400 text-red-500 rounded hover:bg-red-50">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {orders?.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">No orders yet.</p>
      )}

      {reviewOrderId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-gray-900 mb-4">Leave a review</h2>
            <div className="mb-3">
              <label className="block text-sm mb-1 font-medium">Rating (1–5)</label>
              <input type="number" min={1} max={5} value={rating}
                onChange={e => setRating(Number(e.target.value))}
                className="border rounded px-3 py-1.5 text-sm w-20" />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1 font-medium">Comment</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewOrderId(null)}
                className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => submitReview()}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
