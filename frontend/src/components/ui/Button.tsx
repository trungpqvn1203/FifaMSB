import React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'neon' | 'outline' | 'ghost' | 'danger' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'neon', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-display font-semibold transition-all duration-200 uppercase tracking-wider rounded-md focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none'

    const variants = {
      neon: 'bg-neon text-black hover:bg-neon-hover shadow-glow-neon hover:shadow-[0_0_20px_rgba(61,255,107,0.5)] active:scale-[0.98]',
      outline:
        'border border-border-default bg-surface-card/60 text-white hover:border-border-prominent hover:bg-surface-elevated active:scale-[0.98]',
      ghost: 'text-zinc-400 hover:text-white hover:bg-surface-card active:scale-[0.98]',
      danger:
        'border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20 shadow-glow-danger active:scale-[0.98]',
      gold: 'border border-warning/50 bg-warning/10 text-warning hover:bg-warning/20 shadow-glow-gold active:scale-[0.98]',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 mr-1 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
