import type { Highlight, HighlightColor } from '@/core/db'

interface HighlightsLayerProps {
  highlights: Highlight[]
  naturalSize: { width: number; height: number }
  scale: number
}

/** CSS custom-property names — see the `--color-marker-*` tokens added to index.css. */
export const markerColorVar: Record<HighlightColor, string> = {
  yellow: '--color-marker-yellow',
  green: '--color-marker-green',
  blue: '--color-marker-blue',
  pink: '--color-marker-pink'
}

/**
 * Purely decorative: draws each Highlight's stored rects (natural page
 * space) as tinted overlays. `pointer-events: none` throughout, so it
 * never competes with the TextLayer above it for selection/click
 * hit-testing — clicking an existing highlight is handled by the parent
 * ReaderCanvas testing click coordinates against these same rects, which
 * keeps exactly one element in the stack ever receiving pointer events.
 */
export function HighlightsLayer({ highlights, naturalSize, scale }: HighlightsLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 origin-top-left"
      style={{ width: naturalSize.width, height: naturalSize.height, transform: `scale(${scale})` }}
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
              backgroundColor: `var(${markerColorVar[h.color]})`
            }}
          />
        ))
      )}
    </div>
  )
}
