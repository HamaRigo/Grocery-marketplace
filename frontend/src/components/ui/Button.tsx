import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-soft active:scale-[0.98]',
  secondary: 'bg-surface-raised text-ink border border-line hover:border-line-strong hover:bg-surface-muted active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-muted active:scale-[0.98]',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.98]',
  outline: 'bg-transparent text-brand-700 border border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-100 active:scale-[0.98]',
  /** White fill on dark/brand surfaces — dark label stays readable */
  onBrand: 'bg-white text-brand-800 font-semibold hover:bg-brand-50 shadow-none active:scale-[0.98]',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-5 py-3 text-base rounded-2xl gap-2 font-semibold',
  icon: 'p-2.5 rounded-2xl',
} as const

type Variant = keyof typeof variants
type Size = keyof typeof sizes

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={twMerge(
        'inline-flex items-center justify-center font-medium transition-all duration-200 ease-spring',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? (
        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
