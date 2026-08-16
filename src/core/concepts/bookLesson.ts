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
  const namedSections = overview.sections.filter((s) => s.body.trim().length >= MIN_SECTION_BODY_LENGTH)
  if (namedSections.length === 0 && !overview.paragraph) return undefined

  const sections: LessonSection[] = []
  const sourceMap = new Map<string, LessonSource>()

  function addSource(bookTitle: string, pageNumber: number) {
    const key = `${bookTitle}#${pageNumber}`
    if (!sourceMap.has(key)) {
      sourceMap.set(key, { name: `${bookTitle} (p. ${pageNumber})`, kind: 'educational' })
    }
  }

  if (overview.paragraph) {
    sections.push({
      id: 'book-overview',
      heading: overview.paragraph.bookTitle,
      body: overview.paragraph.text
    })
    addSource(overview.paragraph.bookTitle, overview.paragraph.pageNumber)
  }

  namedSections.forEach((s, i) => {
    sections.push({ id: `book-section-${i}`, heading: s.heading, body: s.body })
    addSource(s.bookTitle, s.pageNumber)
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
    sources: Array.from(sourceMap.values())
  }
}
