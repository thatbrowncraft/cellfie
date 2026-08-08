/**
 * core/db/notes — write-side operations for Note records (Sprint 2 §3/§5,
 * Standalone Notes + Linked Notes). Mirrors `core/db/highlights.ts`:
 * mutations live here, read-side access is via `useLiveQuery` directly
 * against `db.notes` from the Notes/Notebook and reader modules.
 */

import { db, type Note } from './index'

export interface NoteInput {
  title: string
  contentMarkdown: string
  tags: string[]
  favorite: boolean
  pinned: boolean
  itemId?: string
  page?: number
  highlightId?: string
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of tags) {
    const t = raw.trim().toLowerCase()
    if (t) seen.add(t)
  }
  return Array.from(seen)
}

export async function createNote(input: NoteInput): Promise<Note> {
  const now = Date.now()
  const note: Note = {
    id: crypto.randomUUID(),
    title: input.title.trim() || 'Untitled note',
    contentMarkdown: input.contentMarkdown,
    tags: normalizeTags(input.tags),
    favorite: input.favorite,
    pinned: input.pinned,
    itemId: input.itemId,
    page: input.page,
    highlightId: input.highlightId,
    createdAt: now,
    updatedAt: now
  }
  await db.notes.add(note)
  return note
}

export async function updateNote(id: string, input: NoteInput): Promise<void> {
  await db.notes.update(id, {
    title: input.title.trim() || 'Untitled note',
    contentMarkdown: input.contentMarkdown,
    tags: normalizeTags(input.tags),
    favorite: input.favorite,
    pinned: input.pinned,
    itemId: input.itemId,
    page: input.page,
    highlightId: input.highlightId,
    updatedAt: Date.now()
  })
}

export async function toggleNoteFavorite(id: string): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, { favorite: !note.favorite, updatedAt: Date.now() })
}

export async function toggleNotePinned(id: string): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, { pinned: !note.pinned, updatedAt: Date.now() })
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id)
}

/** Creates a note pre-linked to a highlight, seeding the body with the highlighted text as a quote. */
export async function createNoteFromHighlight(params: {
  itemId: string
  itemTitle: string
  page: number
  highlightId: string
  highlightedText: string
}): Promise<Note> {
  const quote = params.highlightedText.trim()
  const body = quote ? `> ${quote.replace(/\n+/g, ' ')}\n\n` : ''
  return createNote({
    title: `Note on ${params.itemTitle}, p.${params.page}`,
    contentMarkdown: body,
    tags: [],
    favorite: false,
    pinned: false,
    itemId: params.itemId,
    page: params.page,
    highlightId: params.highlightId
  })
}
