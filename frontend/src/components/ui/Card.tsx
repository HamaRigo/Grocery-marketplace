import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export default function Card({
  hover,
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={[
        'bg-surface-raised border border-line rounded-card shadow-soft',
        hover ? 'transition-all duration-200 hover:shadow-lift hover:border-line-strong hover:-translate-y-0.5' : '',
        paddings[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
