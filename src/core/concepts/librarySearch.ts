/**
 * core/concepts/librarySearch — Knowledge Model Correction §3/§5. On-demand,
 * read-only search of the user's local PDF library for a literal term,
 * powering the Concept Explorer's "search, then explicitly promote" flow:
 *
 *   user searches "Gram staining"
 *     → this finds every book/page it literally appears on
 *     → shown as "Found in: Prescott's Microbiology · 7 pages"
 *     → user clicks "Add to Concepts" (see `promoteConceptCandidate` in
 *       ./service) — only then does anything get written to the database.
 *
 * Deliberately NOT a persisted full-text index — no new dependency is
 * allowed to build one (§19), so this reuses the existing pdf-engine to
 * read page text at search time, the same way `extraction.ts` already
 * does for the "scan this book for this concept" flow. A search finding
 * nothing writes nothing; nothing here ever creates a Concept.
 */

import { db, type LibraryItem } from '../db'
import { getPageTextContent, joinPageText, loadPdfDocument } from '../pdf-engine'
import { readFile } from '../file-storage'

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

export async function searchLibraryForTerm(term: string): Promise<LibraryTermMatch[]> {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []

  const items = await db.libraryItems.toArray()
  const results: LibraryTermMatch[] = []
  let pagesScanned = 0

  for (const item of items) {
    if (pagesScanned >= MAX_PAGES_SCANNED_PER_SEARCH) break
    if (!item.pageCount) continue

    let blob: Blob
    try {
      blob = await readFile(item.filePath)
    } catch {
      continue
    }
    const doc = await loadPdfDocument(blob)
    const pages: number[] = []

    for (let page = 1; page <= item.pageCount; page += 1) {
      if (pagesScanned >= MAX_PAGES_SCANNED_PER_SEARCH) break
      const { items: textItems } = await getPageTextContent(doc, page)
      pagesScanned += 1
      const pageText = joinPageText(textItems)
      if (pageText.toLowerCase().includes(q)) pages.push(page)
    }

    if (pages.length > 0) results.push({ item, pages })
  }

  return results.sort((a, b) => b.pages.length - a.pages.length)
}
