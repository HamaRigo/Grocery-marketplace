import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  icon?: ReactNode
}

export default function Chip({ active, icon, children, className = '', ...props }: ChipProps) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-medium border transition-all duration-200',
        active
          ? 'bg-brand-600 text-white border-brand-600 shadow-soft'
          : 'bg-surface-raised text-ink-muted border-line hover:border-brand-300 hover:text-brand-700',
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  )
}
