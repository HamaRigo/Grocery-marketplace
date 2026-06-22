import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulingApi } from '../../api/scheduling'

export default function SlotsPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [form, setForm] = useState({ startTime: '09:00', endTime: '10:00', capacity: 10 })
  const [adding, setAdding] = useState(false)

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['slots', tenantId, date],
    queryFn: () => schedulingApi.listSlots(tenantId!, date),
    enabled: !!tenantId && !!date,
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => schedulingApi.createSlot(tenantId!, { date, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots', tenantId, date] })
      setAdding(false)
    },
  })

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Slots</h1>
        <button onClick={() => setAdding(v => !v)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          + Add slot
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <span className="text-sm text-gray-500">{slots.length} slot{slots.length !== 1 ? 's' : ''}</span>
      </div>

      {adding && (
        <div className="bg-white border rounded-xl p-5 mb-5 space-y-3">
          <p className="font-semibold text-gray-800">New slot for {date}</p>
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
              <input type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="border rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="border rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
              <input type="number" min={1} max={200} value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                className="border rounded px-3 py-1.5 text-sm w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)}
              className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button onClick={() => create()} disabled={isPending}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="space-y-2">
        {slots.map(s => {
          const avail = s.capacity - s.bookedCount
          const full  = avail === 0
          return (
            <div key={s.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{s.startTime} – {s.endTime}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.bookedCount}/{s.capacity} booked
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${full ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {full ? 'Full' : `${avail} left`}
              </span>
            </div>
          )
        })}
        {slots.length === 0 && !isLoading && (
          <p className="text-gray-400 text-sm text-center py-6">No slots for this date.</p>
        )}
      </div>
    </div>
  )
}
