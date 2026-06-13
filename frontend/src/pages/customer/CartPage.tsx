import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cartApi, type CartLine } from '../../api/cart'
import { ordersApi } from '../../api/orders'
import { useAuth } from '../../context/auth'

export default function CartPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart', tenantId],
    queryFn: () => cartApi.get(tenantId!),
    enabled: !!tenantId,
  })

  const { mutate: removeLine } = useMutation({
    mutationFn: (productId: string) => cartApi.removeLine(tenantId!, productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', tenantId] }),
  })

  const { mutate: checkout, isPending } = useMutation({
    mutationFn: () => ordersApi.checkout(tenantId!, address, cart!.lines),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['cart', tenantId] })
      navigate(`/orders/${order.id}/track`)
    },
    onError: (err) => setError((err as Error).message),
  })

  if (!user) return null

  const lines: CartLine[] = cart?.lines ?? []
  const total = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0)

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {lines.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">Cart is empty.</p>
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
              <button
                onClick={() => removeLine(line.productId)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex justify-between mb-4 font-semibold">
            <span>Total</span>
            <span className="text-green-700">${(total / 100).toFixed(2)}</span>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery address</label>
            <input
              required value={address} onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, City"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={() => checkout()}
            disabled={isPending || !address}
            className="w-full bg-green-600 text-white rounded-lg py-2 font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Placing order…' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  )
}
