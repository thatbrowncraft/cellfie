import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn } from '../utils/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
  /** Non-destructive dialogs close on Esc; destructive ones should require an explicit action. */
  closeOnEscape?: boolean
  /** 'md' (default) fits confirmations/forms; 'lg' fits content with lists, e.g. multi-file import. */
  size?: 'md' | 'lg'
}

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-2xl'
}

/**
 * Dialog — Design System §10.19.
 * Centered, elevation-3, warm dark scrim (never pure black). Focus trapped
 * inside; focus returns to trigger on close.
 */
export function Dialog({ open, onClose, title, children, actions, closeOnEscape = true, size = 'md' }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, open)

  useEffect(() => {
    if (!open || !closeOnEscape) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeOnEscape, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={cn('flex max-h-[85vh] w-full flex-col rounded-lg bg-surface p-6 shadow-3', sizeClasses[size])}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="font-display text-h3 font-medium text-ink-primary">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-ink-tertiary hover:text-ink-primary">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto font-body text-body text-ink-secondary">{children}</div>

        {actions && <div className="mt-6 flex justify-end gap-3">{actions}</div>}
      </div>
    </div>
  )
}
