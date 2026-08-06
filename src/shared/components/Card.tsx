import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  disabled?: boolean
  children: ReactNode
}

/**
 * Card — Design System §10.2. Used for Library items, Learn previews,
 * organism entries, collections. Rests at elevation-0, lifts to
 * elevation-1 with a 2px upward translate on hover when interactive.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, disabled = false, className, children, tabIndex, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      tabIndex={interactive && !disabled ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        'rounded-md border border-border bg-surface p-5 transition-all duration-standard ease-standard',
        interactive &&
          !disabled &&
          'cursor-pointer hover:shadow-1 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-terracotta',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
})

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-3', className)}>{children}</div>
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-4 flex items-center gap-3', className)}>{children}</div>
}
