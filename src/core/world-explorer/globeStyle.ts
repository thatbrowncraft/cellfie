/**
 * core/world-explorer/globeStyle — the "Globe Style" view-filter system.
 *
 * Ships exactly two styles on purpose (brief §4: "two excellent styles
 * are better than five mediocre ones"):
 *   - 'dark' — the existing, already-good Dark Scientific globe.
 *              Untouched: same sphere, graticule, and markers as before
 *              this feature existed.
 *   - 'real' — a new Real World / physical globe, built from actual
 *              country boundary geometry (see `geo/loadWorldAtlas.ts`),
 *              not a recolored copy of the dot globe.
 *
 * A third "Atlas" style was considered (brief §4) but deliberately not
 * shipped this pass — see the World Explorer implementation notes for
 * the reasoning. Adding one later only means extending `GLOBE_STYLES`
 * below plus one rendering branch in `Globe.tsx`; that's the point of
 * routing everything through this one typed list instead of scattered
 * booleans/conditionals.
 */
export type GlobeStyleId = 'dark' | 'real'

export interface GlobeStyleConfig {
  id: GlobeStyleId
  label: string
  emoji: string
}

export const GLOBE_STYLES: GlobeStyleConfig[] = [
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'real', label: 'Real', emoji: '🌍' }
]

export const DEFAULT_GLOBE_STYLE: GlobeStyleId = 'dark'

export function isGlobeStyleId(value: unknown): value is GlobeStyleId {
  return value === 'dark' || value === 'real'
}
