import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

  // Mobile modal overflow bugfix: lock the underlying page's scroll while
  // the dialog is open. Without this, a touch-scroll gesture over the
  // dialog's own scrim (or the reader page behind it) can move the real
  // page scroll position on Android; combined with `100vh`-based sizing
  // that doesn't account for the browser's collapsing/expanding address
  // bar, that's what let the dialog appear to drift and clip its own
  // header/footer instead of staying pinned to the visible viewport.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  // Mobile modal overflow bugfix: rendered via a portal straight onto
  // `document.body` rather than in place in the React tree. This dialog
  // is used from inside the PDF reader (`ReaderPage`), and `position:
  // fixed` only measures against the real viewport as long as no
  // ancestor establishes its own containing block (a CSS `transform`,
  // `filter`, or `overflow` other than `visible`) — the reader's own
  // scrollable/zoomable page container is exactly that kind of ancestor.
  // Portaling sidesteps the question entirely: this dialog can never be
  // clipped or repositioned by whatever ancestor happens to render it,
  // now or in any future change to the reader's layout.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'var(--scrim)', height: '100dvh' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-surface p-6 shadow-3',
          sizeClasses[size]
        )}
        // `100dvh` (dynamic viewport height) rather than `100vh` keeps this
        // correct as the mobile browser's address bar shows/hides, so the
        // footer (Delete/Cancel/Save) never ends up below the real visible
        // area even though `100vh` would have measured it as in-bounds.
        style={{ maxHeight: 'calc(100dvh - 24px)' }}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <h2 id="dialog-title" className="font-display text-h3 font-medium text-ink-primary">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-ink-tertiary hover:text-ink-primary">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden font-body text-body text-ink-secondary">
          {children}
        </div>

        {actions && <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </div>,
    document.body
  )
}
