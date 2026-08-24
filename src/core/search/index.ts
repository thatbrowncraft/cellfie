/**
 * core/search — Sprint 2 §7, "search simultaneously across Notes,
 * Highlights, Bookmarks, Book titles, and Tags." Deliberately client-side
 * substring matching over Dexie's tables rather than a search index —
 * consistent with the Knowledge Engine Spec's chunking/indexing/full-text
 * search remaining out of scope (see core/db/index.ts's top comment);
 * this covers the *metadata* search Sprint 2 actually asks for, not
 * full-text search inside PDF bodies.
 *
 * Used by both the Cmd/Ctrl+K Universal Search overlay (app-wide, rendered
 * from AppShell on every route) and the Notebook page's search/filter bar
 * (notes-only, more detailed).
 *
 * Bundle-size remediation (stage 2): `core/laboratory/registry.ts` holds
 * every Laboratory item's *full* content (steps, formulas, comparisons —
 * not just title/category), because it doubles as that module's content
 * store. `searchLaboratory()` only ever returns the lightweight
 * `LaboratorySearchHit` shape (id, category, title, subtitle) — that's
 * the metadata index this module actually needs. Since AppShell renders
 * Universal Search on first paint for every route, a *static* import of
 * `searchLaboratory` here would drag the full registry (and its eager
 * JSON glob) into whatever chunk AppShell lives in. Importing it
 * dynamically, inside `searchEverything`, keeps that content in its own
 * chunk that only loads the first time someone actually searches —
 * Dashboard and every other route render without it.
 */

import { db, type Collection, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../db'

export interface SearchResult {
  id: string
  kind: 'note' | 'highlight' | 'bookmark' | 'book' | 'tag' | 'concept' | 'laboratory'
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

  // Laboratory Module, Tier 1 (brief §21/§22) — Laboratory content is
  // curated and bundled (see core/laboratory/registry.ts), so once loaded
  // its search is synchronous and local like the rest of this function's
  // in-memory filtering. The registry module itself is fetched via a
  // dynamic import (see this file's header comment) so it stays out of
  // AppShell's chunk; the browser/PWA cache makes this effectively
  // instant after the first search of a session.
  const { searchLaboratory } = await import('../laboratory/registry')
  const laboratoryResults: SearchResult[] = searchLaboratory(query).map((hit) => ({
    id: hit.id,
    kind: 'laboratory',
    title: hit.title,
    subtitle: hit.subtitle,
    path: `/laboratory/${hit.category}/${hit.id}`
  }))

  // Laboratory Clinical Expansion — same dynamic-import pattern as the
  // main Laboratory registry above, applied to the separate, also-lazy
  // clinicalRegistry module (see that file's header comment on why it's
  // kept out of both the Laboratory chunk and this Universal Search
  // chunk until a search is actually run). Clinical hits are folded into
  // the same "Laboratory" result group rather than a separate group,
  // since from the person's point of view they're all Laboratory content
  // — the distinct `/laboratory/clinical/...` path is what actually
  // routes them correctly, not a different UI grouping.
  const { searchClinicalLaboratory, labContentPath } = await import('../laboratory/clinicalRegistry')
  const clinicalResults: SearchResult[] = (await searchClinicalLaboratory(query)).map((hit) => ({
    id: hit.id,
    kind: 'laboratory',
    title: hit.title,
    subtitle: hit.discipline ? `${hit.subtitle} · ${hit.discipline}` : hit.subtitle,
    path: labContentPath(hit.id, hit.category)
  }))

  const groups: SearchResultGroup[] = [
    { label: 'Concepts', results: conceptResults },
    { label: 'Laboratory', results: [...laboratoryResults, ...clinicalResults] },
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
