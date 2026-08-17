/**
 * core/concepts/bookLesson — Book-First Learning Engine, Phase 1.
 *
 * The missing link between two things that already existed separately:
 * `extraction.ts`'s `buildStudyOverview()` (real, relevance-scored
 * search across the person's own uploaded PDFs — see that function's
 * own doc comment) and `CuratedLessonView.tsx` (a reusable renderer for
 * a lesson-shaped object, previously fed only by hand-authored curated
 * lessons). This file does nothing except reshape the former into
 * something the latter can render — no new parsing, no new heuristics,
 * no network calls, and nothing here overrides `scorePageRelevance`,
 * `findBestExcerpt`, or `splitIntoKnownSections`; it consumes their
 * already-computed output as-is.
 *
 * Per the new source hierarchy (student's upload beats even the curated
 * lesson): a concept whose uploaded book(s) actually discuss it — real
 * headings the book itself uses, or a genuine explanatory paragraph
 * grounded in the concept's own strongest occurrence — gets ITS OWN
 * book's explanation as the Learn tab's primary content, in the book's
 * own words and order. A concept with no such content returns
 * `undefined` here and Learn falls through to the curated lesson, then
 * the MeSH/PubChem tier, exactly as before — this function never
 * fabricates a lesson to fill the gap.
 */
import type { Concept } from '../db'
import type { StudyOverview } from './extraction'
import type { LessonSection, LessonSource } from './curatedLessons/types'

export interface BookLessonQuickRevision {
  oneLineDefinition: string
  /** Real excerpts (each section's own first sentence — the same technique examTools.ts already uses for its Key Exam Points), never a rewritten summary. */
  keyFacts: string[]
}

export interface BookLesson {
  conceptDisplayName: string
  sections: LessonSection[]
  quickRevision: BookLessonQuickRevision
  sources: LessonSource[]
  /** Retrieval Correction §5 — set only when every available section/paragraph for this concept came from a source whose text extraction looked garbled (see relevance.ts's detectExtractionQuality) and no clean alternative existed anywhere in the library. Never set just because SOME source was garbled — see buildBookLesson, which prefers clean sections whenever any exist. */
  extractionNote?: string
}

// A body this short is more likely a stray heading/caption/table-of-
// contents fragment than a real explanatory passage — matches the
// spirit of relevance.ts's own FRAGMENT_WORD_THRESHOLD, kept local
// since this is a display-inclusion threshold, not a scoring one.
const MIN_SECTION_BODY_LENGTH = 25

function firstSentence(text: string): string {
  const match = /^[^.!?]*[.!?]/.exec(text.trim())
  return (match ? match[0] : text.trim()).trim()
}

/**
 * Builds a Learn-tab-ready lesson purely from what the person's own
 * uploaded book(s) already say about this concept. Returns `undefined`
 * — never a thin or empty lesson — when the book search found nothing
 * usable, so the caller can fall through to the next tier.
 */
export function buildBookLesson(concept: Concept, overview: StudyOverview): BookLesson | undefined {
  // Retrieval Correction §5 — a clean source always wins over a garbled
  // one when both exist for this concept; a garbled section is only ever
  // used when it's genuinely the only material available, and even then
  // the lesson says so rather than presenting it with silent confidence.
  const allNamedSections = overview.sections.filter((s) => s.body.trim().length >= MIN_SECTION_BODY_LENGTH)
  const cleanNamedSections = allNamedSections.filter((s) => s.extractionQuality !== 'garbled')
  const namedSections = cleanNamedSections.length > 0 ? cleanNamedSections : allNamedSections

  const cleanParagraph = overview.paragraph && overview.paragraph.extractionQuality !== 'garbled' ? overview.paragraph : undefined
  const usableParagraph = cleanParagraph ?? (cleanNamedSections.length === 0 ? overview.paragraph : undefined)

  if (namedSections.length === 0 && !usableParagraph) return undefined

  const onlyGarbledAvailable =
    Boolean(overview.paragraph || allNamedSections.length > 0) && cleanNamedSections.length === 0 && !cleanParagraph

  const sections: LessonSection[] = []
  const sourceMap = new Map<string, LessonSource>()

  function addSource(bookTitle: string, pageNumber: number) {
    const key = `${bookTitle}#${pageNumber}`
    if (!sourceMap.has(key)) {
      sourceMap.set(key, { name: `${bookTitle} (p. ${pageNumber})`, kind: 'educational' })
    }
  }

  if (usableParagraph) {
    sections.push({
      id: 'book-overview',
      heading: usableParagraph.bookTitle,
      body: usableParagraph.text
    })
    addSource(usableParagraph.bookTitle, usableParagraph.pageNumber)
  }

  namedSections.forEach((s, i) => {
    sections.push({ id: `book-section-${i}`, heading: s.heading, body: s.body })
    addSource(s.bookTitle, s.pageNumber)
    // Retrieval Diagnostic Correction §C — a section merged from more
    // than one uploaded book (see buildStudyOverview) cites every book
    // that actually contributed to it, not just the first.
    for (const extra of s.additionalSources ?? []) addSource(extra.bookTitle, extra.pageNumber)
  })

  if (sections.length === 0) return undefined

  const [first, ...rest] = sections
  const quickRevision: BookLessonQuickRevision = {
    oneLineDefinition: firstSentence(first.body ?? ''),
    keyFacts: rest
      .map((s) => firstSentence(s.body ?? ''))
      .filter(Boolean)
      .slice(0, 6)
  }

  return {
    conceptDisplayName: concept.name,
    sections,
    quickRevision,
    sources: Array.from(sourceMap.values()),
    extractionNote: onlyGarbledAvailable
      ? "This source's text couldn't be reliably extracted (the PDF's text layer looks broken up), so parts of this lesson may be hard to read. Try a cleaner copy of this book if you have one."
      : undefined
  }
}
