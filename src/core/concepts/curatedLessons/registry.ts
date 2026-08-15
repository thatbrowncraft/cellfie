/**
 * core/concepts/curatedLessons/registry — the reusable lookup engine.
 * Second Refinement §Part 15: adding a new curated lesson later means
 * writing a new content file like gramStaining.ts and adding it to
 * `ALL_LESSONS` below — nothing about ConceptDetailPage.tsx or
 * CuratedLessonView.tsx needs to change. Matching reuses the exact
 * same `normalizeConceptName` the rest of core/concepts already uses
 * for Concept dedupe, so "Gram Stain", "gram staining", and "Gram's
 * Method" all resolve the same way a Concept's own aliases do.
 */
import type { Concept } from '../../db'
import { normalizeConceptName } from '../normalize'
import { gramStainingLesson } from './gramStaining'
import type { CuratedLesson } from './types'

const ALL_LESSONS: CuratedLesson[] = [gramStainingLesson]

/** Returns the curated lesson for this concept, if one exists yet — matched against Concept.normalizedName and every Concept.alias, not just the exact display name. */
export function getCuratedLesson(concept: Concept): CuratedLesson | undefined {
  const candidateNames = [concept.normalizedName, ...concept.aliases.map(normalizeConceptName)]
  return ALL_LESSONS.find((lesson) => lesson.matchNames.some((m) => candidateNames.includes(normalizeConceptName(m))))
}

export type { CuratedLesson, LessonSection, LessonSource, LessonStep, ComparisonTable, QuickRevisionSummary, ExamFocusSummary } from './types'
