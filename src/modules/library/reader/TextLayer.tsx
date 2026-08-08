import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  getPageTextContent,
  transformPoint,
  type PdfTextItem
} from '@/core/pdf-engine'
import type { HighlightRect } from '@/core/db'

interface PositionedItem {
  item: PdfTextItem
  left: number
  top: number
  fontSize: number
  angleDeg: number
  /**
   * Missing-spaces bugfix: whether a real space character should be
   * rendered immediately after this item's own text. PDF.js's text
   * extraction (see `getTextContent`) already decides, per pair of
   * glyphs, whether a gap is a real word-space or just kerning within a
   * word — real word-spaces either get folded into an item's `str`
   * directly, or (often for justified text, where the word-gap width
   * varies) get pushed as their own standalone whitespace-only item
   * (`str: ' '`). Our previous `item.str.trim().length > 0` filter
   * discarded exactly those standalone whitespace items, which is what
   * caused selected text to lose spaces at those specific boundaries.
   * The fix has two parts: (1) stop filtering out non-empty whitespace
   * items, so they render as real space characters in the DOM between
   * word spans, and (2) explicitly add a trailing space whenever
   * `item.hasEOL` is true, because a line-wrap's implicit space is
   * "consumed" by the wrap itself and never appears in any item's str.
   * Both signals come straight from PDF.js's own word/line detection —
   * nothing here guesses at word boundaries independently, so it can't
   * split a real word.
   */
  trailingSpace: boolean
}

interface TextLayerProps {
  doc: PDFDocumentProxy
  pageNumber: number
  naturalSize: {
    width: number
    height: number
  }
  scale: number
  onSelectionFinalize: (
    text: string,
    rects: HighlightRect[],
    anchor: { x: number; y: number }
  ) => void
  onSelectionAvailabilityChange?: (available: boolean) => void
}

export interface TextLayerHandle {
  finalizeSelection: () => boolean
}

export const TextLayer = forwardRef<TextLayerHandle, TextLayerProps>(
  function TextLayer(
    {
      doc,
      pageNumber,
      naturalSize,
      scale,
      onSelectionFinalize,
      onSelectionAvailabilityChange
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [positioned, setPositioned] = useState<PositionedItem[]>([])

    useEffect(() => {
      let cancelled = false

      setPositioned([])

      getPageTextContent(doc, pageNumber).then(
        ({ items, viewportTransform }) => {
          if (cancelled) return

          // Missing-spaces bugfix: walk items in their original (reading)
          // order rather than filtering-then-mapping independently, so a
          // zero-width "line ended here" marker item (PDF.js pushes
          // `{ str: '', hasEOL: true }` when nothing was accumulating at
          // the line break) can still mark the *previous rendered* word
          // as needing a trailing space, even though the marker itself
          // has no text and isn't rendered as its own span.
          const next: PositionedItem[] = []
          for (const item of items) {
            if (item.str.length === 0) {
              if (item.hasEOL && next.length > 0) {
                next[next.length - 1].trailingSpace = true
              }
              continue
            }

            const tx = transformPoint(viewportTransform, item.transform)
            const angleRad = Math.atan2(tx[1], tx[0])
            const fontSize = Math.hypot(tx[2], tx[3])

            next.push({
              item,
              left: tx[4],
              top: tx[5] - fontSize,
              fontSize,
              angleDeg: (angleRad * 180) / Math.PI,
              // A real (non-empty) item that itself ends a line also
              // needs a trailing space — this is the common case, since
              // PDF.js sets hasEOL directly on the last accumulated item
              // of a line rather than pushing a separate empty marker.
              trailingSpace: item.hasEOL
            })
          }

          setPositioned(next)
        }
      )

      return () => {
        cancelled = true
      }
    }, [doc, pageNumber])
    function finalizeSelection(): boolean {
      const selection = window.getSelection()
      const container = containerRef.current

      if (
        !selection ||
        selection.isCollapsed ||
        !container ||
        selection.rangeCount === 0
      ) {
        return false
      }

      const text = selection.toString().trim()
      if (!text) return false

      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) {
        return false
      }

      const containerRect = container.getBoundingClientRect()

      // Find all text spans inside this layer that intersect the selection
      const spans = Array.from(
        container.querySelectorAll<HTMLSpanElement>('.cellfie-pdf-text-span')
      )
      const selectedSpans = spans.filter((span) =>
        selection.containsNode(span, true)
      )

      if (selectedSpans.length === 0) return false

      // Calculate exact natural coordinates for each selected span
      const rawRects: HighlightRect[] = selectedSpans
        .map((span) => {
          const rect = span.getBoundingClientRect()
          return {
            x: (rect.left - containerRect.left) / scale,
            y: (rect.top - containerRect.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale
          }
        })
        .filter((rect) => rect.width > 0.5 && rect.height > 0.5)

      if (rawRects.length === 0) return false

      // Merge word boxes on the same line in the same column (gap threshold: 8px)
      const rects: HighlightRect[] = []
      for (const rect of rawRects) {
        const sameLine = rects.find((r) => {
          const sameRow = Math.abs(r.y - rect.y) < Math.max(4, rect.height * 0.4)
          const gap = Math.max(
            0,
            Math.max(r.x, rect.x) - Math.min(r.x + r.width, rect.x + rect.width)
          )
          return sameRow && gap <= 8
        })

        if (sameLine) {
          const minX = Math.min(sameLine.x, rect.x)
          const maxX = Math.max(sameLine.x + sameLine.width, rect.x + rect.width)
          sameLine.x = minX
          sameLine.width = maxX - minX
          sameLine.y = Math.min(sameLine.y, rect.y)
          sameLine.height = Math.max(sameLine.height, rect.height)
        } else {
          rects.push({ ...rect })
        }
      }

      const firstSpan = selectedSpans[0].getBoundingClientRect()

      onSelectionFinalize(text, rects, {
        x: firstSpan.left + firstSpan.width / 2,
        y: firstSpan.bottom
      })

      return true
    }

    useImperativeHandle(ref, () => ({
      finalizeSelection
    }))

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
          container.contains(
            selection.getRangeAt(0)
              .commonAncestorContainer
          )
        )

        onSelectionAvailabilityChange?.(available)
      }

      document.addEventListener(
        'selectionchange',
        handleSelectionChange
      )

      return () => {
        document.removeEventListener(
          'selectionchange',
          handleSelectionChange
        )

        onSelectionAvailabilityChange?.(false)
      }
    }, [onSelectionAvailabilityChange])

        return (
  <div
    ref={containerRef}
    className="cellfie-pdf-text-layer absolute left-0 top-0 select-text"
    style={{
      width: naturalSize.width * scale,
      height: naturalSize.height * scale,
      zIndex: 10,
      userSelect: 'text',
      WebkitUserSelect: 'text'
    }}
  >
    {/* Explicit selection style override */}
    <style>{`
      .cellfie-pdf-text-layer ::selection {
        background: rgba(0, 102, 204, 0.35) !important;
        color: transparent !important;
      }
    `}</style>

    {positioned.map(
      ({ item, left, top, fontSize, angleDeg, trailingSpace }, i) => (
        <span
          key={i}
          className="cellfie-pdf-text-span"
          style={{
            position: 'absolute',
            left: left * scale,
            top: top * scale,
            fontSize: fontSize * scale,
            fontFamily: 'serif',
            transform: `rotate(${angleDeg}deg)`,
            transformOrigin: 'left bottom',
            whiteSpace: 'pre',
            color: 'transparent',
            lineHeight: 1,
            cursor: 'text',
            userSelect: 'text',
            WebkitUserSelect: 'text'
          }}
        >
          {/*
            Missing-spaces bugfix: appending a real trailing space
            character (not a CSS trick) here means `window.getSelection()
            .toString()` — the exact same string the highlight/note UI
            uses — reads it as an actual space. Since this whole span is
            already invisible (`color: transparent`) and only exists for
            selection, an extra trailing space glyph has no visible
            effect on the rendered PDF; it only fixes the DOM text.
          */}
          {trailingSpace ? `${item.str} ` : item.str}
        </span>
      )
    )}
  </div>
)
}

)

