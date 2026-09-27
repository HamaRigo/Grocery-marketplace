import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { storesApi, type Store } from '../../api/stores'
import { billingApi } from '../../api/billing'
import Badge from '../../components/Badge'
import { formatMinor } from '../../lib/money'

export default function AdminStoresPage() {
  const qc = useQueryClient()
  const [editingCommission, setEditingCommission] = useState<{ id: string; value: string } | null>(null)
  const [editingPrice, setEditingPrice] = useState<{ tenantId: string; value: string } | null>(null)

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores-admin'],
    queryFn: () => storesApi.list(),
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions-admin'],
    queryFn: () => billingApi.listSubscriptions(),
  })
  const subByTenant = new Map((subscriptions ?? []).map(row => [row.subscription.tenantId, row.subscription]))

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => storesApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores-admin'] }),
  })

  const { mutate: suspend } = useMutation({
    mutationFn: (id: string) => storesApi.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores-admin'] }),
  })

  const { mutate: saveCommission } = useMutation({
    mutationFn: ({ id, bps }: { id: string; bps: number }) =>
      storesApi.updateCommission(id, bps),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores-admin'] })
      setEditingCommission(null)
    },
  })

  const { mutate: savePrice } = useMutation({
    mutationFn: ({ tenantId, amountMinor }: { tenantId: string; amountMinor: number }) =>
      billingApi.setPrice(tenantId, amountMinor, 'QAR'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions-admin'] })
      setEditingPrice(null)
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Stores</h1>
        <Link to="/admin/reports"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          Reports
        </Link>
      </div>

      {isLoading && <p className="text-ink-muted">Loading…</p>}

      <div className="bg-surface-raised rounded-card border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Store</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Policy</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Commission</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Subscription</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores?.map((store: Store) => {
              const sub = subByTenant.get(store.id)
              const isOverdue = sub?.status === 'past_due' && sub.graceUntil
              return (
              <tr key={store.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{store.name}</p>
                  <p className="text-xs text-ink-faint">{store.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3 text-ink-muted">{store.dispatchPolicy}</td>
                <td className="px-4 py-3">
                  {editingCommission?.id === store.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} step={0.1}
                        value={editingCommission.value}
                        onChange={e => setEditingCommission({ id: store.id, value: e.target.value })}
                        className="border rounded px-2 py-1 text-xs w-16"
                        autoFocus
                      />
                      <span className="text-xs text-ink-muted">%</span>
                      <button
                        onClick={() => saveCommission({
                          id: store.id,
                          bps: Math.round(Number(editingCommission.value) * 100),
                        })}
                        className="text-xs text-brand-600 hover:underline ml-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCommission(null)}
                        className="text-xs text-ink-faint hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingCommission({
                        id: store.id,
                        value: String(store.commissionBps / 100),
                      })}
                      className="text-ink-muted hover:text-indigo-600 hover:underline"
                      title="Click to edit"
                    >
                      {store.commissionBps / 100}%
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingPrice?.tenantId === store.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} step={0.01}
                        value={editingPrice.value}
                        onChange={e => setEditingPrice({ tenantId: store.id, value: e.target.value })}
                        className="border rounded px-2 py-1 text-xs w-20"
                        autoFocus
                      />
                      <span className="text-xs text-ink-muted">QAR/mo</span>
                      <button
                        onClick={() => savePrice({
                          tenantId: store.id,
                          amountMinor: Math.round(Number(editingPrice.value) * 100),
                        })}
                        className="text-xs text-brand-600 hover:underline ml-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPrice(null)}
                        className="text-xs text-ink-faint hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setEditingPrice({
                          tenantId: store.id,
                          value: sub ? String(sub.amountMinor / 100) : '0',
                        })}
                        className="text-ink-muted hover:text-indigo-600 hover:underline"
                        title="Click to edit"
                      >
                        {sub?.amountMinor ? `${formatMinor(sub.amountMinor)}/mo` : 'No price set'}
                      </button>
                      {sub && (
                        <div className="mt-0.5">
                          <Badge status={sub.status} />
                          {isOverdue && (
                            <span className="ml-1 text-xs text-red-600">
                              overdue since {new Date(sub.graceUntil!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><Badge status={store.status} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  {store.status === 'pending' && (
                    <button onClick={() => approve(store.id)}
                      className="px-3 py-1 text-xs bg-green-100 text-brand-700 dark:text-brand-500 rounded hover:bg-green-200 font-medium">
                      Approve
                    </button>
                  )}
                  {store.status === 'active' && (
                    <button onClick={() => suspend(store.id)}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium">
                      Suspend
                    </button>
                  )}
                  {store.status === 'suspended' && (
                    <button onClick={() => approve(store.id)}
                      className="px-3 py-1 text-xs bg-green-100 text-brand-700 dark:text-brand-500 rounded hover:bg-green-200 font-medium">
                      Reinstate
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        {stores?.length === 0 && !isLoading && (
          <p className="text-center text-ink-faint py-8">No stores yet.</p>
        )}
      </div>
    </div>
  )
}
