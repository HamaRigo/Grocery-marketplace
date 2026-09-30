import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, MapPinned, Navigation, Radio, Truck } from 'lucide-react'
import { ordersApi } from '../../api/orders'
import Badge from '../../components/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LocationMap from '../../components/map/LocationMap'
import { formatMinor } from '../../lib/money'

interface Location { lat: number; lng: number; updatedAt: string }

const STEPS = [
  { id: 'placed', label: 'Placed', icon: Circle },
  { id: 'preparing', label: 'Preparing', icon: Circle },
  { id: 'out_for_delivery', label: 'On the way', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

function stepReached(status: string, stepId: string) {
  const order = ['placed', 'accepted', 'preparing', 'ready', 'assigned', 'out_for_delivery', 'delivered']
  const simplified: Record<string, string> = {
    placed: 'placed',
    accepted: 'placed',
    preparing: 'preparing',
    ready: 'preparing',
    assigned: 'out_for_delivery',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
  }
  const current = simplified[status] ?? 'placed'
  return order.indexOf(status) >= order.indexOf(
    stepId === 'preparing' ? 'preparing' : stepId === 'out_for_delivery' ? 'assigned' : stepId
  ) || (current === stepId)
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>()
  const [location, setLocation] = useState<Location | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id!),
    refetchInterval: connected ? false : 15_000,
    staleTime: 10_000,
    enabled: !!id,
  })

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      console.log('User location:', pos.coords.latitude, pos.coords.longitude)
      // In TrackPage, the map centers on the rider's location.
      // We can't easily "center" on user without changing the map's center prop.
    })
  }, [])

  useEffect(() => {
    if (!id) return
    const envWs = (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, '')
    const envApi = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
    const base = envWs
      ?? (envApi ? envApi.replace(/^http/, 'ws') : null)
      ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    const ws = new WebSocket(`${base}/tracking/ws/${id}`)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; lat?: number; lng?: number }
        if ((msg.type === 'location' || msg.type === 'ping') && msg.lat != null && msg.lng != null) {
          setLocation({ lat: msg.lat, lng: msg.lng, updatedAt: new Date().toLocaleTimeString() })
        }
        if (msg.type === 'closed') ws.close()
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [id])

  const mapsUrl = location
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : null

  const status = order?.status ?? 'placed'

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Track Order</h1>
        <Link to="/orders" className="text-sm font-medium text-brand-700 hover:underline">← Orders</Link>
      </div>

      {order && (
        <Card>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-ink-faint">Order #{order.id.slice(0, 8)}</span>
            <Badge status={order.status} />
          </div>
          <p className="text-sm text-ink-muted flex items-center gap-1.5">
            <MapPinned className="h-4 w-4 text-brand-600" /> {order.addressGeo?.address}
          </p>
          <p className="mt-2 font-bold text-brand-700 dark:text-brand-500">{formatMinor(order.totalMinor)}</p>
        </Card>
      )}

      <Card>
        <ol className="space-y-4">
          {STEPS.map((step, i) => {
            const done = stepReached(status, step.id)
            const active = status === step.id || (step.id === 'preparing' && ['preparing', 'ready'].includes(status))
              || (step.id === 'out_for_delivery' && ['assigned', 'out_for_delivery'].includes(status))
              || (step.id === 'placed' && ['placed', 'accepted'].includes(status))
            const Icon = step.icon
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                    done ? 'bg-brand-600 border-brand-600 text-white' : 'border-line text-ink-faint'
                  } ${active ? 'ring-4 ring-brand-600/20' : ''}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {i < STEPS.length - 1 && <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-brand-500' : 'bg-line'}`} />}
                </div>
                <div className="pt-1.5 pb-4">
                  <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-ink-faint'}`}>{step.label}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Radio className={`h-4 w-4 ${connected ? 'text-brand-600' : 'text-ink-faint'}`} />
          <span className="text-sm text-ink-muted">
            {connected ? 'Live tracking connected' : 'Connecting…'}
          </span>
          {connected && <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />}
        </div>

        {location ? (
          <div className="space-y-3">
            <LocationMap
              center={location}
              markers={[{ id: 'rider', position: location, title: 'Rider', color: '#0284c7' }]}
              height="14rem"
              zoom={15}
            />
            <p className="text-xs text-ink-faint">Updated {location.updatedAt}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full" variant="outline" leftIcon={<Navigation className="h-4 w-4" />}>
                  Open in Google Maps
                </Button>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted text-center py-8">Waiting for rider location updates…</p>
        )}
      </Card>
    </div>
  )
}
