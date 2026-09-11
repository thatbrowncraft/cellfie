/**
 * core/world-explorer/geo/loadWorldAtlas — lazy, cached loader for the
 * Real World globe's country boundary geometry.
 *
 * DATA SOURCE (brief §2 — "investigate the safest way to render actual
 * country boundaries... prefer existing project dependencies... small
 * and maintainable"): Cellfie had no geo/mapping dependency at all
 * before this feature (see `../projection.ts`'s doc comment). Rather
 * than hand-rolling boundary data or reaching for a heavy GIS/3D
 * library, this adds exactly two small, focused, local dependencies:
 *   - `world-atlas` — pre-built TopoJSON country boundaries. The 50m
 *     resolution (not the smaller 110m) is used specifically so tiny
 *     countries already on Cellfie's globe — Singapore, Maldives,
 *     Bhutan, Qatar, Kuwait — don't get silently dropped the way they
 *     would at 110m's coarser simplification.
 *   - `topojson-client` — the small, single-purpose decoder that turns
 *     that TopoJSON into plain GeoJSON rings.
 * Both are bundled at build time (no runtime network fetch — brief
 * §11: must work offline).
 *
 * LAZY BY DESIGN (brief §10 — "lazy-load heavy geographic assets"):
 * this is a dynamic import, not a top-level one, so the data only ever
 * loads for someone who actually switches the globe to Real World —
 * the same dynamic-import-for-code-splitting pattern already used by
 * Comparison Studio's entity search. `vite.config.ts` also excludes
 * this specific chunk from the PWA's install-time precache and instead
 * runtime-caches it after first use, the same treatment already given
 * to the bundled user manual PDF, so it can't inflate initial install
 * size.
 *
 * SIMPLIFIED, NOT RE-PROJECTED, HERE: rings are capped to a max point
 * count (see `simplifyRing`) once, at load time, since 50m-resolution
 * coastlines carry far more detail than a small on-screen globe needs
 * and re-projecting thousands of points every animation frame during a
 * drag would be wasted work on lower-end devices (brief §10). The
 * actual orthographic projection (which depends on live rotation/zoom)
 * stays in `Globe.tsx`, called fresh every frame — this module only
 * ever returns plain, unprojected [lon, lat] degrees.
 *
 * The module-level `loadPromise` means the topology -> GeoJSON
 * conversion runs at most once per app session no matter how many
 * times the user toggles the globe style back and forth.
 */
import { getGlobeCountryIdForIsoNumeric } from './isoMapping'

/** Cap per ring after simplification — plenty of detail for a ~360px globe, far less work per frame than raw 50m coastline data. */
const MAX_POINTS_PER_RING = 60

export interface WorldLandmassFeature {
  /** The matching GLOBE_COUNTRIES id, or null if this feature isn't one of Cellfie's 58 covered countries — see `isoMapping.ts`. */
  countryId: string | null
  /** Every ring (exterior + holes, and every ring of every polygon in a MultiPolygon), each as raw [lon, lat] degree pairs. Rendered together as one evenodd-fill SVG path in `Globe.tsx` so holes (e.g. enclaves) punch out correctly without any extra hole-tracking logic here. */
  rings: [number, number][][]
}

let loadPromise: Promise<WorldLandmassFeature[]> | null = null

interface RawPolygonGeometry {
  type: 'Polygon'
  coordinates: [number, number][][]
}
interface RawMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: [number, number][][][]
}
type RawGeometry = RawPolygonGeometry | RawMultiPolygonGeometry | { type: string }

interface RawFeature {
  type: 'Feature'
  id?: string | number
  properties?: { name?: string } | null
  geometry: RawGeometry
}

interface RawFeatureCollection {
  type: 'FeatureCollection'
  features: RawFeature[]
}

function isFeatureCollection(x: unknown): x is RawFeatureCollection {
  return Boolean(x) && typeof x === 'object' && (x as { type?: string }).type === 'FeatureCollection'
}

/** Evenly downsamples a ring to at most `MAX_POINTS_PER_RING` points, always keeping the first/last point so the ring stays closed. */
function simplifyRing(points: [number, number][]): [number, number][] {
  if (points.length <= MAX_POINTS_PER_RING) return points
  const step = points.length / MAX_POINTS_PER_RING
  const simplified: [number, number][] = []
  for (let i = 0; i < MAX_POINTS_PER_RING; i++) {
    simplified.push(points[Math.floor(i * step)])
  }
  // Always end on the true last point so the ring still closes cleanly.
  simplified.push(points[points.length - 1])
  return simplified
}

function ringsFromGeometry(geometry: RawGeometry): [number, number][][] {
  if (geometry.type === 'Polygon') {
    return (geometry as RawPolygonGeometry).coordinates.map(simplifyRing)
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry as RawMultiPolygonGeometry).coordinates.flatMap((polygon) => polygon.map(simplifyRing))
  }
  return []
}

async function loadImpl(): Promise<WorldLandmassFeature[]> {
  const [{ feature }, topologyModule] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-50m.json')
  ])
  const topology = topologyModule.default as { objects: Record<string, unknown> }
  const collection = feature(topology, topology.objects.countries)

  if (!isFeatureCollection(collection)) {
    // A single-country topology would decode to a bare Feature instead
    // of a FeatureCollection — not expected for world-atlas's
    // `countries` object, but fail closed (empty landmasses, globe
    // still renders as open ocean) rather than throwing.
    // eslint-disable-next-line no-console
    console.warn('[world-explorer] world-atlas countries object did not decode to a FeatureCollection')
    return []
  }

  return collection.features.map((f) => ({
    countryId: getGlobeCountryIdForIsoNumeric(f.id) ?? null,
    rings: ringsFromGeometry(f.geometry)
  }))
}

/**
 * Loads (and caches for the session) every country's boundary rings, in
 * raw [lon, lat] degree form. Retries on the next call if a previous
 * attempt failed (e.g. a transient chunk-load error after an app
 * update) rather than permanently caching the failure.
 */
export function loadWorldLandmasses(): Promise<WorldLandmassFeature[]> {
  if (!loadPromise) {
    loadPromise = loadImpl().catch((err: unknown) => {
      loadPromise = null
      throw err
    })
  }
  return loadPromise
}
