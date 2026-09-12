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

  const clearDrag = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragState.current?.pointerId === e.pointerId) {
      dragState.current = null
    }
    lastInteractionAt.current = performance.now()
  }, [])

  // Selection now happens here, on pointerup, instead of via onClick
  // handlers on individual marker/landmass elements.
  //
  // ROOT CAUSE of "selected country traces/jumps while rotating": with
  // `setPointerCapture` on the element under pointerdown, pointerup is
  // reliably re-targeted to that captured element — but the browser's
  // synthetic "click" event that follows is a separate compatibility
  // event, and its target is resolved by a fresh hit-test at the
  // pointer's release position, not by pointer capture. That's a real,
  // documented cross-browser inconsistency (most inconsistent on
  // Android WebView/Chrome). A drag that starts on one country and, a
  // frame or two after crossing the tap-vs-drag threshold, releases a
  // few pixels over a NEIGHBOURING marker or landmass shape could fire
  // a click on that neighbour instead of the one originally pressed —
  // which looks exactly like the selection "jumping" or "tracing"
  // between countries, and explains why it showed up most around
  // Australia/Oceania, where markers sit closer together on screen.
  //
  // Fixing it here removes the ambiguity entirely: we do our own
  // hit-test with `document.elementFromPoint` at the exact release
  // coordinates (unaffected by pointer capture), find the nearest
  // `data-globe-country`-tagged element, and select THAT — a single,
  // deterministic code path for mouse and touch alike. Selection is
  // still keyed by stable country id (`data-globe-country`), never by
  // raw pointer position; only the "which element is under the pointer
  // right now" hit-test uses coordinates, exactly once, at release.
  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const wasTap = lastDragDistanceRef.current <= DRAG_TAP_THRESHOLD_PX
    clearDrag(e)
    if (!wasTap) return
    if (typeof document === 'undefined') return
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const countryId = target instanceof Element ? target.closest('[data-globe-country]')?.getAttribute('data-globe-country') : null
    if (countryId) onSelectCountry(countryId)
  }, [clearDrag, onSelectCountry])

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
    const seenCountryIds = new Set<string>()
    return landmasses
      .map((feature, index) => {
        const includedSegments: string[] = []
        let depthSum = 0
        let depthCount = 0

        for (const ring of feature.rings) {
          const projected = ring.map(([lon, lat]) => project(lat, lon, rotation, radius))
          if (projected.length === 0) continue

          // ROOT CAUSE of a selected country (e.g. Australia) suddenly
          // ballooning to cover a huge chunk of the visible sphere: an
          // orthographic projection maps the FAR hemisphere onto the
          // very same 2D disc as the near one — a point exactly
          // antipodal to the view centre projects to (0,0), i.e. dead
          // centre of the globe, not off to some conveniently offscreen
          // location. The old code decided whether to draw a ring
          // whole-or-nothing based on whether a MAJORITY of its points
          // were visible, then joined every point (including the
          // minority still on the far side) with straight `L` lines.
          // So a ring that was, say, 80% visible would still draw a
          // line from a real coastline point stright through to a
          // back-side vertex that had projected near the centre of the
          // disc — exactly the "country expands across most of the
          // globe" artifact in the bug report.
          //
          // Fix: split each ring into runs of CONSECUTIVE visible
          // points only, and never draw a line between a visible and a
          // non-visible vertex. Each run becomes its own closed
          // sub-path. This is a straight-chord approximation of the
          // true horizon clip (a proper spherical polygon clip would
          // curve along the limb instead of cutting a straight line
          // across it) — visually indistinguishable for the common
          // case of a mostly-visible country with only its extreme tip
          // near the limb, and it can never connect to a wildly
          // mis-projected far-side point.
          const runs: { x: number; y: number; depth: number }[][] = []
          let current: { x: number; y: number; depth: number }[] = []
          for (const p of projected) {
            if (p.visible) {
              current.push({ x: p.x, y: p.y, depth: p.depth })
            } else if (current.length > 0) {
              runs.push(current)
              current = []
            }
          }
          if (current.length > 0) runs.push(current)

          // A ring's point array isn't circularly closed by the split
          // above — if the ring both starts AND ends visible, that's
          // one continuous visible arc that got cut in two purely
          // because of where the array happens to start. Splice the
          // trailing run onto the front of the leading one so it draws
          // as the single unbroken shape it actually is.
          if (runs.length > 1 && projected[0]?.visible && projected[projected.length - 1]?.visible) {
            const first = runs.shift()
            const last = runs.pop()
            if (first && last) runs.push([...last, ...first])
          }

          for (const run of runs) {
            // A 1-2 point sliver isn't a meaningful fillable area.
            if (run.length < 3) continue
            includedSegments.push(
              run.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(center + p.x).toFixed(1)},${(center + p.y).toFixed(1)}`).join(' ') + ' Z'
            )
            for (const p of run) {
              depthSum += p.depth
              depthCount += 1
            }
          }
        }

        if (includedSegments.length === 0) return null

        // Defensive dedupe: if more than one raw landmass feature ever
        // resolved to the same Cellfie country id (a data anomaly — e.g.
        // an external territory sharing its parent's ISO code), only the
        // FIRST is treated as selectable/highlightable. Two different
        // on-screen shapes both claiming to BE the selected country is
        // exactly what would look like the selection "jumping" between
        // shapes as the globe rotates, so this closes that off at the
        // source regardless of whether it can currently occur with the
        // shipped dataset.
        let countryId = feature.countryId
        if (countryId) {
          if (seenCountryIds.has(countryId)) {
            countryId = null
          } else {
            seenCountryIds.add(countryId)
          }
        }

        return {
          key: `landmass-${index}`,
          countryId,
          d: includedSegments.join(' '),
          opacity: Math.max(0.4, depthCount > 0 ? depthSum / depthCount : 1)
        }
      })
      .filter((entry): entry is { key: string; countryId: string | null; d: string; opacity: number } => entry !== null)
  }, [style, landmasses, rotation, radius, center])

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
        onPointerUp={handlePointerUp}
        onPointerCancel={clearDrag}
        onWheel={handleWheel}
      >
        <defs>
          <radialGradient id="globe-sphere" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="var(--color-surface-raised, #2a3330)" />
            <stop offset="100%" stopColor="var(--color-surface, #1c2422)" />
          </radialGradient>
          {/* Real World style's ocean — a separate gradient rather than recoloring `globe-sphere` in place, so the Dark Scientific style (still using `globe-sphere` above) is provably untouched by this addition.
              Brightened from the original (#3d7ea6 → #1f4a63) — the previous stops read as dark/muted on Android, per the contrast bug report — while staying a restrained, believable ocean blue rather than an oversaturated one. Nudged slightly brighter again per follow-up feedback ("contrast can still be improved slightly"). */}
          <radialGradient id="globe-ocean" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7cbfe6" />
            <stop offset="100%" stopColor="#2c6a90" />
          </radialGradient>

          {/* Lightweight "looks more 3D" pass, Real style only — see the
              three overlay layers below for how these are used. All
              three share the same cx/cy (35%,30%) as `globe-sphere` and
              `globe-ocean` above, so the implied light source has
              always been up-and-to-the-left in this app; these just make
              it visible instead of leaving it implicit in the base
              gradients. Because each is defined relative to the sphere's
              own `cx`/`cy`/`r` (not fixed page coordinates), they rotate
              and scale with the globe automatically — there's no extra
              state to keep in sync, and nothing can make the lighting
              "slide independently" of the sphere. */}
          <radialGradient id="globe-specular" cx="32%" cy="26%" r="55%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
            <stop offset="45%" stopColor="#ffffff" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="globe-vignette" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#08130f" stopOpacity={0} />
            <stop offset="72%" stopColor="#08130f" stopOpacity={0} />
            <stop offset="100%" stopColor="#08130f" stopOpacity={0.4} />
          </radialGradient>
          <radialGradient id="globe-atmosphere" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9fd3f0" stopOpacity={0} />
            <stop offset="90%" stopColor="#9fd3f0" stopOpacity={0} />
            <stop offset="97%" stopColor="#9fd3f0" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#9fd3f0" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Atmosphere glow — Real style only, drawn BEFORE the sphere so
            it only ever shows as a thin bright ring just outside the
            sphere's own edge, never over the geography itself. A pure
            gradient (no blur filter) — cheap, and avoids the perf/paint
            cost of a real Gaussian blur on Android. `pointerEvents="none"`
            throughout this whole enhancement pass so `elementFromPoint`
            (the country tap hit-test added in the selection fix) always
            sees straight through to the actual landmass/marker beneath. */}
        {style === 'real' && (
          <circle cx={center} cy={center} r={radius * 1.05} fill="url(#globe-atmosphere)" pointerEvents="none" />
        )}

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

        {/* Real World country landmasses — see the `landmassPaths` doc comment above for the visibility/simplification tradeoffs.
            Contrast pass: land now renders as a deeper, more defined green
            (hardcoded here rather than the shared `fill-olive` design
            token, which stays untouched for the rest of the app) at
            higher opacity, AND every country — not just the selected one —
            gets a thin border stroke. Previously only the selected country
            had any stroke at all, so two unselected neighbouring countries
            rendered with the exact same fill and no line between them,
            which is why boundaries "disappeared into the land color" per
            the bug report. */}
        {style === 'real' &&
          landmassPaths.map(({ key, countryId, d, opacity }) => {
            const isSelected = Boolean(countryId) && countryId === selectedCountryId
            return (
              <path
                key={key}
                data-globe-country={countryId ?? undefined}
                d={d}
                fillRule="evenodd"
                opacity={opacity}
                className={cn(countryId ? 'cursor-pointer' : 'cursor-default')}
                fill={isSelected ? 'var(--color-highlight-terracotta)' : '#2f5c38'}
                fillOpacity={isSelected ? 0.9 : 0.85}
                stroke={isSelected ? 'var(--color-highlight-terracotta)' : 'rgba(255, 255, 255, 0.4)'}
                strokeWidth={isSelected ? 1.5 : 0.6}
              />
            )
          })}

        {/* Curvature/lighting pass, Real style only — two overlays, both
            purely decorative (`pointerEvents="none"`) and both clipped to
            the sphere's own circle so they can never bleed outside it or
            enlarge the apparent globe:
              1. A soft specular highlight (upper-left, matching the same
                 light-source position used by every gradient on this
                 globe) using `mixBlendMode: 'screen'` so it brightens
                 what's underneath instead of flattening it to white —
                 country colours and boundaries stay legible through it.
              2. A gentle vignette darkening the outer ~28% of the disc,
                 which reads as the sphere curving away from the viewer
                 near the limb — layered on top of (not instead of) the
                 existing per-country depth-based fade already computed
                 in `landmassPaths`' `opacity`, not a replacement for it. */}
        {style === 'real' && (
          <>
            <circle cx={center} cy={center} r={radius} fill="url(#globe-specular)" pointerEvents="none" style={{ mixBlendMode: 'screen' }} />
            <circle cx={center} cy={center} r={radius} fill="url(#globe-vignette)" pointerEvents="none" />
          </>
        )}

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
              data-globe-country={country.id}
              transform={`translate(${center + p.x}, ${center + p.y})`}
              opacity={subdued ? nearLimbFade * 0.5 : nearLimbFade}
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
