/**
 * core/concepts/stats — Sprint 3 §14, statistics derived from actual
 * IndexedDB relationships. Nothing here is hardcoded; every number comes
 * from counting ConceptSource rows (or, for library-wide totals, the
 * concepts/libraryItems/notes/highlights tables directly).
 */

import { db, type Concept, type ConceptSource, type LibraryItem } from '../db'

export interface ConceptStats {
  bookCount: number
  pageCount: number
  highlightCount: number
  noteCount: number
  bookmarkCount: number
  sourceCount: number
  firstSeenAt: number
  lastSeenAt: number
}

/** Pure aggregation over already-fetched sources — mirrors core/stats's `computeStatsFromRecords` pattern so a detail page can drive this from its own `useLiveQuery` subscription. */
export function computeConceptStats(concept: Concept, sources: ConceptSource[]): ConceptStats {
  const books = new Set(sources.filter((s) => s.libraryItemId).map((s) => s.libraryItemId as string))
  const pages = new Set(
    sources.filter((s) => s.libraryItemId && s.pageNumber != null).map((s) => `${s.libraryItemId}:${s.pageNumber}`)
  )
  return {
    bookCount: books.size,
    pageCount: pages.size,
    highlightCount: sources.filter((s) => s.sourceType === 'highlight').length,
    noteCount: sources.filter((s) => s.sourceType === 'note').length,
    bookmarkCount: sources.filter((s) => s.sourceType === 'bookmark').length,
    sourceCount: sources.length,
    firstSeenAt: concept.firstSeenAt,
    lastSeenAt: concept.lastSeenAt
  }
}

export interface KnowledgeSummary {
  conceptCount: number
  noteCount: number
  highlightCount: number
  bookCount: number
}

/** Library-wide Knowledge section numbers for the Dashboard (§17). */
export async function computeKnowledgeSummary(): Promise<KnowledgeSummary> {
  const [conceptCount, noteCount, highlightCount, bookCount] = await Promise.all([
    db.concepts.count(),
    db.notes.count(),
    db.highlights.count(),
    db.libraryItems.count()
  ])
  return { conceptCount, noteCount, highlightCount, bookCount }
}

/** Concepts with the most linked sources — backs the "Most referenced" filter (§7) and the Dashboard's "Recently explored" list (§17, by recency instead). */
export async function getMostReferencedConcepts(limit: number): Promise<Concept[]> {
  const [concepts, sources] = await Promise.all([db.concepts.toArray(), db.conceptSources.toArray()])
  const counts = new Map<string, number>()
  for (const s of sources) counts.set(s.conceptId, (counts.get(s.conceptId) ?? 0) + 1)
  return [...concepts].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, limit)
}

export async function getRecentlyUsedConcepts(limit: number): Promise<Concept[]> {
  return db.concepts.orderBy('lastSeenAt').reverse().limit(limit).toArray()
}

export function itemTitleLookup(items: LibraryItem[]): Map<string, LibraryItem> {
  return new Map(items.map((i) => [i.id, i]))
}
