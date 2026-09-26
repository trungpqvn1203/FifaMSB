import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'neon' | 'danger' | 'warning' | 'cyan' | 'purple' | 'outline'
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', children, ...props }) => {
  const base =
    'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider rounded-sm select-none'

  const variants = {
    default: 'bg-surface-elevated text-zinc-300 border border-border-default',
    neon: 'bg-neon/15 text-neon border border-neon/40',
    danger: 'bg-danger/15 text-danger border border-danger/40',
    warning: 'bg-warning/15 text-warning border border-warning/40',
    cyan: 'bg-cyan/15 text-cyan border border-cyan/40',
    purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/40',
    outline: 'border border-border-default text-zinc-400',
  }

  return (
    <div className={cn(base, variants[variant], className)} {...props}>
      {children}
    </div>
  )
}
