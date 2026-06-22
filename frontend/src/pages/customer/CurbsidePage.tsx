import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogApi, type Product } from '../../api/catalog'
import { storesApi } from '../../api/stores'
import { ordersApi, type CurbsideVehicle, type OrderLine } from '../../api/orders'

type Step = 'browse' | 'checkout' | 'confirmed'

interface LocalLine extends OrderLine { qty: number }

export default function CurbsidePage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  const [step, setStep] = useState<Step>('browse')
  const [cart, setCart] = useState<LocalLine[]>([])
  const [added, setAdded] = useState<string | null>(null)
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [guestName, setGuestName] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [plate, setPlate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  const { data: store } = useQuery({
    queryKey: ['store', tenantId],
    queryFn: () => storesApi.get(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => catalogApi.listProducts(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  })

  // O(1) cart lookup by productId — replaces O(N) .find() inside every product card render
  const cartMap = useMemo(() => new Map(cart.map(l => [l.productId, l])), [cart])
  const total     = useMemo(() => cart.reduce((s, l) => s + l.priceMinor * l.qty, 0), [cart])
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart])

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id)
      if (existing) return prev.map(l => l.productId === product.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { productId: product.id, name: product.name, priceMinor: product.priceMinor, qty: 1 }]
    })
    setAdded(product.id)
    // Clear previous timer to avoid accumulating timers on rapid taps
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setAdded(null), 1200)
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }, [])

  async function placeOrder() {
    if (!guestName.trim() || !make.trim() || !model.trim() || !color.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const vehicle: CurbsideVehicle = { make, model, color, plate: plate || undefined }
      const order = await ordersApi.curbsideCheckout(tenantId!, guestName.trim(), vehicle, paymentMethod, cart)
      setOrderId(order.id)
      setStep('confirmed')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function doCheckIn() {
    if (!orderId) return
    setCheckingIn(true)
    try {
      await ordersApi.checkIn(orderId)
      setCheckedIn(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCheckingIn(false)
    }
  }

  if (step === 'confirmed') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order placed!</h1>
        <p className="text-gray-500 mb-1">Order ID: <span className="font-mono text-sm">{orderId?.slice(0, 8)}…</span></p>
        <p className="text-gray-500 mb-8">We're preparing your order. When you arrive, tap the button below.</p>

        {checkedIn ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-green-700 font-semibold text-lg">You're checked in!</p>
            <p className="text-green-600 text-sm mt-1">An employee is bringing your order to your car.</p>
            <p className="text-xs text-gray-500 mt-3">
              Payment: <span className="font-medium capitalize">{paymentMethod}</span> · Total: <span className="font-medium">${(total / 100).toFixed(2)}</span>
            </p>
          </div>
        ) : (
          <button
            onClick={doCheckIn}
            disabled={checkingIn}
            className="w-full py-4 bg-green-600 text-white rounded-xl text-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {checkingIn ? 'Notifying…' : "I'm outside the store"}
          </button>
        )}

        {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      </div>
    )
  }

  if (step === 'checkout') {
    return (
      <div className="max-w-lg mx-auto">
        <button onClick={() => setStep('browse')} className="text-sm text-green-600 mb-4 hover:underline">
          ← Back to products
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        {/* Cart summary */}
        <div className="bg-gray-50 rounded-xl border p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Your items</h2>
          {cart.map(l => (
            <div key={l.productId} className="flex justify-between items-center text-sm py-1">
              <span className="text-gray-700">{l.name} × {l.qty}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-green-700">${(l.priceMinor * l.qty / 100).toFixed(2)}</span>
                <button onClick={() => removeFromCart(l.productId)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
              </div>
            </div>
          ))}
          <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-green-700">${(total / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Guest info */}
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Your name</h2>
          <input
            value={guestName} onChange={e => setGuestName(e.target.value)}
            placeholder="Full name *"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Vehicle info */}
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Your car</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={make} onChange={e => setMake(e.target.value)} placeholder="Make (e.g. Toyota) *"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="Model (e.g. Corolla) *"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input value={color} onChange={e => setColor(e.target.value)} placeholder="Color *"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input value={plate} onChange={e => setPlate(e.target.value)} placeholder="Plate (optional)"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment at the car</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['cash', 'card'] as const).map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`py-3 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${
                  paymentMethod === method
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {method === 'cash' ? '💵 Cash' : '💳 Card'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <button
          onClick={placeOrder}
          disabled={submitting || cart.length === 0}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? 'Placing order…' : `Place order · $${(total / 100).toFixed(2)}`}
        </button>
      </div>
    )
  }

  // step === 'browse'
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{store?.name ?? 'Store'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Curbside pickup — no account needed</p>
        </div>
        {cart.length > 0 && (
          <button
            onClick={() => setStep('checkout')}
            className="relative px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Checkout
            <span className="ml-2 bg-white text-green-700 rounded-full px-1.5 py-0.5 text-xs font-bold">
              {itemCount}
            </span>
          </button>
        )}
      </div>

      {isLoading && <p className="text-gray-500">Loading products…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p: Product) => {
          const cartLine = cartMap.get(p.id)
          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-1">{p.name}</h3>
              {p.description && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="font-semibold text-green-700">${(p.priceMinor / 100).toFixed(2)}</span>
                <div className="flex items-center gap-2">
                  {cartLine && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      ×{cartLine.qty}
                    </span>
                  )}
                  <button
                    onClick={() => addToCart(p)}
                    disabled={p.status !== 'active'}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
                  >
                    {added === p.id ? 'Added!' : '+ Add'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {products?.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">No products found.</p>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center px-4">
          <button
            onClick={() => setStep('checkout')}
            className="w-full max-w-sm py-3 bg-green-600 text-white rounded-xl font-semibold shadow-lg hover:bg-green-700"
          >
            Checkout · {itemCount} items · ${(total / 100).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  )
}
