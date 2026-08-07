import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { renderPageToCanvas } from '@/core/pdf-engine'
import { cn } from '@/shared/utils/cn'

interface ReaderThumbnailProps {
  doc: PDFDocumentProxy
  pageNumber: number
  active: boolean
  onSelect: (page: number) => void
}

const THUMB_SCALE = 0.2

/**
 * One entry in the sidebar's Pages tab. Renders its canvas only once it's
 * scrolled near-into view (IntersectionObserver) and caches the result —
 * a textbook can easily run to hundreds of pages, so eagerly rendering
 * every thumbnail up front would stall the sidebar.
 */
export function ReaderThumbnail({ doc, pageNumber, active, onSelect }: ReaderThumbnailProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const el = triggerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true)
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || rendered || !canvasRef.current) return
    let task: RenderTask | undefined
    let cancelled = false

    renderPageToCanvas(doc, pageNumber, canvasRef.current, THUMB_SCALE)
      .then((t) => {
        task = t
        return t.promise
      })
      .then(() => {
        if (!cancelled) setRendered(true)
      })
      .catch(() => {
        // RenderingCancelledException on fast scroll, or a transient
        // failure — either way the placeholder stays, harmless.
      })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, rendered, doc, pageNumber])

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-current={active}
      aria-label={`Go to page ${pageNumber}`}
      className={cn(
        'flex w-full items-center gap-3 rounded-sm border p-2 text-left transition-colors duration-micro',
        active ? 'border-terracotta bg-surface-raised' : 'border-border hover:bg-surface-raised'
      )}
    >
      <span className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-white">
        {visible ? (
          <canvas ref={canvasRef} className="max-h-full max-w-full" />
        ) : (
          <span className="h-full w-full animate-pulse bg-surface-raised" aria-hidden />
        )}
      </span>
      <span className="font-ui text-caption text-ink-secondary">Page {pageNumber}</span>
    </button>
  )
}
