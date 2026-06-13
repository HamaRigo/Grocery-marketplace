import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '../../api/orders'
import Badge from '../../components/Badge'

interface Location { lat: number; lng: number; updatedAt: string }

export default function TrackPage() {
  const { id } = useParams<{ id: string }>()
  const [location, setLocation] = useState<Location | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id!),
    refetchInterval: 15_000,
    enabled: !!id,
  })

  useEffect(() => {
    if (!id) return
    const wsBase = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3000'
    const ws = new WebSocket(`${wsBase}/tracking/ws/${id}`)
    wsRef.current = ws

    ws.onopen  = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; lat?: number; lng?: number }
        if ((msg.type === 'location' || msg.type === 'ping') && msg.lat != null && msg.lng != null) {
          setLocation({ lat: msg.lat, lng: msg.lng, updatedAt: new Date().toLocaleTimeString() })
        }
        if (msg.type === 'closed') {
          ws.close()
        }
      } catch { /* ignore */ }
    }

    return () => ws.close()
  }, [id])

  const mapsUrl = location
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : null

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Track Order</h1>
        <Link to="/orders" className="text-sm text-green-600 hover:underline">← My Orders</Link>
      </div>

      {order && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}…</span>
            <Badge status={order.status} />
          </div>
          <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
          <p className="font-semibold text-green-700 mt-1">${(order.totalMinor / 100).toFixed(2)}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">
            {connected ? 'Live tracking connected' : 'Connecting…'}
          </span>
        </div>

        {location ? (
          <div>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm mb-3">
              <p>Lat: <span className="text-green-700">{location.lat.toFixed(6)}</span></p>
              <p>Lng: <span className="text-green-700">{location.lng.toFixed(6)}</span></p>
              <p className="text-xs text-gray-400 mt-1">Updated {location.updatedAt}</p>
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="block text-center text-sm bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700">
                View on Google Maps
              </a>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-6">
            Waiting for rider location updates…
          </p>
        )}
      </div>
    </div>
  )
}
