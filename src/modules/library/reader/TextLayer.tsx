import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPageTextContent, transformPoint, type PdfTextItem } from '@/core/pdf-engine'
import type { HighlightRect } from '@/core/db'

interface PositionedItem {
  item: PdfTextItem
  left: number
  top: number
  fontSize: number
  angleDeg: number
}

interface TextLayerProps {
  doc: PDFDocumentProxy
  pageNumber: number
  /** Natural (scale-1) page size — the text layer is built at this size, then CSS-scaled by `scale`. */
  naturalSize: { width: number; height: number }
  scale: number
  /** Fires when the user finishes selecting text inside this page's text layer, with rects in natural page space and a viewport anchor point for a popover. */
  onSelectionFinalize: (text: string, rects: HighlightRect[], anchor: { x: number; y: number }) => void
}

/**
 * Renders PDF.js's per-page text items as invisible, absolutely-
 * positioned, selectable `<span>`s over the canvas — the same technique
 * PDF.js's own `renderTextLayer` uses. Built once at natural (scale-1)
 * size, then the whole layer is CSS-`transform: scale()`d to match
 * whatever zoom the canvas is rendering at, so zooming never re-lays-out
 * hundreds of spans.
 *
 * On mouseup, converts the current window selection's client rects into
 * natural-page-space rectangles (Sprint 2 §1, Text Highlighting) and
 * reports them upward; the reader turns that into a Highlight.
 */
export function TextLayer({ doc, pageNumber, naturalSize, scale, onSelectionFinalize }: TextLayerProps) {
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
          return {
            item,
            left: tx[4],
            top: tx[5] - fontSize,
            fontSize,
            angleDeg: (angleRad * 180) / Math.PI
          }
        })
      setPositioned(next)
    })

    return () => {
      cancelled = true
    }
  }, [doc, pageNumber])

  function handleMouseUp() {
    const selection = window.getSelection()
    const container = containerRef.current
    if (!selection || selection.isCollapsed || !container || selection.rangeCount === 0) return

    const text = selection.toString()
    if (!text.trim()) return

    const range = selection.getRangeAt(0)
    // A selection that doesn't touch this page's text layer at all isn't ours to handle.
    if (!container.contains(range.commonAncestorContainer)) return

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

    if (rects.length === 0) return
    const first = clientRects[0]
    onSelectionFinalize(text, rects, { x: first.left + first.width / 2, y: first.bottom })
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="absolute inset-0 origin-top-left select-text"
      style={{
        width: naturalSize.width,
        height: naturalSize.height,
        transform: `scale(${scale})`
      }}
    >
      {positioned.map(({ item, left, top, fontSize, angleDeg }, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            fontSize,
            fontFamily: 'sans-serif',
            transform: angleDeg ? `rotate(${angleDeg}deg)` : undefined,
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
}
