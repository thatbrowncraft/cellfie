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
export type ExamSubjectId =
  | 'constitution-of-india'
  | 'quantitative-aptitude'
  | 'english-language'
  | 'logical-reasoning'
  | 'general-knowledge'
  | 'current-affairs-2026'

export interface ExamSubject {
  id: ExamSubjectId
  title: string
  shortDescription: string
  genZNote: string
  /** A Phosphor icon name, resolved by the consuming component — kept as a string so this file stays free of UI-library imports (mirrors `config/subjects.registry.ts`'s pattern). */
  icon: string
}

/**
 * Current Affairs 2026 status flag — distinguishes a mission/scheme that
 * was only announced or is still in progress from one that actually
 * happened (or, per the brief, actually failed). Optional and only
 * meaningful for `current-affairs-2026` topics; every other subject
 * leaves it unset.
 */
export type CurrentAffairsStatus = 'announced' | 'ongoing' | 'completed' | 'failed'

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
  /**
   * Current-Affairs-only metadata, all optional so every other subject's
   * topic files are untouched. When `region` is set, `ExamPrepSubjectPage`
   * groups the subject's topics by region (Gujarat first, per the brief)
   * instead of rendering one flat list — see that component for the
   * fallback behaviour when `region` is absent.
   */
  region?: 'gujarat' | 'india'
  /** Landing-page category chip, e.g. "Government & Policies", "ISRO & Space". Free text, not a closed enum — the brief is explicit that categories should reflect what genuinely has 2026 content, not a fixed taxonomy. */
  category?: string
  /** ISO date (YYYY-MM-DD) of the actual event/announcement — NOT the publication date. Used for the "Current Affairs • 2026" date chip. */
  eventDate?: string
  /** See `CurrentAffairsStatus` — only set for items where "did this actually happen yet" is itself part of the exam-relevant fact (e.g. ISRO missions). */
  status?: CurrentAffairsStatus
}

export type { LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary }
