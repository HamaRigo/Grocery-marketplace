export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-line bg-surface-raised p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex justify-between pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  )
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted" role="status">
      <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
