import { useEffect, useRef, useState } from 'react'
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

  // Keep the popover on-screen: clamp within an 8px margin of the viewport.
  const width = 280
  const left = Math.min(Math.max(anchor.x - width / 2, 8), window.innerWidth - width - 8)
  const top = Math.min(Math.max(anchor.y, 8), window.innerHeight - 320)

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={highlight ? 'Edit highlight' : 'Highlight this text'}
      className="fixed z-50 flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-3 animate-in"
      style={{ left, top, width }}
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
