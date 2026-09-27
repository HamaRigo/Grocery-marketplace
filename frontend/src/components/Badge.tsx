import type { ReactNode } from 'react'

const palette: Record<string, string> = {
  pending_payment:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  payment_failed:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  placed:           'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  accepted:         'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  preparing:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  ready:            'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  assigned:         'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  out_for_delivery: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  delivered:        'bg-brand-100 text-brand-800 dark:bg-brand-200 dark:text-brand-900',
  cancelled:        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  rejected:         'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  active:           'bg-brand-100 text-brand-800 dark:bg-brand-200 dark:text-brand-900',
  pending:          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  suspended:        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  captured:         'bg-brand-100 text-brand-800',
  refunded:         'bg-violet-100 text-violet-800',
  partially_refunded: 'bg-violet-100 text-violet-800',
  trialing:         'bg-sky-100 text-sky-800',
  past_due:         'bg-orange-100 text-orange-800',
  unpaid:           'bg-red-100 text-red-800',
  incomplete:       'bg-surface-muted text-ink-muted',
}

interface BadgeProps {
  status?: string
  children?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
  className?: string
}

const tones = {
  neutral: 'bg-surface-muted text-ink-muted',
  success: 'bg-brand-100 text-brand-800',
  warning: 'bg-amber-100 text-amber-800',
  danger:  'bg-red-100 text-red-800',
  info:    'bg-sky-100 text-sky-800',
  brand:   'bg-brand-100 text-brand-800',
}

export default function Badge({ status, children, tone, className = '' }: BadgeProps) {
  const cls = tone
    ? tones[tone]
    : status
      ? (palette[status] ?? 'bg-surface-muted text-ink-muted')
      : tones.neutral

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-semibold capitalize ${cls} ${className}`}>
      {children ?? (status ? status.replace(/_/g, ' ') : null)}
    </span>
  )
}
