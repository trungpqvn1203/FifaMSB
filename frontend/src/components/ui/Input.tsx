import React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-display uppercase tracking-wider text-zinc-400 font-medium">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'w-full bg-surface-card border border-border-default rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition-colors focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon font-sans disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger font-sans">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
