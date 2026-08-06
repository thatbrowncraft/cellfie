import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Bottom Sheet — Design System §10.20. Mobile equivalent of Dialogs.
 * Slides up from bottom, rounded top corners only, drag handle indicator.
 * Snaps open/closed — no partial-height "peek" state, per spec.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-lg bg-surface p-6 pb-8 shadow-3 animate-in-up"
      >
        <div className="mb-4 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-border-strong" aria-hidden />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="sheet-title" className="font-display text-h3 font-medium text-ink-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="font-ui text-ui text-olive underline underline-offset-4"
            aria-label="Dismiss"
          >
            Done
          </button>
        </div>
        <div className="font-body text-body text-ink-secondary">{children}</div>
      </div>
    </div>
  )
}
