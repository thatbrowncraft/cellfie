/**
 * core/db/highlights — write-side operations for Highlight records
 * (Sprint 2 §1/§2, Text Highlighting + Sticky Notes). Mirrors the shape
 * of `core/db/bookmarks.ts`: mutations live here, read-side access is via
 * `useLiveQuery` directly against `db.highlights` from the reader module.
 */

import { db, type Highlight, type HighlightColor, type HighlightRect } from './index'

export interface CreateHighlightInput {
  itemId: string
  page: number
  color: HighlightColor
  rects: HighlightRect[]
  text: string
}

export async function addHighlight(input: CreateHighlightInput): Promise<Highlight> {
  const now = Date.now()
  const highlight: Highlight = {
    id: crypto.randomUUID(),
    itemId: input.itemId,
    page: input.page,
    color: input.color,
    rects: input.rects,
    text: input.text,
    createdAt: now,
    updatedAt: now
  }
  await db.highlights.add(highlight)
  return highlight
}

export async function updateHighlightColor(id: string, color: HighlightColor): Promise<void> {
  await db.highlights.update(id, { color, updatedAt: Date.now() })
}

/** Sets (or clears, with an empty string) the sticky note attached to a highlight. */
export async function updateHighlightNote(id: string, note: string): Promise<void> {
  await db.highlights.update(id, { note: note.trim() || undefined, updatedAt: Date.now() })
}

/** Removes a highlight. Any Note that links to it keeps its `highlightId` — the note stands on its own. */
export async function removeHighlight(id: string): Promise<void> {
  await db.highlights.delete(id)
}
