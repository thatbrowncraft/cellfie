/**
 * core/search — Sprint 2 §7, "search simultaneously across Notes,
 * Highlights, Bookmarks, Book titles, and Tags." Deliberately client-side
 * substring matching over Dexie's tables rather than a search index —
 * consistent with the Knowledge Engine Spec's chunking/indexing/full-text
 * search remaining out of scope (see core/db/index.ts's top comment);
 * this covers the *metadata* search Sprint 2 actually asks for, not
 * full-text search inside PDF bodies.
 *
 * Used by both the Cmd/Ctrl+K Universal Search overlay (app-wide) and the
 * Notebook page's search/filter bar (notes-only, more detailed).
 */

import { db, type Collection, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../db'

export interface SearchResult {
  id: string
  kind: 'note' | 'highlight' | 'bookmark' | 'book' | 'tag' | 'concept'
  title: string
  subtitle?: string
  /** In-app path to navigate to when this result is chosen. */
  path: string
}

function matches(haystack: string | undefined, needle: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(needle))
}

export interface SearchResultGroup {
  label: string
  results: SearchResult[]
}

/** Runs the full cross-entity search described in Sprint 2 §7. Empty query returns no results (nothing to browse). */
export async function searchEverything(query: string): Promise<SearchResultGroup[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const [items, notes, highlights, bookmarks, collections, concepts] = await Promise.all([
    db.libraryItems.toArray(),
    db.notes.toArray(),
    db.highlights.toArray(),
    db.readerBookmarks.toArray(),
    db.collections.toArray(),
    db.concepts.toArray()
  ])

  const itemsById = new Map(items.map((i) => [i.id, i]))

  const bookResults: SearchResult[] = items
    .filter((item) => matches(item.title, q) || matches(item.author, q))
    .map((item) => ({
      id: item.id,
      kind: 'book',
      title: item.title,
      subtitle: item.author,
      path: `/library/${item.id}/read`
    }))

  const noteResults: SearchResult[] = notes
    .filter((note) => matches(note.title, q) || matches(note.contentMarkdown, q) || note.tags.some((t) => matches(t, q)))
    .map((note) => ({
      id: note.id,
      kind: 'note',
      title: note.title,
      subtitle: note.itemId ? itemsById.get(note.itemId)?.title : undefined,
      path: '/notes'
    }))

  const highlightResults: SearchResult[] = highlights
    .filter((h) => matches(h.text, q) || matches(h.note, q))
    .map((h) => ({
      id: h.id,
      kind: 'highlight',
      title: h.text.slice(0, 80),
      subtitle: itemsById.get(h.itemId)?.title ?? 'Highlight',
      path: `/library/${h.itemId}/read?page=${h.page}`
    }))

  const bookmarkResults: SearchResult[] = bookmarks
    .filter((b) => matches(itemsById.get(b.itemId)?.title, q))
    .map((b) => ({
      id: b.id,
      kind: 'bookmark',
      title: `Page ${b.page}`,
      subtitle: itemsById.get(b.itemId)?.title,
      path: `/library/${b.itemId}/read?page=${b.page}`
    }))

  const tagSet = new Set<string>()
  for (const note of notes) for (const t of note.tags) tagSet.add(t)
  for (const item of items) for (const t of item.tags) tagSet.add(t)
  const tagResults: SearchResult[] = Array.from(tagSet)
    .filter((t) => matches(t, q))
    .map((t) => ({ id: t, kind: 'tag', title: `#${t}`, path: `/notes?tag=${encodeURIComponent(t)}` }))

  // Sprint 3 §15: Concept results in the same universal search, clearly
  // labeled with their own group like every other content type.
  const conceptResults: SearchResult[] = concepts
    .filter((c) => matches(c.name, q) || c.aliases.some((a) => matches(a, q)) || c.tags.some((t) => matches(t, q)))
    .map((c) => ({
      id: c.id,
      kind: 'concept',
      title: c.name,
      subtitle: c.description ? c.description.slice(0, 60) : 'Concept',
      path: `/concepts/${c.id}`
    }))

  // Collections aren't part of the Sprint 2 result set per §7, but a name
  // match is cheap context worth folding into "Book titles" since a
  // collection often *is* how someone thinks of a subject/shelf.
  void collections

  const groups: SearchResultGroup[] = [
    { label: 'Concepts', results: conceptResults },
    { label: 'Notes', results: noteResults },
    { label: 'Highlights', results: highlightResults },
    { label: 'Bookmarks', results: bookmarkResults },
    { label: 'Books', results: bookResults },
    { label: 'Tags', results: tagResults }
  ]

  return groups.filter((g) => g.results.length > 0)
}

/** Scoped to a single LibraryItem — powers the reader sidebar's "search inside this book" (Sprint 2 §6). */
export function searchWithinBook(
  query: string,
  highlights: Highlight[],
  notes: Note[],
  bookmarks: ReaderBookmark[]
): { highlights: Highlight[]; notes: Note[]; bookmarks: ReaderBookmark[] } {
  const q = query.trim().toLowerCase()
  if (!q) return { highlights, notes, bookmarks }
  return {
    highlights: highlights.filter((h) => matches(h.text, q) || matches(h.note, q)),
    notes: notes.filter((n) => matches(n.title, q) || matches(n.contentMarkdown, q) || n.tags.some((t) => matches(t, q))),
    bookmarks: bookmarks.filter((b) => matches(String(b.page), q))
  }
}

export type { Collection, LibraryItem }
