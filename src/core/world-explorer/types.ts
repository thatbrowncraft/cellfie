/**
 * core/world-explorer/types — the "World Explorer" feature inside Exam
 * Prep: an interactive globe where tapping a country opens a
 * structured, curated profile.
 *
 * Like `core/exam-prep/types.ts`, this deliberately REUSES the same
 * curated-lesson building blocks already defined in
 * `core/concepts/curatedLessons/types.ts` (`LessonSection`,
 * `QuickRevisionSummary`, `ExamFocusSummary`, `LessonSource`) rather
 * than inventing a third parallel content schema. A country's Geography
 * / People & Culture / Government & Society / etc. sections are just
 * `LessonSection`s with a heading, exactly like an Exam Prep topic or a
 * Concepts lesson — so the same rendering approach (see
 * `modules/world-explorer/components/CountryLessonView.tsx`, which
 * mirrors `ExamLessonView.tsx` for the same reason that file gives for
 * not force-fitting a different module's props) works here too.
 *
 * World Explorer is NOT wired into `core/exam-prep`'s `ExamTopic`/
 * `ExamSubjectId` union — a country isn't a syllabus topic inside a
 * subject, it's a different interaction (a globe, not a topic list) —
 * so this stays its own small, additive module. It is also NOT wired
 * into `core/concepts` (Dexie, extraction, retrieval) for the same
 * reason Exam Prep isn't: this is curated, static content, not
 * something matched against a person's uploaded book.
 */
import type {
  ExamFocusSummary,
  LessonSection,
  LessonSource,
  QuickRevisionSummary
} from '@/core/concepts/curatedLessons/types'

/**
 * Every country plotted on the globe. This list is intentionally NOT
 * the same as "every country with a deep profile" — `hasDeepProfile`
 * tells the detail page whether to also look up a `CountryProfile` from
 * the registry, or just show this lightweight at-a-glance data with a
 * "deeper profile coming soon" note (brief §10: quality over volume;
 * §9: don't pretend depth that isn't there). These are all stable,
 * slow-changing facts (capital, continent, currency, official
 * language(s)) — see `CountryProfile` below for where genuinely
 * changeable information (population, current leadership, trade
 * figures) is kept separate and explicitly not claimed as permanent.
 */
export interface GlobeCountry {
  /** Stable id, e.g. "india". Matches a CountryProfile's id when one exists. */
  id: string
  name: string
  /** Only set where the common short name and official name genuinely differ. */
  officialName?: string
  /** Approximate country centroid or capital coordinates, in degrees — for globe placement only, not surveyed precision. */
  lat: number
  lon: number
  continent: 'Asia' | 'Africa' | 'Europe' | 'North America' | 'South America' | 'Oceania'
  capital: string
  currency: string
  /** Unicode flag emoji — renders natively, no image asset needed. */
  flagEmoji: string
  languages: string[]
  /** Whether `core/world-explorer/registry.ts` has a matching deep CountryProfile. */
  hasDeepProfile: boolean
}

export interface CountryProfile {
  /** Matches a GlobeCountry.id. */
  id: string
  name: string
  /** Original, country-specific memory note — never a generic line reused across countries (brief §6). */
  genZNote: string
  /** Geography, People & Culture, Government & Society, Medical & Scientific Developments, Global Relations, Relations with India, Trade & Economy, What It's Known For, and (where genuinely available) Current Affairs Connection — as LessonSections, one per subsection, not one giant paragraph (brief §4). */
  sections: LessonSection[]
  quickRevision: QuickRevisionSummary
  examFocus: ExamFocusSummary
  sources: LessonSource[]
  /**
   * Optional cross-link into the "Oceans & Maritime World" layer
   * (`core/world-explorer/maritime/`) — brief §20: "connect naturally
   * with the existing country profiles... do NOT duplicate huge amounts
   * of content inside every country JSON, prefer reusable structured
   * ocean/sea data". Every id here must match a real entry in that
   * registry; `CountryDetailPage` only renders a maritime card when
   * this field is present, so leaving it out of a country's JSON is
   * always safe — no country is required to have one.
   */
  maritime?: {
    oceans?: string[]
    seas?: string[]
    chokepoints?: string[]
    routes?: string[]
  }
}

export type { LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary }
