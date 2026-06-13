import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fulfillmentApi, type Job } from '../../api/fulfillment'
import Badge from '../../components/Badge'

const STATUS_COLOR = {
  online:  'bg-green-500',
  offline: 'bg-gray-400',
  busy:    'bg-yellow-500',
}

const ACTIVE_STATUSES: Job['status'][] = ['assigned', 'picked_up']

export default function RiderPage() {
  const qc = useQueryClient()

  const { data: rider, isLoading: riderLoading, error: riderError } = useQuery({
    queryKey: ['rider-me'],
    queryFn: fulfillmentApi.me,
  })

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['rider-jobs', rider?.id],
    queryFn: () => fulfillmentApi.myJobs(rider!.id),
    enabled: !!rider,
    refetchInterval: 8_000,
  })

  const { mutate: toggleStatus, isPending: togglingStatus } = useMutation({
    mutationFn: () => {
      const next = rider!.status === 'online' ? 'offline' : 'online'
      return fulfillmentApi.setStatus(rider!.id, next)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider-me'] }),
  })

  if (riderLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (riderError || !rider) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-6">
        <p className="text-4xl mb-4">🛵</p>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">No rider account found</h2>
        <p className="text-sm text-gray-500">Ask your store manager to register you as a rider.</p>
      </div>
    )
  }

  const activeJob  = jobs?.find(j => ACTIVE_STATUSES.includes(j.status)) ?? null
  const recentJobs = jobs?.filter(j => !ACTIVE_STATUSES.includes(j.status)).slice(0, 5) ?? []

  return (
    <div className="max-w-md mx-auto space-y-5">

      {/* Status card */}
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Vehicle</p>
            <p className="font-semibold text-gray-800">{rider.vehicle ?? 'Not specified'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[rider.status]}`} />
            <span className="text-sm font-medium capitalize text-gray-700">{rider.status}</span>
          </div>
        </div>

        <button
          onClick={() => toggleStatus()}
          disabled={togglingStatus || rider.status === 'busy'}
          className={`w-full py-3 rounded-xl text-white font-semibold text-base transition disabled:opacity-50 ${
            rider.status === 'online'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {togglingStatus
            ? 'Updating…'
            : rider.status === 'online'
              ? 'Go Offline'
              : rider.status === 'busy'
                ? 'On delivery…'
                : 'Go Online'}
        </button>
      </div>

      {/* Active job */}
      {activeJob && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-green-800 text-base">Active Delivery</h2>
            <Badge status={activeJob.status} />
          </div>
          <p className="text-xs text-gray-500 mb-4 font-mono">
            Job {activeJob.id.slice(0, 8)}… · Order {activeJob.orderId.slice(0, 8)}…
          </p>
          <Link
            to={`/rider/job/${activeJob.id}`}
            className="block text-center bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition"
          >
            {activeJob.status === 'assigned' ? 'Go to Pickup →' : 'Continue Delivery →'}
          </Link>
        </div>
      )}

      {/* No active job */}
      {!activeJob && rider.status === 'online' && (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <p className="text-3xl mb-2">🟢</p>
          <p className="text-gray-600 font-medium">You're online</p>
          <p className="text-sm text-gray-400 mt-1">Waiting for the next delivery…</p>
        </div>
      )}

      {/* Recent deliveries */}
      {recentJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
            Recent
          </h3>
          <div className="space-y-2">
            {recentJobs.map(job => (
              <div key={job.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}…</p>
                  {job.deliveredAt && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(job.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Badge status={job.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {jobsLoading && (
        <p className="text-center text-sm text-gray-400">Loading jobs…</p>
      )}
    </div>
  )
}
