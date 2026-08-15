/**
 * core/concepts/curatedLessons/types — Second Refinement §Part 3–5, the
 * curated-lesson architecture.
 *
 * This is the answer to the actual problem: MeSH/PubChem/Europe PMC are
 * a RESEARCH source hierarchy, not a TEACHING one, and no code can turn
 * a research abstract into a trustworthy beginner lesson without either
 * generative AI (ruled out) or Wikipedia (ruled out). So the educational
 * layer is hand-authored, structured, source-attributed content — a
 * `CuratedLesson` per concept, written once by a person, rendered by a
 * single reusable engine (`CuratedLessonView.tsx`). Gram staining is the
 * first one; the schema is the reusable part, not the content.
 *
 * Every string in a lesson is written by a person for this app, informed
 * by real authoritative educational/scientific sources (see `sources`)
 * — never copied verbatim from any one of them, and never generated.
 * `sources` names the institutions the lesson content is informed by;
 * it is attribution, not a claim that any given sentence is quoted.
 */

export type LessonSourceKind = 'educational' | 'scientific'

export interface LessonSource {
  name: string
  kind: LessonSourceKind
  /** Optional — only set for a stable, institution-hosted reference page. Never a search result or an ephemeral link. */
  url?: string
}

export interface LessonStep {
  name: string
  explanation: string
  purpose: string
}

export interface ComparisonTable {
  caption?: string
  columnHeaders: string[]
  /** Each row: [rowLabel, ...cellsMatchingColumnHeaders] */
  rows: string[][]
}

export interface LessonSection {
  id: string
  heading: string
  /** Plain paragraph(s) — '\n\n' separated. */
  body?: string
  bullets?: string[]
  steps?: LessonStep[]
  table?: ComparisonTable
}

/** A compact, scannable summary — deliberately NOT the full lesson reworded shorter; authored directly as its own memory sheet. */
export interface QuickRevisionSummary {
  oneLineDefinition: string
  keyFacts: string[]
  keyTerms: string[]
  commonConfusion?: string[]
}

export interface ExamFocusSummary {
  highYieldFacts: string[]
  commonTraps: string[]
  mustRemember: string[]
  confusedTerms?: { termA: string; termB: string; distinction: string }[]
  possibleQuestions?: string[]
}

export interface CuratedLesson {
  /** Matches Concept.normalizedName or any Concept.alias, normalized the same way — see registry.ts. */
  matchNames: string[]
  conceptDisplayName: string
  /** Progressive-depth lesson body, in reading order. Sections adapt per concept — no fixed template across lessons. */
  sections: LessonSection[]
  quickRevision: QuickRevisionSummary
  examFocus: ExamFocusSummary
  sources: LessonSource[]
}
