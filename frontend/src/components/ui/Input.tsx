import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  className?: string
}

export function Input({
  label,
  hint,
  error,
  leftIcon,
  className = '',
  id,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? props.name
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>}
      <span className="relative block">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={[
            'w-full rounded-2xl border bg-surface-raised text-ink placeholder:text-ink-faint',
            'px-3.5 py-2.5 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:border-brand-500',
            leftIcon ? 'pl-10' : '',
            error ? 'border-danger' : 'border-line',
          ].join(' ')}
        />
      </span>
      {(error || hint) && (
        <span className={`mt-1.5 block text-xs ${error ? 'text-danger' : 'text-ink-faint'}`}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

export function Select({
  label,
  hint,
  error,
  className = '',
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>}
      <select
        {...props}
        className={[
          'w-full rounded-2xl border bg-surface-raised text-ink px-3.5 py-2.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:border-brand-500',
          error ? 'border-danger' : 'border-line',
        ].join(' ')}
      >
        {children}
      </select>
      {(error || hint) && (
        <span className={`mt-1.5 block text-xs ${error ? 'text-danger' : 'text-ink-faint'}`}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

export function Textarea({
  label,
  hint,
  error,
  className = '',
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>}
      <textarea
        {...props}
        className={[
          'w-full rounded-2xl border bg-surface-raised text-ink px-3.5 py-2.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:border-brand-500',
          error ? 'border-danger' : 'border-line',
        ].join(' ')}
      />
      {(error || hint) && (
        <span className={`mt-1.5 block text-xs ${error ? 'text-danger' : 'text-ink-faint'}`}>
          {error || hint}
        </span>
      )}
    </label>
  )
}
