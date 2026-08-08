import type { Highlight, HighlightColor } from '@/core/db'

interface HighlightsLayerProps {
  highlights: Highlight[]
  naturalSize: { width: number; height: number }
  scale: number
}

/** CSS custom-property names — used by ReaderSidebar and HighlightPopover */
export const markerColorVar: Record<HighlightColor, string> = {
  yellow: '--color-marker-yellow',
  green: '--color-marker-green',
  blue: '--color-marker-blue',
  pink: '--color-marker-pink'
}

export function HighlightsLayer({ highlights, naturalSize, scale }: HighlightsLayerProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 origin-top-left"
      style={{
        width: naturalSize.width,
        height: naturalSize.height,
        transform: `scale(${scale})`,
        zIndex: 20
      }}
    >
      {highlights.map((h) =>
        h.rects.map((rect, i) => (
          <div
            key={`${h.id}-${i}`}
            className="absolute rounded-[2px] mix-blend-multiply"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: `var(${markerColorVar[h.color]})`,
              opacity: 0.7
            }}
          />
        ))
      )}
    </div>
  )
}
