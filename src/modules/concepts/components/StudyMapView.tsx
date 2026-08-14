import { useRef, useState } from 'react'
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut } from '@phosphor-icons/react'
import type { StudyMapTreeNode } from '@/core/concepts'

interface StudyMapViewProps {
  root: StudyMapTreeNode
  /** Compact mode is used for the Visuals tab's "Generate study diagram"
   *  fallback — smaller text, no zoom chrome, meant to sit inside a card
   *  rather than fill the whole Mind Map tab. */
  compact?: boolean
}

const ZOOM_STEPS = [0.75, 0.85, 1, 1.15, 1.3, 1.5]
const DEFAULT_ZOOM_INDEX = 2

/**
 * Concept Hub Quality Pass §4 — the generated Study Map's renderer.
 * Deliberately DOM/flexbox-based, not a canvas/SVG coordinate layout:
 * this is the same proven approach `ConceptMindMap`'s own tree already
 * uses (see that file's header comment) — it wraps naturally instead of
 * needing manual node positioning, so there is no giant fixed-width
 * diagram to make responsive in the first place. The one addition here
 * is a scale control (`ZOOM_STEPS`) applied via CSS `transform`, plus a
 * "fit to screen" reset — both operate on an `overflow-auto` container
 * that is itself always constrained to the card's own width, so
 * scrolling/zooming happens inside the box, never the page. This keeps
 * pinch-to-zoom working too: it's the browser's native page/element zoom
 * behavior over ordinary scrollable HTML, not a custom touch handler
 * that could get the gesture wrong on a device this was never tested on.
 */
export function StudyMapView({ root, compact = false }: StudyMapViewProps) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scale = ZOOM_STEPS[zoomIndex]

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

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="rounded-md border border-border bg-surface p-1.5 text-ink-secondary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagnifyingGlassMinus size={14} />
          </button>
          <span className="min-w-[3.5ch] text-center font-ui text-micro text-ink-tertiary">
            {Math.round(scale * 100)}%
          </span>
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
      )}

      {/* This wrapper — not the page — owns any overflow. `max-w-full` +
          `overflow-auto` means a scaled-up map scrolls inside the card;
          it can never push the Concept page itself into horizontal
          scroll or shove the bottom navigation off-screen. */}
      <div
        ref={scrollRef}
        className={`max-w-full overflow-auto rounded-md border border-border bg-surface-raised/40 ${compact ? 'max-h-64 p-3' : 'max-h-[60vh] p-4'}`}
      >
        <div style={{ transform: `scale(${compact ? 1 : scale})`, transformOrigin: 'top left' }} className="w-fit">
          <StudyMapBranch node={root} isRoot compact={compact} />
        </div>
      </div>
    </div>
  )
}

function StudyMapBranch({
  node,
  isRoot = false,
  compact = false
}: {
  node: StudyMapTreeNode
  isRoot?: boolean
  compact?: boolean
}) {
  if (isRoot) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div
          className={`rounded-lg bg-terracotta font-ui font-medium text-canvas ${compact ? 'px-3 py-1.5 text-caption' : 'px-4 py-2 text-body'}`}
        >
          {node.label}
        </div>
        {node.children.length > 0 && (
          <div className="flex w-full flex-col gap-2 border-l-2 border-border pl-4">
            {node.children.map((child) => (
              <StudyMapBranch key={child.id} node={child} compact={compact} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`w-fit max-w-full rounded-md border border-border bg-surface font-ui font-medium text-ink-primary ${compact ? 'px-2.5 py-1 text-micro' : 'px-3 py-1.5 text-caption'}`}
      >
        {node.label}
      </div>
      {node.children.length > 0 && (
        <div className="flex flex-col gap-2 border-l-2 border-border pl-4">
          {node.children.map((child) => (
            <StudyMapLeaf key={child.id} node={child} compact={compact} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Bullet-level nodes (depth 3) render as plain text leaves — no further nesting, matching how deep the source data actually goes. */
function StudyMapLeaf({ node, compact }: { node: StudyMapTreeNode; compact?: boolean }) {
  return (
    <div
      className={`w-fit max-w-full rounded-md border border-dashed border-border-strong bg-surface px-2.5 py-1 font-ui text-ink-secondary ${compact ? 'text-micro' : 'text-micro'}`}
    >
      {node.label}
    </div>
  )
}
