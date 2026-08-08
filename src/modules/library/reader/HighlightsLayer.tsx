import type { Highlight, HighlightColor } from '@/core/db'

interface HighlightsLayerProps {
  highlights: Highlight[]
  naturalSize: { width: number; height: number }
  scale: number
}

/** Direct RGBA mappings for highlight colors */
export const markerColorMap: Record<HighlightColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.45)',
  green: 'rgba(74, 222, 128, 0.45)',
  blue: 'rgba(96, 165, 250, 0.45)',
  pink: 'rgba(244, 114, 182, 0.45)'
}

export function HighlightsLayer({ highlights, naturalSize, scale }: HighlightsLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 origin-top-left"
      style={{
        width: naturalSize.width,
        height: naturalSize.height,
        transform: `scale(${scale})`,
        zIndex: 5
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
              backgroundColor: markerColorMap[h.color] || markerColorMap.yellow
            }}
          />
        ))
      )}
    </div>
  )
}
