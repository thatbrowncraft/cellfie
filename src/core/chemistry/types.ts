/**
 * core/chemistry/types — Chemistry knowledge base, Tier 1 Foundation.
 *
 * Mirrors `core/physics/types.ts` and `core/laboratory/types.ts`
 * field-for-field. An isolated content domain — does not import from or
 * modify Physics, Laboratory, Organisms, or Comparison Studio.
 *
 * Scope for this first tranche: `concept` and `formula` only. Organic
 * reactions are represented as `formula` entries (starting material →
 * reagent/condition → product, per brief §7), since that shape already
 * supports a plain-text expression, explanation, and worked example
 * without inventing a fifth content shape this early.
 */

export type ChemistryCategory = 'concept' | 'formula'

export type ChemistrySourceType = 'educational-guidance' | 'ncert-aligned'

export type ChemistryDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface ChemistryReference {
  label: string
  publisher?: string
  edition?: string
  url?: string
}

export interface ChemistryContentMeta {
  id: string
  category: ChemistryCategory
  title: string
  /** e.g. "Chemical Bonding", "Organic Chemistry — Haloalkanes", "Electrochemistry". */
  subcategory?: string
  ncertClass?: ('11' | '12')[]
  sourceType: ChemistrySourceType
  version: string
  lastVerified: string
  references: ChemistryReference[]
  scientificNotes?: string
  searchKeywords?: string[]
  difficulty?: ChemistryDifficulty
}

export interface ChemistryRelatedLinks {
  relatedConcepts?: string[]
  relatedFormulas?: string[]
  relatedBiologyConcepts?: string[]
}

export interface ChemistryConcept extends ChemistryContentMeta, ChemistryRelatedLinks {
  category: 'concept'
  summary: string
  explanation: string
  comparison?: { aspect: string; left: string; right: string }[]
  commonMisconceptions?: string[]
  examples?: string[]
  genZNote?: string
}

export interface ChemistryFormulaVariable {
  symbol: string
  meaning: string
  unit?: string
}

export interface ChemistryWorkedExample {
  scenario: string
  substitution: string
  result: string
}

/** For a reaction-type entry, `expression` holds the reaction scheme (e.g. "R–X + NaOH(aq) → R–OH + NaX") rather than an algebraic formula — brief §7's "starting material → reagent/condition → product" shape lives in `reactionConditions`/`reactionType` alongside it. */
export interface ChemistryFormula extends ChemistryContentMeta, ChemistryRelatedLinks {
  category: 'formula'
  domain: string
  expression: string
  explanation: string
  variables: ChemistryFormulaVariable[]
  resultUnit?: string
  conditions?: string[]
  /** Set only for reaction-type entries (organic/inorganic transformations), not for algebraic formulas like molarity. */
  reactionType?: string
  reagentsAndConditions?: string[]
  workedExample: ChemistryWorkedExample
  commonMistakes?: string[]
  genZNote?: string
}

export type ChemistryContent = ChemistryConcept | ChemistryFormula

export interface ChemistrySearchHit {
  id: string
  category: ChemistryCategory
  title: string
  subtitle?: string
}
