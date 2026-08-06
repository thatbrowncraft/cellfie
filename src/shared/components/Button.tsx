import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
type ButtonSize = 'default' | 'small'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconPosition?: 'leading' | 'trailing'
  children?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-ui text-ui font-medium ' +
  'transition-colors duration-micro ease-standard min-h-[44px] ' +
  'disabled:opacity-40 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-terracotta text-canvas hover:brightness-95 hover:shadow-1 active:brightness-90',
  secondary:
    'bg-transparent text-ink-primary border border-border-strong hover:bg-surface-raised active:bg-surface-raised',
  tertiary: 'bg-transparent text-olive hover:underline underline-offset-4 px-2',
  // Not in Design System §10.1's original three, but destructive confirmations
  // (§10.19) need a primary-weight action that reads as "dangerous," not
  // "the normal one thing that matters" — reuses color-error rather than
  // introducing a new hue, consistent with the callout/status token already
  // meaning "destructive/error" (§2, §10.10).
  destructive: 'bg-error text-canvas hover:brightness-95 hover:shadow-1 active:brightness-90'
}

const sizes: Record<ButtonSize, string> = {
  default: 'px-5 py-3',
  small: 'px-4 py-2 text-caption min-h-[36px]'
}

/**
 * Button — Design System §10.1.
 * Primary = terracotta fill (the "one loudest color" per §2.3 — use one
 * primary action per screen). Secondary = outlined. Tertiary = text-only,
 * olive. Minimum 44×44px touch target on all variants.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', icon, iconPosition = 'leading', className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], variant !== 'tertiary' && sizes[size], className)}
      {...rest}
    >
      {icon && iconPosition === 'leading' && <span aria-hidden="true">{icon}</span>}
      {children}
      {icon && iconPosition === 'trailing' && <span aria-hidden="true">{icon}</span>}
    </button>
  )
})
