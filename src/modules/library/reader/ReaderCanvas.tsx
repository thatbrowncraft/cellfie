import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { getPageSize, renderPageToCanvas } from '@/core/pdf-engine'
import type { Highlight, HighlightRect } from '@/core/db'
import { TextLayer, type TextLayerHandle } from './TextLayer'
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
  /** Mobile highlighting bugfix: reports live text-selection state so the toolbar can enable its Highlight button. */
  onSelectionAvailabilityChange?: (available: boolean) => void
  /** Reader Improvement §Swipe Navigation: horizontal swipe gestures — wired to the same goPrev/goNext the arrow buttons use, never a second navigation system. */
  onSwipeNext?: () => void
  onSwipePrev?: () => void
  /**
   * Reader Fix — Scroll mode: 'swipe' (default) keeps horizontal swipe navigation.
   * 'scroll' enables vertical page scrolling and triggers page turn at boundaries.
   */
  navigationMode?: 'swipe' | 'scroll'
}

export interface ReaderCanvasHandle {
  finalizeSelection: () => boolean
}

const PAGE_PADDING = 32

const DIAGNOSTICS_ENABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'pdf'

interface RenderDiagnostics {
  scale: number
  devicePixelRatio: number
  canvasWidth: number
  canvasHeight: number
  canvasStyleWidth: string
  canvasStyleHeight: string
  boundingWidth: number
  boundingHeight: number
  pageBoundingWidth: number
  pageBoundingHeight: number
  effectivePixelRatio: number
}

function DiagnosticsPanel({ diag }: { diag: RenderDiagnostics }) {
  const row = (label: string, value: string | number) => (
    <div className="flex justify-between gap-4">
      <span className="text-ink-tertiary">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-50 w-64 space-y-0.5 rounded-sm bg-black/80 p-2 font-mono text-[10px] text-white shadow-1">
      {row('scale', diag.scale.toFixed(4))}
      {row('devicePixelRatio', diag.devicePixelRatio)}
      {row('canvas.width/height', `${diag.canvasWidth} / ${diag.canvasHeight}`)}
      {row('canvas.style w/h', `${diag.canvasStyleWidth || '(100%)'} / ${diag.canvasStyleHeight || '(100%)'}`)}
      {row('canvas bounding rect', `${diag.boundingWidth.toFixed(1)} x ${diag.boundingHeight.toFixed(1)}`)}
      {row('page container rect', `${diag.pageBoundingWidth.toFixed(1)} x ${diag.pageBoundingHeight.toFixed(1)}`)}
      {row('effective px ratio', diag.effectivePixelRatio.toFixed(2))}
    </div>
  )
}

export const ReaderCanvas = forwardRef<ReaderCanvasHandle, ReaderCanvasProps>(function ReaderCanvas(
  {
    doc,
    pageNumber,
    fitMode,
    scale,
    onScaleChange,
    highlights = [],
    onSelectionFinalize,
    onSelectHighlight,
    onSelectionAvailabilityChange,
    onSwipeNext,
    onSwipePrev,
    navigationMode = 'swipe'
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<TextLayerHandle>(null)
  const lastPageChangeTimeRef = useRef<number>(0)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  useImperativeHandle(ref, () => ({
    finalizeSelection: () => textLayerRef.current?.finalizeSelection() ?? false
  }))

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

  // Reset scroll to top on page change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [pageNumber])

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
    if (fitMode === 'width' || (navigationMode === 'scroll' && fitMode === 'page')) {
      return availWidth / naturalSize.width
    }
    return Math.min(availWidth / naturalSize.width, availHeight / naturalSize.height)
  })()

  useEffect(() => {
    if (effectiveScale > 0) onScaleChange(effectiveScale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScale])

  const [diag, setDiag] = useState<RenderDiagnostics | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || effectiveScale <= 0) return
    let task: RenderTask | undefined
    let cancelled = false

    renderPageToCanvas(doc, pageNumber, canvas, effectiveScale)
      .then((t) => {
        task = t
        return t.promise
      })
      .then(() => {
        if (cancelled || !DIAGNOSTICS_ENABLED) return
        const rect = canvas.getBoundingClientRect()
        const cssRect = pageRef.current?.getBoundingClientRect()
        setDiag({
          scale: effectiveScale,
          devicePixelRatio: window.devicePixelRatio || 1,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          canvasStyleWidth: canvas.style.width,
          canvasStyleHeight: canvas.style.height,
          boundingWidth: rect.width,
          boundingHeight: rect.height,
          pageBoundingWidth: cssRect?.width ?? 0,
          pageBoundingHeight: cssRect?.height ?? 0,
          effectivePixelRatio: rect.width > 0 ? canvas.width / rect.width : 0
        })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'RenderingCancelledException') return
        console.error('PDF page render failed:', err)
      })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, effectiveScale])

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

  const touchStateRef = useRef<{ x: number; y: number; time: number; multiTouch: boolean; skip: boolean; scrollTop: number } | null>(null)
  const SWIPE_MIN_DISTANCE = 40
  const SWIPE_MAX_DURATION_MS = 900
  const SWIPE_DIRECTION_RATIO = 1.5

  function handleTouchStart(e: ReactTouchEvent) {
    if (!onSwipeNext && !onSwipePrev) return
    const target = e.target as HTMLElement
    const interactive = Boolean(target.closest('button, a, input, textarea, [role="button"], [data-no-swipe]'))
    const container = containerRef.current
    const hasHorizontalRoom = Boolean(pageRef.current && container && pageRef.current.getBoundingClientRect().width > container.clientWidth + 5)
    
    if (e.touches.length !== 1 || interactive || (navigationMode === 'swipe' && hasHorizontalRoom)) {
      touchStateRef.current = { x: 0, y: 0, time: 0, multiTouch: true, skip: true, scrollTop: 0 }
      return
    }
    const t = e.touches[0]
    touchStateRef.current = {
      x: t.clientX,
      y: t.clientY,
      time: Date.now(),
      multiTouch: false,
      skip: false,
      scrollTop: container ? container.scrollTop : 0
    }
  }

  function handleTouchMove(e: ReactTouchEvent) {
    if (!touchStateRef.current) return
    if (e.touches.length !== 1) touchStateRef.current.skip = true
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    const start = touchStateRef.current
    touchStateRef.current = null
    if (!start || start.skip) return

    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) return

    const touch = e.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    const elapsed = Date.now() - start.time
    if (elapsed > SWIPE_MAX_DURATION_MS) return

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const container = containerRef.current
    const now = Date.now()

    if (now - lastPageChangeTimeRef.current < 500) return

    if (navigationMode === 'scroll') {
      if (absDy < SWIPE_MIN_DISTANCE || absDy < absDx * SWIPE_DIRECTION_RATIO) return
      if (!container) return

      const isAtBottom = start.scrollTop + container.clientHeight >= container.scrollHeight - 15
      const isAtTop = start.scrollTop <= 15

      if (dy < 0 && isAtBottom) {
        lastPageChangeTimeRef.current = now
        onSwipeNext?.()
      } else if (dy > 0 && isAtTop) {
        lastPageChangeTimeRef.current = now
        onSwipePrev?.()
      }
      return
    }

    if (absDx < SWIPE_MIN_DISTANCE || absDx < absDy * SWIPE_DIRECTION_RATIO) return

    if (dx < 0) onSwipeNext?.()
    else onSwipePrev?.()
  }

  function handleWheel(e: ReactWheelEvent) {
    if (navigationMode !== 'scroll' || !containerRef.current) return
    const container = containerRef.current
    const now = Date.now()

    if (now - lastPageChangeTimeRef.current < 500) return

    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 5
    const isAtTop = container.scrollTop <= 5

    if (e.deltaY > 30 && isAtBottom) {
      lastPageChangeTimeRef.current = now
      onSwipeNext?.()
    } else if (e.deltaY < -30 && isAtTop) {
      lastPageChangeTimeRef.current = now
      onSwipePrev?.()
    }
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="flex h-full w-full items-start justify-center overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain bg-canvas p-4"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        ref={pageRef}
        onClick={handlePageClick}
        className="relative rounded-sm border border-border bg-white shadow-1 touch-pan-y"
        style={
          naturalSize
            ? {
                width: naturalSize.width * effectiveScale,
                height: naturalSize.height * effectiveScale,
                touchAction: 'pan-y'
              }
            : { touchAction: 'pan-y' }
        }
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full pointer-events-none"
          style={{ zIndex: 1 }}
        />
        {DIAGNOSTICS_ENABLED && diag && <DiagnosticsPanel diag={diag} />}
        {naturalSize && effectiveScale > 0 && (
          <>
            <HighlightsLayer highlights={highlights} naturalSize={naturalSize} scale={effectiveScale} />
            {onSelectionFinalize && (
              <TextLayer
                ref={textLayerRef}
                doc={doc}
                pageNumber={pageNumber}
                naturalSize={naturalSize}
                scale={effectiveScale}
                onSelectionFinalize={onSelectionFinalize}
                onSelectionAvailabilityChange={onSelectionAvailabilityChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
})

