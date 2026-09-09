/**
 * core/exam-prep/types — Exam Prep section, first subject: Constitution
 * of India.
 *
 * Deliberately reuses the curated-lesson shapes already defined for the
 * Concepts module (`core/concepts/curatedLessons/types.ts`) — a
 * `LessonSection` (heading + body/bullets/steps/table), a
 * `QuickRevisionSummary`, and an `ExamFocusSummary` are exactly the
 * "deep but scannable, not a textbook wall" shape this brief asks for,
 * and they already render through a battle-tested component. Exam Prep
 * does NOT create a second, parallel content schema — it adds the
 * exam-specific metadata (subject, syllabus order, a short landing-page
 * description, a Gen-Z memory note) around the same lesson body shape.
 *
 * This is intentionally NOT wired into `core/concepts` (Dexie `Concept`
 * records, the book-scan/extraction pipeline, online-knowledge lookups,
 * etc.) — Exam Prep content is curated, syllabus-scoped, and static, not
 * something a person's own uploaded book gets matched against. Keeping
 * it a separate, additive module means nothing here can ever touch
 * `core/concepts/extraction.ts` or any retrieval/indexing code.
 */
import type {
  ExamFocusSummary,
  LessonSection,
  LessonSource,
  QuickRevisionSummary
} from '@/core/concepts/curatedLessons/types'

/** Every exam-prep subject Cellfie currently teaches. Add a new id here (and a matching folder under `src/content/exam-prep/`) to grow the section later — see `subjects.ts`. */
export type ExamSubjectId = 'constitution-of-india'

export interface ExamSubject {
  id: ExamSubjectId
  title: string
  shortDescription: string
  genZNote: string
  /** A Phosphor icon name, resolved by the consuming component — kept as a string so this file stays free of UI-library imports (mirrors `config/subjects.registry.ts`'s pattern). */
  icon: string
}

export interface ExamTopic {
  /** Stable id, e.g. "constitution-preamble". Never reused across subjects. */
  id: string
  subjectId: ExamSubjectId
  /** 1-indexed position in the official syllabus for this subject — drives display order, not importance. */
  syllabusOrder: number
  title: string
  /** One or two sentences shown on the subject's topic-list page. */
  shortDescription: string
  /** Original, topic-specific memory note — never a generic line reused across topics. */
  genZNote: string
  sections: LessonSection[]
  quickRevision: QuickRevisionSummary
  examFocus: ExamFocusSummary
  sources: LessonSource[]
}

export type { LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary }
