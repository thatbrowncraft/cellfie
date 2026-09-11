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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { GLOBE_COUNTRIES } from '@/core/world-explorer/countries'
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
}

export function Globe({ selectedCountryId, onSelectCountry }: GlobeProps) {
  const [rotation, setRotation] = useState<Rotation>({ lambda: 20, phi: -15 })
  const [scale, setScale] = useState(1)
  const svgRef = useRef<SVGSVGElement | null>(null)
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
        </defs>

        {/* Sphere body */}
        <circle cx={center} cy={center} r={radius} fill="url(#globe-sphere)" stroke="currentColor" strokeOpacity={0.25} className="text-border" />

        {/* Graticule — longitude/latitude wireframe, visible-hemisphere runs only */}
        <g fill="none" stroke="currentColor" strokeOpacity={0.18} className="text-ink-tertiary" strokeWidth={0.75}>
          {graticuleMeridians.map((pts, i) =>
            splitVisibleRuns(pts).map((run, j) => <polyline key={`m-${i}-${j}`} points={run} />)
          )}
          {graticuleParallels.map((pts, i) =>
            splitVisibleRuns(pts).map((run, j) => <polyline key={`p-${i}-${j}`} points={run} />)
          )}
        </g>

        {/* Country markers */}
        {markers.map(({ country, p }) => {
          if (!p.visible) return null
          const isSelected = country.id === selectedCountryId
          const nearLimbFade = Math.max(0.35, p.depth)
          const dotRadius = isSelected ? 5 : country.hasDeepProfile ? 3.4 : 2.4

          return (
            <g
              key={country.id}
              transform={`translate(${center + p.x}, ${center + p.y})`}
              opacity={nearLimbFade}
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
