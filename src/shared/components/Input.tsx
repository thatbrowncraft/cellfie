import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  helperText?: string
  error?: string
}

/**
 * Input — Design System §10.3.
 * Labels are always persistent and visible above the field — never
 * placeholder-only labeling (§13 accessibility requirement).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, id, className, ...rest },
  ref
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const helperId = `${inputId}-helper`

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-ui text-ui font-medium text-ink-primary">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={helperText || error ? helperId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          'rounded-sm border bg-canvas px-4 py-3 font-ui text-body text-ink-primary placeholder:text-ink-tertiary',
          'transition-colors duration-micro ease-standard outline-none',
          error
            ? 'border-error'
            : 'border-border focus:border-2 focus:border-olive disabled:bg-surface-raised disabled:text-ink-tertiary',
          className
        )}
        {...rest}
      />
      {(helperText || error) && (
        <span id={helperId} className={cn('font-ui text-caption', error ? 'text-error' : 'text-ink-secondary')}>
          {error ?? helperText}
        </span>
      )}
    </div>
  )
})
