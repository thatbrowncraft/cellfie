import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { getPageSize, renderPageToCanvas } from '@/core/pdf-engine'
import type { Highlight, HighlightRect } from '@/core/db'
import { TextLayer } from './TextLayer'
import { HighlightsLayer } from './HighlightsLayer'

export type FitMode = 'width' | 'page' | 'custom'

interface ReaderCanvasProps {
  doc: PDFDocumentProxy
  pageNumber: number
  fitMode: FitMode
  /** Only used when fitMode === 'custom'; ignored (but still reported back) otherwise. */
  scale: number
  /** Reports the scale actually used to render — lets the toolbar show a live zoom %. */
  onScaleChange: (scale: number) => void
  /** Highlights that live on the current page (Sprint 2 §1). */
  highlights?: Highlight[]
  /** Fires when the reader-user finishes selecting text — the reader turns this into a new Highlight. */
  onSelectionFinalize?: (text: string, rects: HighlightRect[], anchor: { x: number; y: number }) => void
  /** Fires when an existing highlight is clicked — the reader opens the edit popover, anchored at the click point. */
  onSelectHighlight?: (highlight: Highlight, anchor: { x: number; y: number }) => void
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
export function ReaderCanvas({
  doc,
  pageNumber,
  fitMode,
  scale,
  onScaleChange,
  highlights = [],
  onSelectionFinalize,
  onSelectHighlight
}: ReaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
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

  /**
   * A single click that isn't the tail end of a text-drag-selection: test
   * it against every highlight's stored rects (converted back from
   * natural-page-space to this click's coordinates) and open the popover
   * for whichever one it landed on. This is the one place in the layer
   * stack that owns click hit-testing — TextLayer only ever handles
   * mouseup-after-drag for *new* selections, never single clicks — so
   * there's no pointer-events tug-of-war between the layers.
   */
  function handlePageClick(e: ReactMouseEvent) {
    if (!onSelectHighlight || !pageRef.current || !naturalSize || effectiveScale <= 0) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) return

    const rect = pageRef.current.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / effectiveScale
    const ny = (e.clientY - rect.top) / effectiveScale

    for (const highlight of highlights) {
      const hit = highlight.rects.some((r) => nx >= r.x && nx <= r.x + r.width && ny >= r.y && ny <= r.y + r.height)
      if (hit) {
        onSelectHighlight(highlight, { x: e.clientX, y: e.clientY })
        return
      }
    }
  }

  return (
    <div ref={containerRef} className="flex h-full w-full items-start justify-center overflow-auto bg-canvas p-4">
      <div
        ref={pageRef}
        onClick={handlePageClick}
        className="relative rounded-sm border border-border bg-white shadow-1"
        style={naturalSize ? { width: naturalSize.width * effectiveScale, height: naturalSize.height * effectiveScale } : undefined}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {naturalSize && effectiveScale > 0 && (
          <>
            <HighlightsLayer highlights={highlights} naturalSize={naturalSize} scale={effectiveScale} />
            {onSelectionFinalize && (
              <TextLayer
                doc={doc}
                pageNumber={pageNumber}
                naturalSize={naturalSize}
                scale={effectiveScale}
                onSelectionFinalize={onSelectionFinalize}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
