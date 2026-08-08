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

          const next: PositionedItem[] = items
            .filter((item) => item.str.trim().length > 0)
            .map((item) => {
              const tx = transformPoint(
                viewportTransform,
                item.transform
              )

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

      if (
        !container.contains(range.commonAncestorContainer)
      ) {
        return false
      }

      const containerRect =
        container.getBoundingClientRect()

      const clientRects = Array.from(
        range.getClientRects()
      )
      const rawRects = clientRects
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => ({
          x: (rect.left - containerRect.left) / scale,
          y: (rect.top - containerRect.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale
        }))

      // Merge word bounding boxes on the same line into unified highlight bars
      const rects: HighlightRect[] = []
      for (const rect of rawRects) {
        const sameLine = rects.find(
          (r) => Math.abs(r.y - rect.y) < 6
        )
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


      if (rects.length === 0) {
        return false
      }

      const first = clientRects[0]

      onSelectionFinalize(
        text,
        rects,
        {
          x: first.left + first.width / 2,
          y: first.bottom
        }
      )

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
      ({ item, left, top, fontSize, angleDeg }, i) => (
        <span
          key={i}
          className="cellfie-pdf-text-span"
          style={{
            position: 'absolute',
            left: left * scale,
            top: top * scale,
            fontSize: fontSize * scale,
            fontFamily: 'sans-serif',
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
          {item.str}
        </span>
      )
    )}
  </div>
)
}

)

