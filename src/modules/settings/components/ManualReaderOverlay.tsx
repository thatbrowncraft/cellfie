import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from '@phosphor-icons/react'
import { loadPdfDocument } from '@/core/pdf-engine'
import { ReaderCanvas, type FitMode } from '@/modules/library/reader/ReaderCanvas'
import { EmptyState, Tooltip } from '@/shared/components'
import { useFocusTrap } from '@/shared/hooks'
import { useIsStandalonePwa } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/utils/cn'

interface ManualReaderOverlayProps {
  open: boolean
  onClose: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_STEP = 1.2

// Bundled as a static asset (public/manual), not a Library import — this
// is the app's own manual, not a user's book, so it deliberately bypasses
// LibraryItem/OPFS/IndexedDB entirely. `import.meta.env.BASE_URL` keeps
// this correct under vite.config.ts's GitHub Pages BASE_PATH, same as any
// other public/ asset reference.
const MANUAL_PDF_URL = `${import.meta.env.BASE_URL}manual/cellfie-user-manual.pdf`

const iconButton =
  'rounded-sm p-2 text-ink-secondary hover:bg-surface-raised hover:text-ink-primary disabled:opacity-40 disabled:pointer-events-none'

const fitButton = (active: boolean) =>
  cn(
    'rounded-sm px-3 py-2 font-ui text-caption font-medium transition-colors duration-micro',
    active ? 'bg-surface-raised text-ink-primary' : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
  )

/**
 * Settings → Cellfie User Manual → "Read Manual".
 *
 * A dedicated full-screen reading surface for the app's own bundled PDF,
 * built on the same `core/pdf-engine` + `ReaderCanvas` the Library reader
 * (`ReaderPage`) uses for user books — so the manual renders as real PDF
 * pages, at full width, with working page navigation and zoom, instead of
 * a re-typeset copy. It intentionally reuses only the rendering layer:
 * none of `ReaderPage`'s LibraryItem/IndexedDB-backed bookmarks,
 * highlights, or notes apply here, since this isn't a Library item and
 * nothing about reading the manual needs to be saved.
 *
 * No download/export/share action anywhere in this view, by design — see
 * the manual-addition spec this was built against. The PDF is fetched
 * once from the bundled public asset into memory and handed to PDF.js as
 * a Blob; nothing here writes it back to disk or exposes a save path.
 */
export function ManualReaderOverlay({ open, onClose }: ManualReaderOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, open)
  const isStandalone = useIsStandalonePwa()

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(false)
    setPage(1)
    setFitMode('width')

    fetch(MANUAL_PDF_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Manual fetch failed: ${res.status}`)
        return res.blob()
      })
      .then((blob) => loadPdfDocument(blob))
      .then((loadedDoc) => {
        if (cancelled) {
          void loadedDoc.destroy()
          return
        }
        setDoc(loadedDoc)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  // Release the PDF.js document's worker-side resources once the overlay
  // is closed or unmounted, mirroring usePdfDocument's cleanup.
  useEffect(() => {
    const toDestroy = doc
    return () => {
      void toDestroy?.destroy()
    }
  }, [doc])

  useEffect(() => {
    if (!open) {
      setDoc(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock the underlying Settings page's scroll while the reader is open —
  // same reasoning as Dialog.tsx (prevents an Android touch-scroll from
  // moving the page behind a fixed-position overlay).
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const numPages = doc?.numPages ?? null

  useEffect(() => {
    if (numPages && page > numPages) setPage(numPages)
  }, [numPages, page])

  if (!open) return null

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))
  }
  function zoomIn() {
    setFitMode('custom')
    setScale((s) => Math.min(s * ZOOM_STEP, MAX_SCALE))
  }
  function zoomOut() {
    setFitMode('custom')
    setScale((s) => Math.max(s / ZOOM_STEP, MIN_SCALE))
  }

  // Portaled straight onto document.body, same reasoning as Dialog.tsx:
  // this can never be clipped or repositioned by whatever ancestor
  // happens to render the Settings page, and the standalone-PWA `dvh`
  // caveat documented there applies identically here.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Cellfie User Manual"
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-canvas"
      style={isStandalone ? {} : { height: '100dvh' }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip label="Close and return to Settings">
            <button type="button" onClick={onClose} aria-label="Close manual and return to Settings" className={iconButton}>
              <X size={20} />
            </button>
          </Tooltip>
          <h1 className="truncate font-display text-h3 font-medium text-ink-primary">Cellfie User Manual</h1>
        </div>

        {!error && numPages ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              <Tooltip label="Previous page">
                <button type="button" onClick={goPrev} disabled={page <= 1} aria-label="Previous page" className={iconButton}>
                  <CaretLeft size={18} />
                </button>
              </Tooltip>
              <span className="font-ui text-caption text-ink-secondary" aria-live="polite">
                {page} / {numPages}
              </span>
              <Tooltip label="Next page">
                <button
                  type="button"
                  onClick={goNext}
                  disabled={page >= numPages}
                  aria-label="Next page"
                  className={iconButton}
                >
                  <CaretRight size={18} />
                </button>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1 border-l border-border pl-4">
              <Tooltip label="Zoom out">
                <button type="button" onClick={zoomOut} aria-label="Zoom out" className={iconButton}>
                  <MagnifyingGlassMinus size={18} />
                </button>
              </Tooltip>
              <span className="w-12 text-center font-ui text-caption text-ink-secondary">{Math.round(scale * 100)}%</span>
              <Tooltip label="Zoom in">
                <button type="button" onClick={zoomIn} aria-label="Zoom in" className={iconButton}>
                  <MagnifyingGlassPlus size={18} />
                </button>
              </Tooltip>
              <button type="button" onClick={() => setFitMode('width')} className={fitButton(fitMode === 'width')}>
                Fit width
              </button>
              <button type="button" onClick={() => setFitMode('page')} className={fitButton(fitMode === 'page')}>
                Fit page
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        {error && (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              title="Couldn't open the manual"
              description="Something went wrong loading the manual. Closing and reopening this page may help."
            />
          </div>
        )}

        {!error && (loading || !doc) && (
          <div className="flex h-full items-center justify-center">
            <p className="font-ui text-caption text-ink-tertiary">Loading manual…</p>
          </div>
        )}

        {!error && !loading && doc && (
          <ReaderCanvas doc={doc} pageNumber={page} fitMode={fitMode} scale={scale} onScaleChange={setScale} onSwipeNext={goNext} onSwipePrev={goPrev} />
        )}
      </div>
    </div>,
    document.body
  )
}
