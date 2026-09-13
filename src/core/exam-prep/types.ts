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
  | 'international-organizations'
  | 'iso'
  | 'human-anatomy'

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
   * Optional primary illustration for this topic — used by Human Anatomy
   * (and any future visually-led subject). Deliberately optional and
   * separate from `sections`: it is a single supplied, unmodified HD
   * asset (never AI-generated, never redrawn), rendered once at the top
   * of the lesson via `IllustrationFrame`. When absent, the topic simply
   * renders with no image slot — `IllustrationFrame` already has a
   * graceful "no illustration" state, so nothing here ever fabricates a
   * placeholder image.
   */
  illustration?: {
    /** Path under `public/`, e.g. "/exam-prep/human-anatomy/human-anatomy-systems.png". */
    src: string
    alt: string
    caption: string
  }
  /**
   * Optional structured anatomy data — see `AnatomyData` above. Only
   * `human-anatomy` topics set this; every other subject's topic files
   * are untouched and simply never populate it. Rendered by
   * `ExamLessonView` (structures/pathways/comparisons/hormone table)
   * and by a small quiz block on `ExamPrepTopicPage` (questions) —
   * both render nothing at all when a field is absent, so this can be
   * adopted chapter-by-chapter without breaking any topic that hasn't
   * been upgraded yet.
   */
  anatomy?: AnatomyData
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

/**
 * Anatomy-specific structured data — additive-only extension for the
 * Human Anatomy subject (and any future visually-led subject). Every
 * field is optional so `ExamTopic` stays exactly as-is for every other
 * subject; nothing here changes `isValidTopic` in `registry.ts` or the
 * shape any existing topic file already has.
 *
 * This is deliberately NOT a redesign of `LessonSection` — prose,
 * tables, and steps still belong there. `anatomy` only carries the
 * pieces a plain lesson section can't express well: a structure/function
 * card grid, a directional pathway, a side-by-side comparison grid, a
 * gland→hormone reference table, and structured quiz questions that a
 * component can actually render as an interactive card, not prose that
 * merely mentions a question exists.
 */
export interface AnatomyStructure {
  /** Stable id within the topic, e.g. "right-atrium". */
  id: string
  name: string
  description: string
  function?: string
  /** One compact exam-relevant fact about this specific structure — optional, kept separate from the general topic-level `examFocus`. */
  highYield?: string
  /**
   * Optional per-structure illustration — a specific crop of the
   * supplied HD artwork showing just this structure (e.g. the Liver
   * card's own panel, not the whole multi-organ collage). Only set
   * where a genuinely distinct panel exists in the source artwork;
   * never a generated or redrawn image. Falls back to no image (not a
   * placeholder) when absent, same pattern as the topic-level
   * `illustration`.
   */
  image?: { src: string; alt: string }
}

export interface AnatomyPathway {
  title: string
  /** Ordered steps of a biological pathway (blood flow, air pathway, hormonal feedback, etc.) — rendered as a directional flow, not a bullet list. */
  steps: string[]
}

export interface AnatomyComparison {
  termA: string
  termB: string
  distinction: string
}

/** One row of a gland → hormone → function → target reference table (Endocrine System's dedicated hormone table). */
export interface AnatomyHormoneRow {
  gland: string
  hormone: string
  function: string
  target: string
}

export type AnatomyQuestionType =
  | 'mcq'
  | 'true-false'
  | 'structure-to-function'
  | 'function-to-structure'
  | 'gland-to-hormone'
  | 'hormone-to-function'
  | 'organ-to-system'
  | 'diagram-identification'
  | 'common-confusion'

export interface AnatomyQuestion {
  id: string
  type: AnatomyQuestionType
  prompt: string
  /**
   * Only set (true) for a diagram-identification question — reuses this
   * topic's own `illustration` as the reference image. Never a separate
   * or fabricated image, and never implies pixel-level highlighting
   * (no coordinate data exists for the supplied artwork, per the asset
   * rule — identification questions are text-option based, anchored to
   * the visible labelled diagram).
   */
  useIllustration?: boolean
  options: string[]
  correctIndex: number
  explanation: string
  /**
   * Optional one-line reason each option is right/wrong, same order and
   * length as `options`. Rendered after answering, alongside `explanation`.
   */
  optionNotes?: string[]
}

export interface AnatomyData {
  structures?: AnatomyStructure[]
  pathways?: AnatomyPathway[]
  comparisons?: AnatomyComparison[]
  hormoneTable?: AnatomyHormoneRow[]
  questions?: AnatomyQuestion[]
}

export type { LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary }
