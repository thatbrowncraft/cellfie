/**
 * core/concepts/librarySearch — Knowledge Model Correction §3/§5. On-demand,
 * read-only search of the user's local library (PDF, EPUB, or HTML/XHTML —
 * Book Import Formats §17-24) for a literal term, powering the Concept
 * Explorer's "search, then explicitly promote" flow:
 *
 *   user searches "Gram staining"
 *     → this finds every book/page it literally appears on
 *     → shown as "Found in: Prescott's Microbiology · 7 pages"
 *     → user clicks "Add to Concepts" (see `promoteConceptCandidate` in
 *       ./service) — only then does anything get written to the database.
 *
 * Deliberately NOT a persisted full-text index — no new dependency is
 * allowed to build one (§19), so this reuses `documentText.ts`'s format-
 * agnostic page reader at search time, the same way `extraction.ts`
 * already does for the "scan this book for this concept" flow. A search
 * finding nothing writes nothing; nothing here ever creates a Concept.
 */

import { db, type LibraryItem } from '../db'
import { openLibraryDocument } from './documentText'

export interface LibraryTermMatch {
  item: LibraryItem
  pages: number[]
}

/**
 * Soft ceiling on total pages read across one search call. Without a
 * persisted index this can't be made instant for a very large library —
 * this cap keeps a search from hanging the UI indefinitely rather than
 * pretending the search is exhaustive; see the correction report for the
 * honest limitation this implies.
 */
const MAX_PAGES_SCANNED_PER_SEARCH = 4000

/**
 * §Phase 6 addition (Knowledge Layer + Source Library brief) — an
 * optional allow-list of `LibraryItem.id`s to restrict the scan to.
 * Added as an optional third state (not a new function) specifically
 * so "Choose a specific source" can reuse this exact same scan loop
 * for a single book instead of a second, near-duplicate implementation
 * (§45 — "do not duplicate retrieval logic"). Omitting it preserves
 * the original "search every indexed book" behavior byte-for-byte.
 */
export async function searchLibraryForTerm(term: string, itemIds?: string[]): Promise<LibraryTermMatch[]> {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []

  const allItems = await db.libraryItems.toArray()
  const items = itemIds ? allItems.filter((item) => itemIds.includes(item.id)) : allItems
  const results: LibraryTermMatch[] = []
  let pagesScanned = 0

  for (const item of items) {
    if (pagesScanned >= MAX_PAGES_SCANNED_PER_SEARCH) break
    if (!item.pageCount) continue

    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch {
      continue
    }
    const pages: number[] = []

    for (let page = 1; page <= item.pageCount; page += 1) {
      if (pagesScanned >= MAX_PAGES_SCANNED_PER_SEARCH) break
      const { flat: pageText } = await vdoc.getPageText(page)
      pagesScanned += 1
      if (pageText.toLowerCase().includes(q)) pages.push(page)
    }

    if (pages.length > 0) results.push({ item, pages })
  }

  return results.sort((a, b) => b.pages.length - a.pages.length)
}
