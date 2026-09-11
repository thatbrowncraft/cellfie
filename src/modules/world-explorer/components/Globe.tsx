/**
 * World Explorer's interactive globe.
 *
 * Renders a wireframe sphere (graticule lines) with every
 * `GLOBE_COUNTRIES` entry drawn as a projected marker dot — see
 * `core/world-explorer/projection.ts`'s doc comment for why this is
 * points-on-a-sphere rather than a textured/boundary-polygon map (no
 * new dependency, tiny bundle, fully offline).
 *
 * Interaction, all built on the native Pointer Events API (one code
 * path for mouse AND touch — no separate touch handlers needed):
 *  - Drag anywhere on the globe to rotate it (horizontal drag spins;
 *    vertical drag tilts, clamped so it can't flip past the poles).
 *  - Idle auto-rotation resumes ~2.5s after the user lets go, and is
 *    intentionally slow (brief §2: "subtle... not a decorative
 *    animation").
 *  - Tap/click a country marker to select it. A pointer session that
 *    moved more than a few pixels is treated as a drag, not a tap, so
 *    rotating the globe never accidentally opens a country.
 *  - Wheel-to-zoom on desktop; +/- buttons as the reliable zoom control
 *    on touch devices (a full pinch-gesture handler is deliberately not
 *    included this pass — the brief phrases pinch-zoom as "if
 *    supported", and buttons are a control this component can guarantee
 *    works correctly everywhere without a live device to test a custom
 *    gesture handler against).
 *
 * GLOBE STYLE (`style` prop, added in the Globe Style follow-up brief):
 * everything above is UNCHANGED and stays the default 'dark' style —
 * same sphere, same graticule, same markers, same interaction. The
 * 'real' style reuses every one of those interaction code paths (drag,
 * idle rotation, zoom, the drag-vs-tap threshold) and the exact same
 * `project()` math, and only swaps the VISUAL layer: an ocean sphere
 * fill, real country landmass shapes (see `core/world-explorer/geo/`)
 * drawn under the same marker dots, and the graticule wireframe hidden
 * since the landmasses themselves now carry the visual structure. The
 * marker-dot layer is deliberately kept (just visually subdued) in
 * 'real' style too, as a guaranteed-reliable tap fallback for the rare
 * landmass feature that doesn't resolve to a Cellfie country id or
 * whose polygon fails the near-limb visibility check for a given frame
 * — see `landmassFeatures` below.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { GLOBE_COUNTRIES } from '@/core/world-explorer/countries'
import { loadWorldLandmasses, type WorldLandmassFeature } from '@/core/world-explorer/geo/loadWorldAtlas'
import { DEFAULT_GLOBE_STYLE, type GlobeStyleId } from '@/core/world-explorer/globeStyle'
import { clampPhi, graticulePoints, normalizeLambda, project, type Rotation } from '@/core/world-explorer/projection'
import { cn } from '@/shared/utils/cn'

const MIN_SCALE = 0.75
const MAX_SCALE = 1.8
const IDLE_RESUME_DELAY_MS = 2500
const IDLE_DEGREES_PER_SECOND = 3.5
const DRAG_TAP_THRESHOLD_PX = 6
const VIEWBOX_SIZE = 320
const BASE_RADIUS = 130

interface GlobeProps {
  selectedCountryId: string | null
  onSelectCountry: (id: string) => void
  /** Defaults to 'dark' so every existing call site (there was only one before this prop existed) keeps behaving exactly as before. */
  style?: GlobeStyleId
}

export function Globe({ selectedCountryId, onSelectCountry, style = DEFAULT_GLOBE_STYLE }: GlobeProps) {
  const [rotation, setRotation] = useState<Rotation>({ lambda: 20, phi: -15 })
  const [scale, setScale] = useState(1)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [landmasses, setLandmasses] = useState<WorldLandmassFeature[] | null>(null)
  const [landmassStatus, setLandmassStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [landmassRetryToken, setLandmassRetryToken] = useState(0)

  // Real World's country geometry is loaded lazily — only once someone
  // actually picks that style (brief §10) — and cached module-side in
  // `loadWorldLandmasses` so switching styles back and forth never
  // reloads it. `landmassRetryToken` lets the inline error state below
  // trigger a fresh attempt without duplicating this effect's logic.
  useEffect(() => {
    if (style !== 'real' || landmasses !== null) return
    let cancelled = false
    setLandmassStatus('loading')
    loadWorldLandmasses()
      .then((features) => {
        if (cancelled) return
        setLandmasses(features)
        setLandmassStatus('loaded')
      })
      .catch(() => {
        if (cancelled) return
        setLandmassStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [style, landmasses, landmassRetryToken])
  const dragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: number
  } | null>(null)
  const lastInteractionAt = useRef<number>(0)
  const lastDragDistanceRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Idle auto-rotation — paused while dragging or for a short window after
  // the last interaction, otherwise spins slowly forever. Skipped entirely
  // for prefers-reduced-motion, per standard accessibility practice.
  useEffect(() => {
    if (prefersReducedMotion) return
    let lastFrameAt: number | null = null

    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick)
      if (dragState.current) {
        lastFrameAt = now
        return
      }
      if (now - lastInteractionAt.current < IDLE_RESUME_DELAY_MS) {
        lastFrameAt = now
        return
      }
      if (lastFrameAt === null) {
        lastFrameAt = now
        return
      }
      const dtSeconds = (now - lastFrameAt) / 1000
      lastFrameAt = now
      setRotation((prev) => ({ ...prev, lambda: normalizeLambda(prev.lambda + IDLE_DEGREES_PER_SECOND * dtSeconds) }))
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [prefersReducedMotion])

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    lastDragDistanceRef.current = 0
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: 0
    }
    lastInteractionAt.current = performance.now()
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    drag.moved += Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY)
    lastDragDistanceRef.current = drag.moved
    lastInteractionAt.current = performance.now()

    // Degrees-per-pixel scales down as the globe is zoomed in, so drag
    // speed always feels proportional to the globe's on-screen size.
    const degreesPerPixel = 0.4 / scale
    setRotation((prev) => ({
      lambda: normalizeLambda(prev.lambda - dx * degreesPerPixel),
      phi: clampPhi(prev.phi - dy * degreesPerPixel)
    }))
  }, [scale])

  const endDrag = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragState.current?.pointerId === e.pointerId) {
      dragState.current = null
    }
    lastInteractionAt.current = performance.now()
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    lastInteractionAt.current = performance.now()
    setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.001)))
  }, [])

  function zoomBy(delta: number) {
    lastInteractionAt.current = performance.now()
    setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)))
  }

  const radius = BASE_RADIUS * scale
  const center = VIEWBOX_SIZE / 2

  const graticuleMeridians = useMemo(
    () => [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].map((lon) => graticulePoints('meridian', lon, rotation, radius)),
    [rotation, radius]
  )
  const graticuleParallels = useMemo(
    () => [-60, -30, 0, 30, 60].map((lat) => graticulePoints('parallel', lat, rotation, radius)),
    [rotation, radius]
  )

  const markers = useMemo(() => {
    return GLOBE_COUNTRIES.map((country) => {
      const p = project(country.lat, country.lon, rotation, radius)
      return { country, p }
    }).sort((a, b) => a.p.depth - b.p.depth)
  }, [rotation, radius])

  // Real World style only: projects each country's boundary rings
  // through the same orthographic `project()` used for markers and the
  // graticule, then builds one SVG path per country. A ring is only
  // included once it's mostly on the visible hemisphere — not a full
  // spherical polygon clip (which would need real computational
  // geometry), so a country straddling the horizon can show a slightly
  // rougher edge right at the limb during rotation. That's a disclosed,
  // deliberate simplification for this pass, not an oversight — see
  // `geo/loadWorldAtlas.ts`'s doc comment for the matching decision on
  // the data side. Every ring of a feature is joined into one `<path>`
  // with `fill-rule="evenodd"`, which — with zero extra logic — also
  // makes holes in the source data (e.g. a country's polygon with an
  // enclave cut out of it) render correctly as real holes.
  const landmassPaths = useMemo(() => {
    if (style !== 'real' || !landmasses) return []
    return landmasses
      .map((feature) => {
        const includedSegments: string[] = []
        let depthSum = 0
        let depthCount = 0

        for (const ring of feature.rings) {
          const projected = ring.map(([lon, lat]) => project(lat, lon, rotation, radius))
          const visibleCount = projected.filter((p) => p.visible).length
          if (projected.length === 0 || visibleCount / projected.length < 0.5) continue

          includedSegments.push(
            projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(center + p.x).toFixed(1)},${(center + p.y).toFixed(1)}`).join(' ') + ' Z'
          )
          for (const p of projected) {
            depthSum += p.depth
            depthCount += 1
          }
        }

        if (includedSegments.length === 0) return null
        return {
          feature,
          d: includedSegments.join(' '),
          opacity: Math.max(0.4, depthCount > 0 ? depthSum / depthCount : 1)
        }
      })
      .filter((entry): entry is { feature: WorldLandmassFeature; d: string; opacity: number } => entry !== null)
  }, [style, landmasses, rotation, radius, center])

  function handleLandmassClick(feature: WorldLandmassFeature) {
    // Same drag-vs-tap guard as `handleMarkerClick` — a landmass shape
    // is a much bigger hit target than a marker dot, so this matters
    // here if anything more than it does there.
    if (lastDragDistanceRef.current > DRAG_TAP_THRESHOLD_PX) return
    if (feature.countryId) onSelectCountry(feature.countryId)
  }

  function splitVisibleRuns(points: { x: number; y: number; visible: boolean }[]): string[] {
    const runs: string[] = []
    let current: string[] = []
    for (const pt of points) {
      if (pt.visible) {
        current.push(`${center + pt.x},${center + pt.y}`)
      } else if (current.length > 0) {
        runs.push(current.join(' '))
        current = []
      }
    }
    if (current.length > 0) runs.push(current.join(' '))
    return runs
  }

  function handleMarkerClick(id: string) {
    // `dragState` is already cleared by the time this fires — pointerup
    // (which clears it) always precedes the synthetic click event, so
    // checking `dragState.current` here would never catch a drag.
    // `lastDragDistanceRef` persists across that boundary instead.
    if (lastDragDistanceRef.current > DRAG_TAP_THRESHOLD_PX) return
    onSelectCountry(id)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="application"
        aria-label="Interactive world globe — drag to rotate, tap a country to explore it"
        className="w-full max-w-[360px] touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
      >
        <defs>
          <radialGradient id="globe-sphere" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="var(--color-surface-raised, #2a3330)" />
            <stop offset="100%" stopColor="var(--color-surface, #1c2422)" />
          </radialGradient>
          {/* Real World style's ocean — a separate gradient rather than recoloring `globe-sphere` in place, so the Dark Scientific style (still using `globe-sphere` above) is provably untouched by this addition. */}
          <radialGradient id="globe-ocean" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#3d7ea6" />
            <stop offset="100%" stopColor="#1f4a63" />
          </radialGradient>
        </defs>

        {/* Sphere body */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={style === 'real' ? 'url(#globe-ocean)' : 'url(#globe-sphere)'}
          stroke="currentColor"
          strokeOpacity={0.25}
          className="text-border"
        />

        {/* Graticule — Dark Scientific only. Real World's structure comes from the landmasses themselves (brief §9), not a wireframe overlay. */}
        {style === 'dark' && (
          <g fill="none" stroke="currentColor" strokeOpacity={0.18} className="text-ink-tertiary" strokeWidth={0.75}>
            {graticuleMeridians.map((pts, i) =>
              splitVisibleRuns(pts).map((run, j) => <polyline key={`m-${i}-${j}`} points={run} />)
            )}
            {graticuleParallels.map((pts, i) =>
              splitVisibleRuns(pts).map((run, j) => <polyline key={`p-${i}-${j}`} points={run} />)
            )}
          </g>
        )}

        {/* Real World country landmasses — see the `landmassPaths` doc comment above for the visibility/simplification tradeoffs. */}
        {style === 'real' &&
          landmassPaths.map(({ feature, d, opacity }) => {
            const isSelected = Boolean(feature.countryId) && feature.countryId === selectedCountryId
            return (
              <path
                key={feature.countryId ?? d.slice(0, 24)}
                d={d}
                fillRule="evenodd"
                opacity={opacity}
                className={cn(
                  isSelected ? 'fill-terracotta text-terracotta' : 'fill-olive',
                  feature.countryId ? 'cursor-pointer' : 'cursor-default'
                )}
                fillOpacity={isSelected ? 0.85 : 0.55}
                stroke={isSelected ? 'currentColor' : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
                onClick={() => handleLandmassClick(feature)}
              />
            )
          })}

        {/* Country markers — kept in every style as the guaranteed-reliable tap target (search results and the Real World style's occasional unmatched/edge-of-limb polygon both rely on this still working), just visually subdued once real landmasses are doing the main visual work. */}
        {markers.map(({ country, p }) => {
          if (!p.visible) return null
          const isSelected = country.id === selectedCountryId
          const nearLimbFade = Math.max(0.35, p.depth)
          const dotRadius = isSelected ? 5 : country.hasDeepProfile ? 3.4 : 2.4
          const subdued = style === 'real' && !isSelected

          return (
            <g
              key={country.id}
              transform={`translate(${center + p.x}, ${center + p.y})`}
              opacity={subdued ? nearLimbFade * 0.5 : nearLimbFade}
              onClick={() => handleMarkerClick(country.id)}
              className="cursor-pointer"
            >
              {isSelected && <circle r={dotRadius + 4} fill="none" stroke="currentColor" className="text-terracotta" strokeWidth={1.5} />}
              <circle
                r={dotRadius}
                className={cn(country.hasDeepProfile ? 'text-terracotta' : 'text-olive', isSelected && 'text-terracotta')}
                fill="currentColor"
              />
              {/* Larger hit area than the visible dot, so tapping a small marker on mobile is forgiving */}
              <circle r={10} fill="transparent" />
              {isSelected && (
                <text y={-dotRadius - 6} textAnchor="middle" className="fill-ink-primary font-ui text-[9px] font-medium">
                  {country.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {style === 'real' && landmassStatus === 'loading' && (
        <p className="font-ui text-micro text-ink-tertiary">Loading the physical map…</p>
      )}
      {style === 'real' && landmassStatus === 'error' && (
        <div className="flex items-center gap-2">
          <p className="font-ui text-micro text-ink-tertiary">Couldn't load the physical map.</p>
          <button
            type="button"
            onClick={() => setLandmassRetryToken((t) => t + 1)}
            className="font-ui text-micro font-medium text-terracotta underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => zoomBy(-0.15)}
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-secondary transition-colors duration-micro hover:bg-surface-raised"
        >
          <MagnifyingGlassMinus size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.15)}
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-secondary transition-colors duration-micro hover:bg-surface-raised"
        >
          <MagnifyingGlassPlus size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
