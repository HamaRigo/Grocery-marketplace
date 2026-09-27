import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi, type AdminOrderRow } from '../../api/orders'
import { billingApi } from '../../api/billing'
import Badge from '../../components/Badge'
import { formatMinor } from '../../lib/money'

const FILTERS = [
  { label: 'All',      value: undefined },
  { label: 'Paid',     value: 'captured' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Failed',   value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
] as const

export default function AdminOrdersPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const [refunding, setRefunding] = useState<{ orderId: string; value: string } | null>(null)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['orders-admin', filter],
    queryFn: () => ordersApi.listAdmin(filter),
  })

  const { mutate: refund, isPending: refundPending } = useMutation({
    mutationFn: ({ orderId, amountMinor }: { orderId: string; amountMinor?: number }) =>
      billingApi.refund(orderId, amountMinor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders-admin'] })
      setRefunding(null)
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Orders</h1>

      <div className="flex gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium ${
              filter === f.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-line text-ink-muted hover:border-indigo-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-ink-muted">Loading…</p>}

      <div className="bg-surface-raised rounded-card border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Order</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Store</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Payment</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Transaction</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows?.map((row: AdminOrderRow) => {
              const p = row.payment
              const remaining = p ? p.amountMinor - p.refundedMinor : 0
              const canRefund = p?.status === 'captured' || p?.status === 'partially_refunded'
              return (
                <tr key={row.order.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{row.order.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ink-muted">{row.storeName ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{row.customerEmail ?? row.order.curbsideName ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p ? formatMinor(p.amountMinor) : formatMinor(row.order.totalMinor)}
                    {p && p.refundedMinor > 0 && (
                      <span className="text-xs text-red-500 block">-{formatMinor(p.refundedMinor)} refunded</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p ? <Badge status={p.status} /> : <span className="text-ink-faint">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{p?.stripePaymentIntentId ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(row.order.placedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {canRefund && (
                      refunding?.orderId === row.order.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number" min={0.01} max={remaining / 100} step={0.01}
                            value={refunding.value}
                            onChange={e => setRefunding({ orderId: row.order.id, value: e.target.value })}
                            className="border rounded px-2 py-1 text-xs w-20"
                            autoFocus
                          />
                          <button
                            disabled={refundPending}
                            onClick={() => refund({ orderId: row.order.id, amountMinor: Math.round(Number(refunding.value) * 100) })}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Confirm
                          </button>
                          <button onClick={() => setRefunding(null)} className="text-xs text-ink-faint hover:underline">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={refundPending}
                            onClick={() => refund({ orderId: row.order.id })}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => setRefunding({ orderId: row.order.id, value: String(remaining / 100) })}
                            className="px-2 py-1 text-xs border text-ink-muted rounded hover:bg-surface-muted font-medium"
                          >
                            Partial
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows?.length === 0 && !isLoading && (
          <p className="text-center text-ink-faint py-8">No orders found.</p>
        )}
      </div>
    </div>
  )
}
