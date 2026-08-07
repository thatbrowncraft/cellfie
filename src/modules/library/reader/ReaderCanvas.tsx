import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { getPageSize, renderPageToCanvas } from '@/core/pdf-engine'

export type FitMode = 'width' | 'page' | 'custom'

interface ReaderCanvasProps {
  doc: PDFDocumentProxy
  pageNumber: number
  fitMode: FitMode
  /** Only used when fitMode === 'custom'; ignored (but still reported back) otherwise. */
  scale: number
  /** Reports the scale actually used to render — lets the toolbar show a live zoom %. */
  onScaleChange: (scale: number) => void
}

// Breathing room around the page inside the scrollable viewport, so a
// fit-width/fit-page page never touches the pane edges.
const PAGE_PADDING = 32

/**
 * Renders the current page onto a canvas, recomputing scale for
 * fit-width/fit-page modes from the container's measured size. Scrolls
 * internally so a manually zoomed-in page can be panned without affecting
 * the rest of the reader.
 */
export function ReaderCanvas({ doc, pageNumber, fitMode, scale, onScaleChange }: ReaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setNaturalSize(null)
    getPageSize(doc, pageNumber).then((size) => {
      if (!cancelled) setNaturalSize(size)
    })
    return () => {
      cancelled = true
    }
  }, [doc, pageNumber])

  const effectiveScale = (() => {
    if (fitMode === 'custom' || !naturalSize || !containerSize) return scale
    const availWidth = Math.max(containerSize.width - PAGE_PADDING, 100)
    const availHeight = Math.max(containerSize.height - PAGE_PADDING, 100)
    if (fitMode === 'width') return availWidth / naturalSize.width
    return Math.min(availWidth / naturalSize.width, availHeight / naturalSize.height)
  })()

  useEffect(() => {
    if (effectiveScale > 0) onScaleChange(effectiveScale)
    // onScaleChange intentionally excluded — it's a setState setter from
    // the parent and including it would just re-trigger this on every
    // parent render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || effectiveScale <= 0) return
    let task: RenderTask | undefined

    renderPageToCanvas(doc, pageNumber, canvas, effectiveScale)
      .then((t) => {
        task = t
        return t.promise
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'RenderingCancelledException') return
        console.error('PDF page render failed:', err)
      })

    return () => {
      task?.cancel()
    }
  }, [doc, pageNumber, effectiveScale])

  return (
    <div ref={containerRef} className="flex h-full w-full items-start justify-center overflow-auto bg-canvas p-4">
      <canvas ref={canvasRef} className="rounded-sm border border-border bg-white shadow-1" />
    </div>
  )
}
