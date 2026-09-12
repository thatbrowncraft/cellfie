/**
 * core/world-explorer/maritime/types — "Oceans & Maritime World", an
 * educational layer extending World Explorer (brief: "This should
 * complement the existing country profiles... should feel like an
 * extension of World Explorer, not a completely separate app").
 *
 * DELIBERATELY NOT A NEW PARALLEL SCHEMA (brief §24: "Avoid creating
 * another unnecessary parallel architecture"). A `MaritimeProfile` has
 * exactly the same shape as `CountryProfile` from `../types.ts` — id,
 * name, genZNote, sections, quickRevision, examFocus, sources — just
 * for an ocean/sea/chokepoint/route/ecosystem instead of a country.
 * That means the exact same rendering components used for country
 * pages (`CountryLessonView`, `CountryQuickRevisionView`,
 * `CountryExamFocusView`, `CountryMemoryHookView` in
 * `modules/world-explorer/components/CountryLessonView.tsx`) work here
 * unmodified — TypeScript's structural typing accepts a
 * `MaritimeProfile` anywhere a `CountryProfile` is expected, since it
 * satisfies every field that shape requires. No new lesson-rendering
 * component, no new card styling, no new collapsible-section logic.
 *
 * `category` is the one addition, used only for routing/grouping (which
 * folder a JSON file lives in, which grid it appears in on the Maritime
 * World hub page) — it plays no part in how a profile renders.
 */
import type { CountryProfile, LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary } from '../types'

export type MaritimeCategory = 'ocean' | 'sea' | 'chokepoint' | 'route' | 'ecosystem' | 'india-maritime'

export interface MaritimeProfile {
  /** Stable id, e.g. "pacific-ocean", "strait-of-hormuz". Matches its JSON filename (minus extension). */
  id: string
  category: MaritimeCategory
  name: string
  /** Original, entry-specific memory line — same authoring rule as `CountryProfile.genZNote` (brief §1 "Gen Z memory hook", never generic/reused). */
  genZNote: string
  sections: LessonSection[]
  quickRevision: QuickRevisionSummary
  examFocus: ExamFocusSummary
  sources: LessonSource[]
}

/**
 * India's dedicated maritime profile (brief §4/§17/§18/§19 — "make
 * India a major educational focus") is stored and rendered exactly like
 * any other `MaritimeProfile`, just under its own fixed id/category
 * rather than one-per-file in a folder — there's only ever one of it.
 */
export const INDIA_MARITIME_ID = 'india-maritime'

/**
 * A single significant port (brief §7). Deliberately a lighter,
 * flatter shape than `MaritimeProfile` — a port entry is a handful of
 * short facts, not a multi-section lesson, so forcing it through the
 * full LessonSection schema would be structure for its own sake. Ports
 * render as a compact table on the Maritime World hub page instead of
 * getting their own detail pages.
 */
export interface MaritimePort {
  id: string
  name: string
  country: string
  /** City/region, e.g. "Kutch, Gujarat". */
  location: string
  /** The ocean/sea this port opens onto — a plain name, not a foreign-key id, since it's display-only text here. */
  nearbyWater: string
  mainFunction: string
  commodities: string[]
  regionalImportance: string
  routeConnection: string
}

export type { LessonSection, LessonSource, QuickRevisionSummary, ExamFocusSummary, CountryProfile }
