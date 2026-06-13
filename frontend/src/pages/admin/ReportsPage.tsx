import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../api/reports'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const month = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const [from, setFrom] = useState(month)
  const [to, setTo]     = useState(today)

  const { data: overview } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: reportsApi.overview,
    refetchInterval: 60_000,
  })

  const { data: revenue } = useQuery({
    queryKey: ['reports-revenue', from, to],
    queryFn: () => reportsApi.revenue(from, to),
    enabled: !!from && !!to,
  })

  const { data: stores } = useQuery({
    queryKey: ['reports-stores'],
    queryFn: reportsApi.storeBreakdown,
  })

  const totalOrders = overview
    ? Object.values(overview.ordersByStatus).reduce((a, b) => a + b, 0)
    : '—'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Total Orders"      value={totalOrders} />
        <StatCard label="Revenue"           value={overview ? `$${overview.capturedRevenueMajor.toFixed(2)}`   : '—'} />
        <StatCard label="Commission Earned" value={overview ? `$${overview.commissionEarnedMajor.toFixed(2)}` : '—'} />
        <StatCard label="Unpaid Commission" value={overview ? `$${overview.commissionUnpaidMajor.toFixed(2)}` : '—'} />
        <StatCard label="Active Stores" value={overview?.storeCount ?? '—'} />
        <StatCard label="Users"         value={overview?.userCount  ?? '—'} />
      </div>

      <div className="mb-8">
        <div className="flex items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {revenue?.map(row => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{row.date}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">
                    ${row.revenueMajor.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {revenue?.length === 0 && (
            <p className="text-center text-gray-400 py-6">No revenue data for this period.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Store Breakdown</h2>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Store ID</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Orders</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stores?.map(row => (
                <tr key={row.tenantId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 font-mono text-xs">{row.tenantId.slice(0, 12)}…</td>
                  <td className="px-4 py-2 text-right text-gray-700">{row.orderCount}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">
                    ${row.revenueMajor.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stores?.length === 0 && (
            <p className="text-center text-gray-400 py-6">No data yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
