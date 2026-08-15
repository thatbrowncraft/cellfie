/**
 * core/concepts/curatedLessons/registry — the reusable lookup engine.
 *
 * Third Refinement ("Cellfie teaches, the user studies"): adding a new
 * curated lesson no longer means writing a new .ts file AND adding it
 * to a hardcoded array here. It means dropping a new JSON content file
 * into `src/content/lessons/` (see that folder's README.md for the
 * schema and an authoring walkthrough). This file uses Vite's
 * `import.meta.glob` to eagerly discover every `*.json` file in that
 * folder at build time — nothing about ConceptDetailPage.tsx,
 * CuratedLessonView.tsx, or this file itself needs to change to add
 * lesson #2, #20, or #200.
 *
 * Content stays a plain, reviewable JSON document — not a database,
 * not a CMS, not an AI generation step — matching the "no paid
 * service, no AI API" requirement: the Lesson Builder is a content
 * format + a loader, nothing more.
 *
 * Matching reuses the exact same `normalizeConceptName` the rest of
 * core/concepts already uses for Concept dedupe, so "Gram Stain",
 * "gram staining", and "Gram's Method" all resolve the same way a
 * Concept's own aliases do.
 */
import type { Concept } from '../../db'
import { normalizeConceptName } from '../normalize'
import type { CuratedLesson } from './types'

// `eager: true` bundles every lesson JSON at build time (this is a
// small, hand-authored content set, not a runtime-fetched database —
// eager loading keeps lesson lookup synchronous and offline-safe,
// matching how curated lessons behaved before this refactor).
const lessonModules = import.meta.glob<{ default: unknown }>('/src/content/lessons/*.json', { eager: true })

/**
 * A lightweight runtime shape check — not full schema validation.
 * Deliberately generous about *optional* fields (per the flexible
 * section schema, see types.ts) but strict about the handful of
 * fields every lesson must have to render and be findable at all. A
 * malformed content file is skipped with a console warning rather
 * than crashing the whole app — one bad JSON file should never take
 * down every other lesson, or Concept Hub itself.
 */
function isValidLesson(x: unknown): x is CuratedLesson {
  if (!x || typeof x !== 'object') return false
  const l = x as Partial<CuratedLesson>
  return (
    Array.isArray(l.matchNames) &&
    l.matchNames.length > 0 &&
    typeof l.conceptDisplayName === 'string' &&
    Array.isArray(l.sections) &&
    l.sections.length > 0 &&
    Boolean(l.quickRevision) &&
    Boolean(l.examFocus) &&
    Array.isArray(l.sources)
  )
}

const ALL_LESSONS: CuratedLesson[] = Object.entries(lessonModules)
  .map(([path, mod]) => {
    const data = mod.default
    if (!isValidLesson(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[curatedLessons] Skipping malformed lesson content file: ${path}`)
      return undefined
    }
    return data
  })
  .filter((lesson): lesson is CuratedLesson => Boolean(lesson))
  // Stable, predictable order (alphabetical by display name) — the
  // order lessons happen to load from disk shouldn't matter anywhere
  // this list is iterated (e.g. a future "browse curated lessons" view).
  .sort((a, b) => a.conceptDisplayName.localeCompare(b.conceptDisplayName))

/** Returns the curated lesson for this concept, if one exists yet — matched against Concept.normalizedName and every Concept.alias, not just the exact display name. */
export function getCuratedLesson(concept: Concept): CuratedLesson | undefined {
  const candidateNames = [concept.normalizedName, ...concept.aliases.map(normalizeConceptName)]
  return ALL_LESSONS.find((lesson) => lesson.matchNames.some((m) => candidateNames.includes(normalizeConceptName(m))))
}

/** Every curated lesson Cellfie currently has, in display-name order. Exposed for any future "what does Cellfie already teach?" browsing UI — not used by concept lookup itself. */
export function listCuratedLessons(): CuratedLesson[] {
  return ALL_LESSONS
}

export type { CuratedLesson, LessonSection, LessonSource, LessonStep, ComparisonTable, QuickRevisionSummary, ExamFocusSummary } from './types'
