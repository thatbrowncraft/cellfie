import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NotePencil, Trash, X } from '@phosphor-icons/react'
import { highlightColors, highlightColorLabels, type Highlight, type HighlightColor } from '@/core/db'
import { useClickOutside } from '@/shared/hooks'
import { cn } from '@/shared/utils/cn'
import { markerColorVar } from './HighlightsLayer'

export interface PopoverAnchor {
  x: number
  y: number
}

interface HighlightPopoverProps {
  anchor: PopoverAnchor
  /** Present when editing an existing highlight; absent when creating one from a fresh selection. */
  highlight?: Highlight
  onPickColor: (color: HighlightColor) => void
  onSaveNote: (note: string) => void
  onOpenFullNote?: () => void
  onDelete?: () => void
  onClose: () => void
}

const swatchClass =
  'h-7 w-7 shrink-0 rounded-full border-2 transition-transform duration-micro hover:scale-110 focus-visible:scale-110'

const POPOVER_WIDTH = 280
// Bottom-of-viewport popup clipping bugfix: requested ~12-16px safe margin
// from any viewport edge.
const MARGIN = 14
// Rough guesses used only for the very first paint, before the real
// rendered height is measured and corrected a frame later (see the
// `useLayoutEffect` below) — this just avoids a visible jump on mount.
// Edit mode (color row + quote + sticky note + actions) is meaningfully
// taller than create mode (color row only).
const ESTIMATED_HEIGHT = { create: 90, edit: 380 }

/**
 * Chooses a `left`/`top` for the popover that keeps it fully inside the
 * visible viewport, given its actual (or estimated) rendered `height`.
 * Opens below the anchor when there's room, otherwise flips above it —
 * this is what was missing before: the old logic always opened downward
 * and only clamped against a hardcoded height guess, so a popover taller
 * than that guess (edit mode, near the bottom of the screen) still ended
 * up with its lower half off-screen. `maxHeight` is a final safety net so
 * the popover can never exceed the visible viewport height even on a very
 * short screen.
 */
function computePosition(anchor: PopoverAnchor, height: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const left = Math.min(Math.max(anchor.x - POPOVER_WIDTH / 2, MARGIN), Math.max(MARGIN, vw - POPOVER_WIDTH - MARGIN))

  const maxHeight = Math.max(vh - MARGIN * 2, 120)
  const clampedHeight = Math.min(height, maxHeight)

  const spaceBelow = vh - anchor.y - MARGIN
  const spaceAbove = anchor.y - MARGIN
  // Prefer opening below the selection (matches prior behavior); only
  // flip above when there isn't room below but there is more room above.
  const openAbove = spaceBelow < clampedHeight && spaceAbove > spaceBelow

  let top = openAbove ? anchor.y - clampedHeight - MARGIN : anchor.y + MARGIN
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - clampedHeight - MARGIN))

  return { left, top, maxHeight }
}

/**
 * Floating popover anchored to a selection or an existing highlight.
 * Create mode: four color swatches only (Sprint 2 §1). Edit mode adds a
 * sticky-note textarea (§2), "Open as full note" (links to §3/§5's
 * Standalone/Linked Notes), and delete.
 */
export function HighlightPopover({
  anchor,
  highlight,
  onPickColor,
  onSaveNote,
  onOpenFullNote,
  onDelete,
  onClose
}: HighlightPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [noteDraft, setNoteDraft] = useState(highlight?.note ?? '')
  useClickOutside(containerRef, onClose, true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const [pos, setPos] = useState(() => computePosition(anchor, ESTIMATED_HEIGHT[highlight ? 'edit' : 'create']))

  // Re-measure the popover's actual rendered height (create vs. edit mode
  // differ a lot) and reposition before paint — this is what makes the
  // fix accurate rather than relying on a hardcoded height guess. Also
  // re-runs on resize/orientation change so it stays correct across
  // device rotation and responsive breakpoints.
  useLayoutEffect(() => {
    function reposition() {
      const el = containerRef.current
      if (!el) return
      setPos(computePosition(anchor, el.getBoundingClientRect().height))
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('orientationchange', reposition)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('orientationchange', reposition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.x, anchor.y, highlight])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={highlight ? 'Edit highlight' : 'Highlight this text'}
      className="fixed z-50 flex flex-col gap-3 overflow-y-auto rounded-md border border-border bg-surface p-4 shadow-3 animate-in"
      style={{ left: pos.left, top: pos.top, width: POPOVER_WIDTH, maxHeight: pos.maxHeight }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" role="group" aria-label="Highlight color">
          {highlightColors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={highlightColorLabels[color]}
              aria-pressed={highlight?.color === color}
              onClick={() => onPickColor(color)}
              className={cn(swatchClass, highlight?.color === color ? 'border-ink-primary' : 'border-transparent')}
              style={{ backgroundColor: `var(${markerColorVar[color]})` }}
            />
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-ink-tertiary hover:text-ink-primary">
          <X size={16} />
        </button>
      </div>

      {highlight && (
        <>
          <p className="line-clamp-3 font-body text-caption italic text-ink-secondary">"{highlight.text.trim()}"</p>

          <label htmlFor="highlight-note" className="font-ui text-caption font-medium text-ink-primary">
            Sticky note
          </label>
          <textarea
            id="highlight-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => onSaveNote(noteDraft)}
            rows={3}
            placeholder="Add a note about this highlight…"
            className="w-full resize-none rounded-sm border border-border bg-canvas px-3 py-2 font-ui text-caption text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-2 focus:border-olive"
          />

          <div className="flex items-center justify-between border-t border-border pt-3">
            {onOpenFullNote && (
              <button
                type="button"
                onClick={onOpenFullNote}
                className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline"
              >
                <NotePencil size={15} />
                Open as full note
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete highlight"
                className="flex items-center gap-1.5 font-ui text-caption font-medium text-error hover:underline"
              >
                <Trash size={15} />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
