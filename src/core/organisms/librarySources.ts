/**
 * core/organisms/librarySources — Knowledge Layer + Source Library
 * brief, Phases 5-9 ("My Sources" / "Choose a specific source").
 *
 * Deliberately thin: all real book search/reading already lives in
 * `core/concepts/librarySearch.ts` (`searchLibraryForTerm`, built for
 * the Concept Hub's own local-book search) and
 * `core/concepts/documentText.ts` (`openLibraryDocument`, the
 * format-agnostic PDF/EPUB/HTML page reader). This module only adds
 * what's specific to an *organism* Knowledge Layer profile: turning a
 * `LibraryTermMatch[]` into real, attributed excerpt text plus
 * `OrganismSource[]` entries, with the exact page/book provenance the
 * brief requires (§Phase 9) and never a fabricated page number.
 *
 * Nothing here performs a network request — every call in this file
 * reads only from the user's already-imported local library (Dexie +
 * OPFS), so it's safe to run in 'my-sources'/'specific-source' mode
 * without the "no silent trusted-source supplementation" rule
 * (§Phase 4-6) ever being at risk of violation.
 */
import { searchLibraryForTerm, type LibraryTermMatch } from '../concepts/librarySearch'
import { openLibraryDocument } from '../concepts/documentText'
import type { LibraryItem } from '../db'
import type { LibrarySourceExcerpt, OrganismSource } from './types'

/** Hard cap on how many (book, page) excerpts a single Knowledge Layer lookup will build — keeps "My Sources" from reading dozens of pages across a large library on every search (mirrors the same spirit as `librarySearch.ts`'s own `MAX_PAGES_SCANNED_PER_SEARCH`, just for the excerpt-building step). */
const MAX_EXCERPTS_PER_BOOK = 2
const EXCERPT_CONTEXT_CHARS = 220

/** A short, real window of text centered on the matched term — never rewritten or summarized, exactly the source's own words, just trimmed to a readable excerpt length. */
function extractExcerptWindow(pageText: string, term: string): string {
  const lower = pageText.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx === -1) return pageText.slice(0, EXCERPT_CONTEXT_CHARS * 2).trim()
  const start = Math.max(0, idx - EXCERPT_CONTEXT_CHARS)
  const end = Math.min(pageText.length, idx + term.length + EXCERPT_CONTEXT_CHARS)
  const prefix = start > 0 ? '\u2026' : ''
  const suffix = end < pageText.length ? '\u2026' : ''
  return `${prefix}${pageText.slice(start, end).trim()}${suffix}`
}

/**
 * Reads the actual page text for (at most `MAX_EXCERPTS_PER_BOOK`)
 * matched pages of one book and returns real excerpts. A page that
 * fails to re-open/re-read is simply skipped — never a placeholder or
 * a fabricated excerpt standing in for it.
 */
async function buildExcerptsForMatch(item: LibraryItem, term: string, match: LibraryTermMatch): Promise<LibrarySourceExcerpt[]> {
  const excerpts: LibrarySourceExcerpt[] = []
  try {
    const vdoc = await openLibraryDocument(item)
    for (const page of match.pages.slice(0, MAX_EXCERPTS_PER_BOOK)) {
      const { flat } = await vdoc.getPageText(page)
      if (!flat) continue
      excerpts.push({
        text: extractExcerptWindow(flat, term),
        libraryItemId: item.id,
        bookTitle: item.title,
        author: item.author,
        page
      })
    }
  } catch {
    // Book failed to re-open (moved/corrupted file, unsupported format
    // change, etc.) — the match itself (book name + page count) is
    // still meaningful to show; just no excerpt text for it.
  }
  return excerpts
}

export interface LibraryLookupResult {
  excerpts: LibrarySourceExcerpt[]
  sources: OrganismSource[]
  /** Every book that matched, even ones an excerpt couldn't be re-read from — used for the "Sources found: Book A, Book B" summary (§Phase 7). */
  matchedBooks: LibraryItem[]
}

function toSources(excerpts: LibrarySourceExcerpt[]): OrganismSource[] {
  const seen = new Set<string>()
  const sources: OrganismSource[] = []
  for (const excerpt of excerpts) {
    const key = `${excerpt.libraryItemId}:${excerpt.page}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({
      name: excerpt.bookTitle,
      kind: 'local-book',
      bookTitle: excerpt.bookTitle,
      author: excerpt.author,
      page: excerpt.page
    })
  }
  return sources
}

/** §Phase 5/7 — "My Sources": searches every indexed local book for the term, with per-book provenance preserved throughout (never merged into an unattributed blob). */
export async function lookupInAllLibrarySources(term: string): Promise<LibraryLookupResult> {
  const matches = await searchLibraryForTerm(term)
  const excerptLists = await Promise.all(matches.map((match) => buildExcerptsForMatch(match.item, term, match)))
  const excerpts = excerptLists.flat()
  return { excerpts, sources: toSources(excerpts), matchedBooks: matches.map((m) => m.item) }
}

/** §Phase 6 — "Choose a specific source": searches exactly one named library item and nothing else. Returns an empty result (not an error) when that one book simply doesn't contain the term — the caller is responsible for the "couldn't find enough information in this source" messaging. */
export async function lookupInSpecificLibrarySource(term: string, libraryItemId: string): Promise<LibraryLookupResult> {
  const matches = await searchLibraryForTerm(term, [libraryItemId])
  const excerptLists = await Promise.all(matches.map((match) => buildExcerptsForMatch(match.item, term, match)))
  const excerpts = excerptLists.flat()
  return { excerpts, sources: toSources(excerpts), matchedBooks: matches.map((m) => m.item) }
}
