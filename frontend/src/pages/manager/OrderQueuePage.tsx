import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi, type Order } from '../../api/orders'
import { useAuth } from '../../context/auth'
import Badge from '../../components/Badge'

const COLUMNS: Array<{ status: string; label: string; actions: string[] }> = [
  { status: 'placed',    label: 'New',       actions: ['accept', 'reject'] },
  { status: 'accepted',  label: 'Accepted',  actions: ['preparing'] },
  { status: 'preparing', label: 'Preparing', actions: ['ready'] },
  { status: 'ready',     label: 'Ready',     actions: [] },
]

const ACTION_LABELS: Record<string, string> = {
  accept: 'Accept',
  reject: 'Reject',
  preparing: 'Start Prep',
  ready: 'Mark Ready',
}

const ACTION_FN: Record<string, (id: string) => Promise<Order | { ok: boolean }>> = {
  accept:    (id) => ordersApi.accept(id),
  reject:    (id) => ordersApi.reject(id),
  preparing: (id) => ordersApi.preparing(id),
  ready:     (id) => ordersApi.ready(id),
}

function CurbsideBadge({ checkedIn }: { checkedIn: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      checkedIn ? 'bg-orange-100 text-orange-700 animate-pulse' : 'bg-yellow-100 text-yellow-700'
    }`}>
      🚗 {checkedIn ? 'Outside!' : 'Curbside'}
    </span>
  )
}

function OrderCard({ order, actions, onAction, onHandoff }: {
  order: Order
  actions: string[]
  onAction: (action: string, id: string) => void
  onHandoff: (id: string) => void
}) {
  const isCurbside = order.fulfillmentType === 'curbside'
  const v = order.curbsideVehicle

  return (
    <div className={`bg-white rounded-lg p-3 shadow-sm border ${
      isCurbside && order.checkedIn ? 'border-orange-300' : ''
    }`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-400">{order.id.slice(0, 8)}…</p>
        {isCurbside && <CurbsideBadge checkedIn={order.checkedIn} />}
      </div>

      {isCurbside ? (
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-800">{order.curbsideName}</p>
          {v && (
            <p className="text-xs text-gray-500">
              {v.color} {v.make} {v.model}{v.plate ? ` · ${v.plate}` : ''}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            Pay: {order.paymentMethod}
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-gray-800 mb-1 truncate">
          {(order as any).addressGeo?.address ?? 'Delivery'}
        </p>
      )}

      <p className="text-sm font-semibold text-green-700 mb-2">
        ${(order.totalMinor / 100).toFixed(2)}
      </p>

      <div className="flex flex-wrap gap-1">
        {actions.map(action => (
          <button
            key={action}
            onClick={() => onAction(action, order.id)}
            className={`px-2 py-0.5 text-xs rounded font-medium ${
              action === 'reject'
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}

        {isCurbside && order.status === 'ready' && (
          <button
            onClick={() => onHandoff(order.id)}
            className="px-2 py-0.5 text-xs rounded font-medium bg-orange-500 text-white hover:bg-orange-600"
          >
            Hand Off
          </button>
        )}
      </div>

      {isCurbside && order.checkedIn && order.status === 'ready' && (
        <p className="mt-2 text-xs text-orange-600 font-medium">Customer is waiting outside!</p>
      )}
    </div>
  )
}

export default function OrderQueuePage() {
  const { tenantId } = useAuth()
  const qc = useQueryClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-queue', tenantId],
    queryFn: () => ordersApi.listTenant(tenantId ?? ''),
    refetchInterval: 8_000,
    staleTime:       4_000, // don't refetch on focus if data was fetched less than 4s ago
    enabled: !!tenantId,
  })

  const { mutate: doAction } = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) => ACTION_FN[action](id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-queue', tenantId] }),
  })

  const { mutate: doHandoff } = useMutation({
    mutationFn: (id: string) => ordersApi.handoff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-queue', tenantId] }),
  })

  if (!tenantId) {
    return <p className="text-red-500">No store assigned to your account.</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Queue</h1>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const colOrders = orders?.filter((o: Order) => o.status === col.status) ?? []
          return (
            <div key={col.status} className="bg-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700 text-sm">{col.label}</h2>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {colOrders.length}
                </span>
              </div>

              <div className="space-y-2">
                {colOrders.map((order: Order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    actions={col.actions}
                    onAction={(action, id) => doAction({ action, id })}
                    onHandoff={(id) => doHandoff(id)}
                  />
                ))}
                {colOrders.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Empty</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">In Transit / Delivered</h2>
        <div className="space-y-2">
          {orders
            ?.filter((o: Order) => ['assigned', 'out_for_delivery', 'delivered'].includes(o.status))
            .map((order: Order) => (
              <div key={order.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{order.id.slice(0, 8)}…</span>
                  {order.fulfillmentType === 'curbside' ? (
                    <span className="text-sm text-gray-700">{order.curbsideName} · 🚗</span>
                  ) : (
                    <span className="text-sm text-gray-700">{(order as any).addressGeo?.address}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-green-700">
                    ${(order.totalMinor / 100).toFixed(2)}
                  </span>
                  <Badge status={order.status} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
