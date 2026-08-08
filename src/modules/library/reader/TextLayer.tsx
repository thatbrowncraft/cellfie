import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPageTextContent, transformPoint, type PdfTextItem } from '@/core/pdf-engine'
import type { HighlightRect } from '@/core/db'

interface PositionedItem {
  item: PdfTextItem
  left: number
  top: number
  fontSize: number
  angleDeg: number
  /**
   * Sprint 2.1 §6 bugfix: horizontal correction so this span's *rendered*
   * width (in our invisible fallback font) matches the PDF's actual glyph
   * width (`item.width`), not just its font-size/position. See the
   * `measureFallbackWidth` comment below for why this matters.
   */
  scaleX: number
}

/**
 * A single offscreen 2d context, reused across every span/page — avoids
 * allocating a canvas per text item just to measure a string.
 */
let measureCtx: CanvasRenderingContext2D | null = null
function measureFallbackWidth(text: string, fontSizePx: number): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) return 0
  measureCtx.font = `${fontSizePx}px sans-serif`
  return measureCtx.measureText(text).width
}

interface TextLayerProps {
  doc: PDFDocumentProxy
  pageNumber: number
  /** Natural (scale-1) page size — the text layer is built at this size, then CSS-scaled by `scale`. */
  naturalSize: { width: number; height: number }
  scale: number
  /** Fires when the user finishes selecting text inside this page's text layer, with rects in natural page space and a viewport anchor point for a popover. */
  onSelectionFinalize: (text: string, rects: HighlightRect[], anchor: { x: number; y: number }) => void
  /**
   * Mobile highlighting bugfix: reports whether a live, non-empty text
   * selection currently exists inside this page, independent of whether
   * `mouseup`/`touchend` has fired yet. The reader toolbar uses this to
   * enable its explicit "Highlight" button — the reliable, discoverable
   * mobile-friendly action requested alongside automatic detection.
   */
  onSelectionAvailabilityChange?: (available: boolean) => void
}

export interface TextLayerHandle {
  /**
   * Reads whatever the current `window.getSelection()` is (if any, and if
   * it belongs to this page) and finalizes it into a highlight-ready
   * selection — the exact same conversion `mouseup` uses. Used by the
   * reader toolbar's Highlight button as a deterministic fallback for
   * touch devices where selection doesn't reliably fire `mouseup`.
   * Returns whether a selection was actually found and finalized.
   */
  finalizeSelection: () => boolean
}

/**
 * Renders PDF.js's per-page text items as invisible, absolutely-
 * positioned, selectable `<span>`s over the canvas — the same technique
 * PDF.js's own `renderTextLayer` uses. Built once at natural (scale-1)
 * size, then the whole layer is CSS-`transform: scale()`d to match
 * whatever zoom the canvas is rendering at, so zooming never re-lays-out
 * hundreds of spans.
 *
 * On mouseup (desktop) or touchend (mobile), converts the current window
 * selection's client rects into natural-page-space rectangles (Sprint 2
 * §1, Text Highlighting) and reports them upward; the reader turns that
 * into a Highlight. The same conversion is also exposed imperatively via
 * `ref` so the toolbar's Highlight button can trigger it directly — one
 * highlighting code path, three ways to invoke it (Bug 1 fix).
 */
export const TextLayer = forwardRef<TextLayerHandle, TextLayerProps>(function TextLayer(
  { doc, pageNumber, naturalSize, scale, onSelectionFinalize, onSelectionAvailabilityChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [positioned, setPositioned] = useState<PositionedItem[]>([])

  useEffect(() => {
    let cancelled = false
    setPositioned([])

    getPageTextContent(doc, pageNumber).then(({ items, viewportTransform }) => {
      if (cancelled) return
      const next: PositionedItem[] = items
        .filter((item) => item.str.length > 0)
        .map((item) => {
          const tx = transformPoint(viewportTransform, item.transform)
          const angleRad = Math.atan2(tx[1], tx[0])
          const fontSize = Math.hypot(tx[2], tx[3])
          // Sprint 2.1 §6 bugfix (root cause of misaligned highlights):
          // these spans render in a generic fallback font ("sans-serif")
          // since we don't load/match the PDF's actual embedded fonts —
          // fine, since the text is invisible, EXCEPT that fallback font
          // renders each string at a different width than the PDF's true
          // glyph width (`item.width`). Left uncorrected, a selection's
          // `getClientRects()` reflects the *fallback font's* layout, not
          // the real PDF layout — spans run wider/narrower than their
          // intended slot, so multi-word/multi-line selections produce
          // rects that don't tightly track the visible text, which is
          // exactly what showed up as oversized/misaligned highlight
          // blocks. Stretching each span horizontally so its rendered
          // width matches `item.width` (PDF.js's own technique for its
          // real text layer) fixes both the *visible* selection
          // highlighting the browser draws and the rects Cellfie captures
          // from it — same coordinate system, corrected at the source.
          const measuredWidth = measureFallbackWidth(item.str, fontSize)
          const scaleX = measuredWidth > 0 && item.width > 0 ? item.width / measuredWidth : 1
          return {
            item,
            left: tx[4],
            top: tx[5] - fontSize,
            fontSize,
            angleDeg: (angleRad * 180) / Math.PI,
            scaleX
          }
        })
      setPositioned(next)
    })

    return () => {
      cancelled = true
    }
  }, [doc, pageNumber])

  function finalizeSelection(): boolean {
    const selection = window.getSelection()
    const container = containerRef.current
    if (!selection || selection.isCollapsed || !container || selection.rangeCount === 0) return false

    const text = selection.toString()
    if (!text.trim()) return false

    const range = selection.getRangeAt(0)
    // A selection that doesn't touch this page's text layer at all isn't ours to handle.
    if (!container.contains(range.commonAncestorContainer)) return false

    const containerRect = container.getBoundingClientRect()
    const clientRects = Array.from(range.getClientRects())
    const rects: HighlightRect[] = clientRects
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        // containerRect is already the CSS-scaled box, so dividing by
        // `scale` converts back to the natural (scale-1) space the
        // Highlight is stored in.
        x: (r.left - containerRect.left) / scale,
        y: (r.top - containerRect.top) / scale,
        width: r.width / scale,
        height: r.height / scale
      }))

    if (rects.length === 0) return false
    const first = clientRects[0]
    onSelectionFinalize(text, rects, { x: first.left + first.width / 2, y: first.bottom })
    return true
  }

  useImperativeHandle(ref, () => ({ finalizeSelection }))

  // Touch devices' native long-press/drag-handle selection doesn't
  // reliably fire `mouseup`, so track selection state via
  // `selectionchange` too — purely to drive the toolbar's Highlight
  // button enabled state. This never finalizes a highlight by itself
  // (that still only happens from mouseup/touchend/the toolbar button),
  // so nothing is created without an explicit user action.
  useEffect(() => {
    if (!onSelectionAvailabilityChange) return

    function handleSelectionChange() {
      const selection = window.getSelection()
      const container = containerRef.current
      const available = Boolean(
        selection &&
          !selection.isCollapsed &&
          selection.rangeCount > 0 &&
          selection.toString().trim() &&
          container &&
          container.contains(selection.getRangeAt(0).commonAncestorContainer)
      )
      onSelectionAvailabilityChange?.(available)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      onSelectionAvailabilityChange?.(false)
    }
  }, [onSelectionAvailabilityChange])

  function handleMouseUp() {
    finalizeSelection()
  }

  // On mobile the OS selection UI (drag handles) frequently hasn't
  // committed its final range the instant `touchend` fires, so give it a
  // beat before reading `window.getSelection()`. Desktop is untouched —
  // it still finalizes synchronously via handleMouseUp.
  function handleTouchEnd() {
    window.setTimeout(() => finalizeSelection(), 60)
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 origin-top-left select-text"
      style={{
        width: naturalSize.width,
        height: naturalSize.height,
        transform: `scale(${scale})`
      }}
    >
      {positioned.map(({ item, left, top, fontSize, angleDeg, scaleX }, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            fontSize,
            fontFamily: 'sans-serif',
            // scaleX corrects the fallback font's width to match the PDF's
            // real glyph width (see measureFallbackWidth above) — applied
            // first (innermost), then rotate, so a rotated run's box is
            // width-corrected before it's tilted, not after.
            transform: `rotate(${angleDeg}deg) scaleX(${scaleX})`,
            transformOrigin: 'left bottom',
            whiteSpace: 'pre',
            color: 'transparent',
            lineHeight: 1,
            cursor: 'text'
          }}
        >
          {item.str}
        </span>
      ))}
    </div>
  )
})
