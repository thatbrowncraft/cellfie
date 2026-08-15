import { useMemo, useRef, useState } from 'react'
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut, ArrowSquareOut } from '@phosphor-icons/react'
import { Dialog } from '@/shared/components'
import type { StudyMap, StudyMapNode } from '@/core/concepts'
import { computeStudyMapLayout, type PositionedNode } from '@/core/concepts/studyMapLayout'

interface StudyMapViewProps {
  map: StudyMap
}

const ZOOM_STEPS = [0.6, 0.75, 0.85, 1, 1.15, 1.3]
const DEFAULT_ZOOM_INDEX = 3

const KIND_STYLE: Record<StudyMapNode['kind'], string> = {
  root: 'bg-terracotta text-canvas font-medium border-transparent',
  category: 'bg-olive/15 text-ink-primary font-medium border-olive/40',
  step: 'bg-surface text-ink-primary font-medium border-border-strong',
  outcome: 'bg-sage/20 text-ink-primary font-medium border-sage/50',
  detail: 'bg-surface text-ink-secondary border-border border-dashed'
}

/**
 * Mind Map Redesign — the generated Study Map's renderer. An SVG layer
 * (built from `computeStudyMapLayout`, studyMapLayout.ts — pure
 * geometry, no measurement) draws the connecting lines/arrows; the
 * nodes themselves are ordinary absolutely-positioned buttons on top,
 * so label text still wraps/clamps like plain HTML instead of needing
 * manual SVG text layout. Tapping a non-root node with real underlying
 * text opens a detail dialog showing that text and its source — the
 * one thing the previous "stack of pills" version couldn't do at all.
 *
 * The whole diagram (`layout.width`×`layout.height`, computed once for
 * this concept's actual node count — never a giant fixed canvas) sits
 * inside an `overflow-auto` box that is itself always constrained to
 * the card's own width, so a wide/tall map scrolls inside the box, not
 * the page: no horizontal page overflow on mobile, and the available
 * width is used directly on desktop.
 */
export function StudyMapView({ map }: StudyMapViewProps) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [selected, setSelected] = useState<PositionedNode | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scale = ZOOM_STEPS[zoomIndex]

  const layout = useMemo(() => computeStudyMapLayout(map), [map])

  function zoomIn() {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))
  }
  function zoomOut() {
    setZoomIndex((i) => Math.max(i - 1, 0))
  }
  function fitToScreen() {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }

  const isProcedure = map.shape === 'procedure'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-ui text-micro text-ink-tertiary">
          {isProcedure ? 'Generated procedure flow — tap a step for detail.' : 'Generated concept map — tap a node for detail.'}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="rounded-md border border-border bg-surface p-1.5 text-ink-secondary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagnifyingGlassMinus size={14} />
          </button>
          <span className="min-w-[3.5ch] text-center font-ui text-micro text-ink-tertiary">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
            className="rounded-md border border-border bg-surface p-1.5 text-ink-secondary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagnifyingGlassPlus size={14} />
          </button>
          <button
            type="button"
            onClick={fitToScreen}
            aria-label="Fit to screen"
            className="ml-1 flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 font-ui text-micro text-ink-secondary hover:bg-surface-raised"
          >
            <ArrowsOut size={14} />
            Fit
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-w-full overflow-auto rounded-md border border-border bg-surface-raised/40 p-4"
        style={{ maxHeight: '65vh' }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: layout.width, height: layout.height }} className="relative">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              <marker id="study-map-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-border-strong)" />
              </marker>
            </defs>
            {layout.edges.map((e) => (
              <g key={e.id}>
                <path
                  d={e.d}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth={1.5}
                  markerEnd={isProcedure ? 'url(#study-map-arrow)' : undefined}
                />
                {e.label && e.labelX !== undefined && e.labelY !== undefined && (
                  <text
                    x={e.labelX}
                    y={e.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-ink-tertiary font-ui italic"
                    fontSize={9}
                    style={{ paintOrder: 'stroke', stroke: 'var(--color-bg-surface-raised)', strokeWidth: 3 }}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {layout.nodes.map((n) => {
            const tappable = n.kind !== 'root' && (Boolean(n.detail) || n.sourceRefs.length > 0)
            const boxClassName = `absolute flex items-center justify-center rounded-md border px-2.5 py-1.5 text-center font-ui text-micro leading-snug line-clamp-3 shadow-1 ${KIND_STYLE[n.kind]} ${
              tappable ? 'cursor-pointer hover:brightness-95' : ''
            } ${n.kind === 'root' ? 'text-body' : ''}`
            const boxStyle = { left: n.x, top: n.y, width: n.w, minHeight: n.h }
            return tappable ? (
              <button key={n.id} type="button" onClick={() => setSelected(n)} style={boxStyle} className={boxClassName}>
                {n.label}
              </button>
            ) : (
              <div key={n.id} style={boxStyle} className={boxClassName}>
                {n.label}
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <Dialog open onClose={() => setSelected(undefined)} title={selected.label}>
          <div className="flex flex-col gap-3">
            {selected.detail && <p className="font-body text-body text-ink-primary">{selected.detail}</p>}
            {selected.sourceRefs.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <span className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Source</span>
                {selected.sourceRefs.map((ref, i) => (
                  <a
                    key={`${ref.sourceUrl}-${i}`}
                    href={ref.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                  >
                    {ref.sourceName}
                    <ArrowSquareOut size={12} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}
