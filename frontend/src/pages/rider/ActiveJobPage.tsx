import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fulfillmentApi } from '../../api/fulfillment'
import { ordersApi } from '../../api/orders'
import Badge from '../../components/Badge'

export default function ActiveJobPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate   = useNavigate()
  const qc         = useQueryClient()

  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'active' | 'denied'>('waiting')
  const [lastPing, setLastPing]   = useState<{ lat: number; lng: number } | null>(null)
  const watchRef = useRef<number | null>(null)

  const { data: rider } = useQuery({
    queryKey: ['rider-me'],
    queryFn: fulfillmentApi.me,
  })

  const { data: jobs } = useQuery({
    queryKey: ['rider-jobs', rider?.id],
    queryFn: () => fulfillmentApi.myJobs(rider!.id),
    enabled: !!rider,
    refetchInterval: 5_000,
  })

  const job = jobs?.find(j => j.id === jobId)

  const { data: order } = useQuery({
    queryKey: ['order', job?.orderId],
    queryFn: () => ordersApi.get(job!.orderId),
    enabled: !!job?.orderId,
  })

  // Auto-ping GPS while delivering
  useEffect(() => {
    if (job?.status !== 'picked_up' || !job.orderId) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
        setGpsStatus('waiting')
      }
      return
    }

    if (!navigator.geolocation) { setGpsStatus('denied'); return }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLastPing({ lat, lng })
        setGpsStatus('active')
        fulfillmentApi.ping(job.orderId, lat, lng).catch(() => null)
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    )

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [job?.status, job?.orderId])

  const { mutate: confirmPickup, isPending: pickingUp } = useMutation({
    mutationFn: () => fulfillmentApi.pickup(jobId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider-jobs'] }),
  })

  const { mutate: confirmDelivery, isPending: delivering } = useMutation({
    mutationFn: () => fulfillmentApi.deliver(jobId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-jobs'] })
      qc.invalidateQueries({ queryKey: ['rider-me'] })
      navigate('/rider')
    },
  })

  const mapsUrl = lastPing
    ? `https://www.google.com/maps/dir/?api=1&destination=${lastPing.lat},${lastPing.lng}`
    : order
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`
      : null

  if (!job) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-gray-400">Loading job…</p>
        <Link to="/rider" className="text-green-600 text-sm mt-4 block">← Back</Link>
      </div>
    )
  }

  const isAssigned  = job.status === 'assigned'
  const isPickedUp  = job.status === 'picked_up'
  const isDelivered = job.status === 'delivered'

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/rider" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        <Badge status={job.status} />
      </div>

      {/* Progress steps */}
      <div className="bg-white border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <StepDot done={!isAssigned} active={isAssigned} />
          <div>
            <p className="font-semibold text-gray-800">
              {isAssigned ? 'Go to store' : 'Picked up ✓'}
            </p>
            <p className="text-xs text-gray-400 font-mono">
              Tenant {job.tenantId.slice(0, 8)}…
            </p>
          </div>
        </div>
        <div className="ml-4 border-l-2 border-dashed border-gray-200 h-5" />
        <div className="flex items-center gap-3">
          <StepDot done={isDelivered} active={isPickedUp} />
          <div>
            <p className={`font-semibold ${isPickedUp || isDelivered ? 'text-gray-800' : 'text-gray-400'}`}>
              {isDelivered ? 'Delivered ✓' : 'Deliver to customer'}
            </p>
            {order && (
              <p className="text-xs text-gray-500">{order.deliveryAddress}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order details */}
      {order && (
        <div className="bg-white border rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Order #{order.id.slice(0, 8)}…</p>
          <p className="font-semibold text-green-700 text-lg">${(order.totalMinor / 100).toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">{order.deliveryAddress}</p>
        </div>
      )}

      {/* GPS status (only while delivering) */}
      {isPickedUp && (
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${
          gpsStatus === 'active'  ? 'bg-green-50 border border-green-200' :
          gpsStatus === 'denied'  ? 'bg-red-50 border border-red-200' :
                                    'bg-gray-50 border'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            gpsStatus === 'active' ? 'bg-green-500 animate-pulse' :
            gpsStatus === 'denied' ? 'bg-red-500' : 'bg-gray-300'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">
              {gpsStatus === 'active'  ? 'GPS tracking active' :
               gpsStatus === 'denied'  ? 'GPS access denied' :
                                         'Acquiring GPS…'}
            </p>
            {lastPing && (
              <p className="text-xs text-gray-400 font-mono truncate">
                {lastPing.lat.toFixed(5)}, {lastPing.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Maps link */}
      {mapsUrl && !isDelivered && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="block text-center bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700">
          Open in Google Maps
        </a>
      )}

      {/* Action button */}
      {isAssigned && (
        <button
          onClick={() => confirmPickup()}
          disabled={pickingUp}
          className="w-full bg-yellow-500 text-white rounded-xl py-4 font-bold text-lg hover:bg-yellow-600 disabled:opacity-50 shadow-lg"
        >
          {pickingUp ? 'Confirming…' : '📦  Confirm Pickup'}
        </button>
      )}

      {isPickedUp && (
        <button
          onClick={() => confirmDelivery()}
          disabled={delivering}
          className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow-lg"
        >
          {delivering ? 'Confirming…' : '✅  Confirm Delivery'}
        </button>
      )}

      {isDelivered && (
        <div className="text-center py-6">
          <p className="text-4xl mb-2">🎉</p>
          <p className="font-bold text-green-700 text-lg">Delivery complete!</p>
          <Link to="/rider" className="block mt-4 text-green-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      )}
    </div>
  )
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  if (done)   return <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><span className="text-white text-xs">✓</span></div>
  if (active) return <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 flex-shrink-0 animate-pulse" />
  return        <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
}
