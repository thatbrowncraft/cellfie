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
 * Root-cause fix for "Local Library search can sit on Searching… until
 * it times out, even for a book that plainly contains the term"
 * (Final Polish brief §03). The previous loop below awaited
 * `vdoc.getPageText(page)` one page at a time — a single `for` loop with
 * one `await` per iteration — for every page of every indexed book. For
 * a real few-hundred-page textbook that is a long, unbroken chain of
 * sequential PDF.js text-extraction calls with zero parallelism, and it
 * routinely ran past `LIBRARY_SEARCH_TIMEOUT_MS`
 * (core/organisms/librarySources.ts) well before reaching the page the
 * term was actually on — which is exactly the "taking longer than
 * expected" state the brief reports, not a hang and not a missing
 * index.
 *
 * PDF.js supports reading multiple pages of the same open document
 * concurrently (each `getTextContent` call operates on its own page
 * object), so this reads pages in small fixed-size batches with
 * `Promise.all` instead of one at a time. This is a real, structural
 * speed-up (roughly `SEARCH_BATCH_SIZE`×) rather than "just raise the
 * timeout" — it changes how much real work happens per second, not how
 * long the UI is willing to wait for the same slow work.
 */
const SEARCH_BATCH_SIZE = 6

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

    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch {
      continue
    }

    // Root-cause fix for "an uploaded book search returns nothing even
    // though it contains the term": the old guard skipped a book
    // entirely whenever the *stored* `item.pageCount` was missing/stale
    // (e.g. an older import, or metadata that drifted from the actual
    // file). `vdoc.pageCount` is read fresh from the document itself on
    // every call and is always authoritative, so it's used here instead
    // — the cached `item.pageCount` is only a last-resort fallback for
    // a document type that somehow reports zero.
    const totalPages = vdoc.pageCount || item.pageCount || 0
    if (totalPages <= 0) continue

    const pagesToScan = Math.min(totalPages, MAX_PAGES_SCANNED_PER_SEARCH - pagesScanned)
    const matchedPages: number[] = []

    for (let start = 1; start <= pagesToScan; start += SEARCH_BATCH_SIZE) {
      const batch: number[] = []
      for (let page = start; page < start + SEARCH_BATCH_SIZE && page <= pagesToScan; page += 1) batch.push(page)

      const batchResults = await Promise.all(
        batch.map(async (page) => {
          try {
            const { flat: pageText } = await vdoc.getPageText(page)
            return pageText.toLowerCase().includes(q) ? page : null
          } catch {
            // One unreadable page (corrupt content stream, odd
            // encoding, etc.) must not abort the rest of the scan —
            // just skip it, same "never fabricate, never crash the
            // whole search" rule as everywhere else in this pipeline.
            return null
          }
        })
      )
      pagesScanned += batch.length
      for (const page of batchResults) if (page !== null) matchedPages.push(page)
    }

    if (matchedPages.length > 0) results.push({ item, pages: matchedPages })
  }

  return results.sort((a, b) => b.pages.length - a.pages.length)
}
