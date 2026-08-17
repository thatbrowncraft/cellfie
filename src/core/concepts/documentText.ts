/**
 * core/concepts/documentText.ts — Book Import Formats §23-24's "common
 * document model" boundary. Every caller in the concept pipeline
 * (extraction.ts, librarySearch.ts) that used to reach into
 * core/pdf-engine directly now goes through `openLibraryDocument`
 * instead, so buildStudyOverview / scanLibraryForConcept / librarySearch
 * don't need to know or care whether a LibraryItem is a PDF, an EPUB, or
 * a standalone HTML/XHTML file — they just ask for "page N's text" and
 * get back both a structural form (paragraph/heading breaks preserved,
 * for splitIntoKnownSections) and a flat form (for relevance scoring),
 * exactly like they always got from a PDF page.
 *
 * For EPUB/HTML, "page N" means "spine item N" / "the whole document" —
 * there's no literal page geometry the way a PDF has one, and per §24
 * that's fine: format is a text-quality signal, not a priority tier or
 * anything the rest of the pipeline needs to special-case. What matters
 * is only that page numbers are stable and 1-indexed, which spine order
 * already gives for free, and that citations ("p. N") stay meaningful —
 * for EPUB that reads as "section N" in the UI (see bookLesson.ts).
 *
 * Scope: text retrieval for the concept engine only. The visual,
 * page-by-page Library reader (core/pdf-engine's canvas rendering) is
 * unchanged and stays PDF-only this pass — EPUB/HTML content is
 * searchable and appears in Learn, but isn't yet openable as a page-flip
 * reader (see ReaderPage.tsx's format guard). That reading experience is
 * a larger, separate UI feature for a future pass.
 */

import { readFile } from '../file-storage'
import { loadPdfDocument, getPageTextContent, joinPageText, joinPageTextPreservingParagraphs } from '../pdf-engine'
import { parseEpub, parseHtmlDocument } from '../epub-engine'
import type { LibraryItem } from '../db'

export interface VirtualPageText {
  /** Paragraph-structure-preserving form, for splitIntoKnownSections. */
  structured: string
  /** Single-line-per-page form, for relevance scoring. */
  flat: string
}

export interface VirtualDocument {
  pageCount: number
  getPageText(pageNumber: number): Promise<VirtualPageText>
}

const parsedCache = new Map<string, Promise<VirtualDocument>>()

/**
 * Opens a LibraryItem for text retrieval, format-detected via
 * `item.format` (absent = the original PDF-only behavior every item
 * imported before this pass already has, so no migration is needed).
 * Parsed once per item id per session — callers that read many pages
 * from the same item (buildStudyOverview, scanLibraryForConcept) should
 * reuse the same VirtualDocument across pages rather than calling this
 * per page, same as the old direct-pdf-engine callers already did with
 * their own local doc caches.
 */
export async function openLibraryDocument(item: LibraryItem): Promise<VirtualDocument> {
  const cached = parsedCache.get(item.id)
  if (cached) return cached

  const promise = (async (): Promise<VirtualDocument> => {
    const blob = await readFile(item.filePath)

    if (item.format === 'epub') {
      const parsed = await parseEpub(blob)
      return {
        pageCount: parsed.pageTexts.length,
        async getPageText(pageNumber: number) {
          const text = parsed.pageTexts[pageNumber - 1] ?? ''
          return { structured: text, flat: text.replace(/\s+/g, ' ').trim() }
        }
      }
    }

    if (item.format === 'html') {
      const html = await blob.text()
      const parsed = parseHtmlDocument(html)
      return {
        pageCount: 1,
        async getPageText() {
          return { structured: parsed.pageText, flat: parsed.pageText.replace(/\s+/g, ' ').trim() }
        }
      }
    }

    // Default: PDF — identical to the original pre-Book-Import-Formats
    // behavior. Uses pdf.js's own `numPages` (always a definite number)
    // rather than the stored `item.pageCount`, which is optional/only a
    // cached copy of this same value.
    const doc = await loadPdfDocument(blob)
    return {
      pageCount: doc.numPages,
      async getPageText(pageNumber: number) {
        const { items } = await getPageTextContent(doc, pageNumber)
        return { structured: joinPageTextPreservingParagraphs(items), flat: joinPageText(items) }
      }
    }
  })()

  parsedCache.set(item.id, promise)
  return promise
}

/** Drops a cached parsed document — call after re-importing/replacing the same item id. */
export function invalidateLibraryDocumentCache(itemId: string): void {
  parsedCache.delete(itemId)
}
