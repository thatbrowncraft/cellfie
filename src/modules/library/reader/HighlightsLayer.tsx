import type { Highlight, HighlightColor } from '@/core/db'

interface HighlightsLayerProps {
  highlights: Highlight[]
  naturalSize: { width: number; height: number }
  scale: number
}

/** CSS custom-property names */
export const markerColorVar: Record<HighlightColor, string> = {
  yellow: '--color-marker-yellow',
  green: '--color-marker-green',
  blue: '--color-marker-blue',
  pink: '--color-marker-pink'
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
      {/* Inject missing CSS color variables globally */}
      <style>{`
        :root {
          --color-marker-yellow: rgba(250, 204, 21, 0.45);
          --color-marker-green: rgba(74, 222, 128, 0.45);
          --color-marker-blue: rgba(96, 165, 250, 0.45);
          --color-marker-pink: rgba(244, 114, 182, 0.45);
        }
      `}</style>

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
              backgroundColor: `var(${markerColorVar[h.color]})`
            }}
          />
        ))
      )}
    </div>
  )
}
