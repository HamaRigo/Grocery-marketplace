const palette: Record<string, string> = {
  placed:           'bg-blue-100 text-blue-800',
  accepted:         'bg-indigo-100 text-indigo-800',
  preparing:        'bg-yellow-100 text-yellow-800',
  ready:            'bg-orange-100 text-orange-800',
  assigned:         'bg-purple-100 text-purple-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered:        'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-800',
  rejected:         'bg-red-100 text-red-800',
  active:           'bg-green-100 text-green-800',
  pending:          'bg-yellow-100 text-yellow-800',
  suspended:        'bg-red-100 text-red-800',
}

export default function Badge({ status }: { status: string }) {
  const cls = palette[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
