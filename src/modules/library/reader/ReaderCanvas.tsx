import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent
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
   * Reader Fix — Scroll mode: 'swipe' (default) keeps the existing
   * horizontal swipe-to-turn-page gesture below untouched. 'scroll' turns
   * that gesture off so a horizontal finger movement never calls
   * onSwipeNext/onSwipePrev, leaving the container's native vertical
   * overflow-y-auto scroll (already present in both modes, see the root
   * container below) as the only thing a touch-drag can do.
   */
  navigationMode?: 'swipe' | 'scroll'
}

export interface ReaderCanvasHandle {
  /** Finalizes whatever text selection currently exists on the page into a
   *  highlight-ready selection — delegates straight to the TextLayer's own
   *  handle. Used by the toolbar's Highlight button (Bug 1 fix). */
  finalizeSelection: () => boolean
}

// Breathing room around the page inside the scrollable viewport, so a
// fit-width/fit-page page never touches the pane edges.
const PAGE_PADDING = 32

// Sprint 2.2 Part 2: on-device verification, opt-in via ?debug=pdf so it
// never ships visible-by-default. Read once at module load — this is a
// diagnostics flag, not reactive app state.
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
  /** canvas.width / bounding client width — the actual delivered sharpness ratio; should be ≈ devicePixelRatio (or the capped value) whenever this is < 1 the page IS being upscaled and will look soft, which is the exact thing to check for on your Android device. */
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

/**
 * Renders the current page onto a canvas, recomputing scale for
 * fit-width/fit-page modes from the container's measured size. Scrolls
 * internally so a manually zoomed-in page can be panned without affecting
 * the rest of the reader. `overscroll-contain` keeps that internal pan/
 * zoom scroll from rubber-band-chaining into the page behind it on mobile.
 */
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

  // --- Swipe navigation (Reader Improvement §Reader Mode 2/§Swipe Safety) --
  //
  // Deliberately conservative: a touch only ever becomes a page-turn when
  // ALL of the following hold at touchend —
  //   1. it was a single-finger gesture the whole time (pinch cancels it)
  //   2. horizontal distance clearly dominates vertical distance, so an
  //      ordinary vertical scroll is never hijacked
  //   3. horizontal distance clears a minimum-px floor, so small taps/
  //      jitter never fire a page change
  //   4. it didn't start on a button/link/input (toolbar taps stay taps)
  //   5. it didn't end with an active text selection (so selecting text
  //      near a page edge never accidentally turns the page)
  //   6. the page currently has no horizontal room to pan (i.e. the
  //      person isn't zoomed in trying to pan across a wide page) — if
  //      `scrollWidth > clientWidth`, pinch/pan wins and swipe nav is
  //      skipped entirely for this gesture.
  const touchStateRef = useRef<{ x: number; y: number; time: number; multiTouch: boolean; skip: boolean } | null>(null)
  const SWIPE_MIN_DISTANCE = 40
  const SWIPE_MAX_DURATION_MS = 900
  const SWIPE_DIRECTION_RATIO = 1.5

  function handleTouchStart(e: ReactTouchEvent) {
    if (!onSwipeNext && !onSwipePrev) return
    // Scroll mode: never track a swipe gesture in the first place, so a
    // vertical drag is left entirely to the browser's native scroll on the
    // container below (touchAction stays 'pan-y' either way — the only
    // thing that changes is whether a horizontal drag is *also*
    // interpreted as a page turn).
    if (navigationMode === 'scroll') {
      touchStateRef.current = { x: 0, y: 0, time: 0, multiTouch: false, skip: true }
      return
    }
    const target = e.target as HTMLElement
    const interactive = Boolean(target.closest('button, a, input, textarea, [role="button"], [data-no-swipe]'))
    const container = containerRef.current
    const hasHorizontalRoom = Boolean(pageRef.current && container && pageRef.current.getBoundingClientRect().width > container.clientWidth + 5)
    if (e.touches.length !== 1 || interactive || hasHorizontalRoom) {
      touchStateRef.current = { x: 0, y: 0, time: 0, multiTouch: true, skip: true }
      return
    }
    const t = e.touches[0]
    touchStateRef.current = { x: t.clientX, y: t.clientY, time: Date.now(), multiTouch: false, skip: false }
  }

  function handleTouchMove(e: ReactTouchEvent) {
    if (!touchStateRef.current) return
    if (e.touches.length !== 1) touchStateRef.current.skip = true
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    const start = touchStateRef.current
    touchStateRef.current = null
    // Belt-and-suspenders alongside the handleTouchStart guard above: scroll
    // mode never calls onSwipeNext/onSwipePrev from a touch gesture.
    if (navigationMode === 'scroll') return
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
    if (absDx < SWIPE_MIN_DISTANCE) return
    if (absDx < absDy * SWIPE_DIRECTION_RATIO) return

    if (dx < 0) onSwipeNext?.()
    else onSwipePrev?.()
  }

  return (
        <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
