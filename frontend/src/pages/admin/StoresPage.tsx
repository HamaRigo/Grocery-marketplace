import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { storesApi, type Store } from '../../api/stores'
import Badge from '../../components/Badge'

export default function AdminStoresPage() {
  const qc = useQueryClient()

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores-admin'],
    queryFn: () => storesApi.list(),
  })

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => storesApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores-admin'] }),
  })

  const { mutate: suspend } = useMutation({
    mutationFn: (id: string) => storesApi.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores-admin'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <Link to="/admin/reports"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          Reports
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Store</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Policy</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Commission</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores?.map((store: Store) => (
              <tr key={store.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{store.name}</p>
                  <p className="text-xs text-gray-400">{store.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{store.dispatchPolicy}</td>
                <td className="px-4 py-3 text-gray-600">{store.commissionBps / 100}%</td>
                <td className="px-4 py-3"><Badge status={store.status} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  {store.status === 'pending' && (
                    <button onClick={() => approve(store.id)}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
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
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
                      Reinstate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stores?.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-8">No stores yet.</p>
        )}
      </div>
    </div>
  )
}
