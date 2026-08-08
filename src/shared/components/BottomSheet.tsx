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
        // Mobile scroll-container bugfix: this box used to have no height
        // cap, so long content (e.g. a 1000+ page thumbnail list) grew the
        // sheet taller than the viewport with nowhere of its own to
        // scroll — the gesture meant for this content could instead land
        // on the page/document scroll behind it. Capping the sheet and
        // giving only its content area `overflow-y-auto` (below) makes
        // this one bounded, self-contained scroll region, matching how
        // the desktop split-panel equivalent already behaves.
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-lg bg-surface p-6 pb-8 shadow-3 animate-in-up"
      >
        <div className="mb-4 flex shrink-0 justify-center">
          <div className="h-1.5 w-10 rounded-full bg-border-strong" aria-hidden />
        </div>
        <div className="mb-4 flex shrink-0 items-center justify-between">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain font-body text-body text-ink-secondary">
          {children}
        </div>
      </div>
    </div>
  )
}
