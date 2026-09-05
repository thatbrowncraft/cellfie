/**
 * core/physics/types — Physics knowledge base, Tier 1 Foundation.
 *
 * Deliberately mirrors `core/laboratory/types.ts` field-for-field for the
 * `concept` and `formula` shapes: same metadata contract, same
 * cross-linking approach, same worked-example shape for formulas. This
 * is a new, isolated content domain — it does not import from or modify
 * `core/laboratory`, `core/organisms`, or `core/comparison` — but it
 * follows their established conventions exactly so the pattern stays
 * predictable across the app rather than inventing a fourth shape.
 *
 * Scope for this first tranche: `concept` and `formula` only (the two
 * categories the Physics expansion brief emphasizes most). Additional
 * categories (e.g. worked numericals, PYQ banks) can be added later the
 * same way Laboratory grew from its own Tier 1 categories, without
 * restructuring this file.
 */

export type PhysicsCategory = 'concept' | 'formula'

export type PhysicsSourceType = 'educational-guidance' | 'ncert-aligned'

export type PhysicsDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface PhysicsReference {
  label: string
  publisher?: string
  edition?: string
  url?: string
}

export interface PhysicsContentMeta {
  id: string
  category: PhysicsCategory
  title: string
  /** e.g. "Mechanics", "Electrostatics", "Modern Physics" — the NCERT-aligned unit this content belongs to. */
  subcategory?: string
  /** Which NCERT class(es) this concept/formula is drawn from — informational only, never gates access. */
  ncertClass?: ('11' | '12')[]
  sourceType: PhysicsSourceType
  version: string
  lastVerified: string
  references: PhysicsReference[]
  scientificNotes?: string
  searchKeywords?: string[]
  difficulty?: PhysicsDifficulty
}

/** Cross-links use stable IDs only, exactly like Laboratory's related-content arrays. Every array optional; absence means "none recorded yet". */
export interface PhysicsRelatedLinks {
  relatedConcepts?: string[]
  relatedFormulas?: string[]
  /** Optional links into other Cellfie sections (brief §15 — interdisciplinary connections), e.g. a laboratory concept id or organism id. Only used when genuinely useful, never forced. */
  relatedBiologyConcepts?: string[]
}

export interface PhysicsConcept extends PhysicsContentMeta, PhysicsRelatedLinks {
  category: 'concept'
  summary: string
  explanation: string
  /** For "X vs Y" style concepts. Omitted for single-concept entries — the dedicated Comparison Studio entry is preferred for a full comparison; this is for a quick inline contrast only. */
  comparison?: { aspect: string; left: string; right: string }[]
  commonMisconceptions?: string[]
  examples?: string[]
  genZNote?: string
}

export interface PhysicsFormulaVariable {
  symbol: string
  meaning: string
  unit?: string
}

export interface PhysicsWorkedExample {
  scenario: string
  substitution: string
  result: string
}

export interface PhysicsFormula extends PhysicsContentMeta, PhysicsRelatedLinks {
  category: 'formula'
  domain: string
  /** Plain-text symbolic expression — no LaTeX renderer in this project's dependency set, matching Laboratory's formula convention. */
  expression: string
  explanation: string
  variables: PhysicsFormulaVariable[]
  /** SI unit of the quantity the formula solves for, stated explicitly per brief §5. */
  resultUnit?: string
  conditions?: string[]
  workedExample: PhysicsWorkedExample
  commonMistakes?: string[]
  genZNote?: string
}

export type PhysicsContent = PhysicsConcept | PhysicsFormula

export interface PhysicsSearchHit {
  id: string
  category: PhysicsCategory
  title: string
  subtitle?: string
}
