/**
 * core/organisms/types — Sprint 4, Organism Explorer.
 *
 * Mirrors the philosophy already established by
 * core/concepts/curatedLessons: hand-authored, source-attributed
 * content as plain JSON, rendered by one reusable engine. An
 * `OrganismProfile` is the organism-specific equivalent of a
 * `CuratedLesson` — nothing here is invented; every field a content
 * author fills in should trace back to a real educational or
 * scientific source (see `sources`).
 *
 * Every field beyond the required identity fields is optional — the
 * detail view only renders sections/fields that are actually present
 * (Sprint 4 spec §6: "Only display fields that are available. Do not
 * show empty labels.").
 */

export type OrganismCategory = 'bacteria' | 'fungi' | 'protozoa' | 'virus' | 'algae' | 'other'

export const organismCategoryLabels: Record<OrganismCategory, string> = {
  bacteria: 'Bacteria',
  fungi: 'Fungi',
  protozoa: 'Protozoa',
  virus: 'Viruses',
  algae: 'Algae',
  other: 'Other'
}

export type GramReaction = 'positive' | 'negative' | 'variable' | 'not-applicable'

export const gramReactionLabels: Record<GramReaction, string> = {
  positive: 'Gram-positive',
  negative: 'Gram-negative',
  variable: 'Gram-variable',
  'not-applicable': 'Not Gram-typed'
}

export interface OrganismClassification {
  domain?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
}

export interface OrganismMorphology {
  shape?: string
  arrangement?: string
  gramReaction?: GramReaction
  acidFast?: boolean
  size?: string
  sporeForming?: boolean
  capsule?: string
  motility?: string
  oxygenRequirement?: string
  /** Any structural detail that doesn't fit the fields above. */
  notes?: string
}

export interface OrganismHabitat {
  naturalHabitat?: string
  hostAssociation?: string
  environmentalOccurrence?: string
  reservoir?: string
}

export interface BiochemicalTestResult {
  test: string
  result: string
}

export interface OrganismMicroscopy {
  stain?: string
  appearance?: string
  arrangement?: string
}

export interface OrganismCulture {
  media?: string
  growthCharacteristics?: string
  colonyMorphology?: string
  pigmentation?: string
  hemolysis?: string
}

export interface OrganismLabIdentification {
  microscopy?: OrganismMicroscopy
  culture?: OrganismCulture
  biochemicalTests?: BiochemicalTestResult[]
}

export interface OrganismClinicalImportance {
  diseases?: string[]
  virulenceFactors?: string[]
  toxins?: string[]
  transmission?: string
  epidemiology?: string
  labSignificance?: string
}

export interface OrganismExamFacts {
  gramReaction?: string
  shape?: string
  keyBiochemicalReaction?: string
  importantDisease?: string
  importantTest?: string
  distinguishingFeature?: string
}

export type OrganismSourceKind = 'educational' | 'scientific'

export interface OrganismSource {
  name: string
  kind: OrganismSourceKind
  /** Only set for a stable, institution-hosted reference page — never a search result or an ephemeral link. */
  url?: string
}

export interface OrganismProfile {
  id: string
  scientificName: string
  commonName?: string
  category: OrganismCategory
  /** Local static asset path (e.g. '/organisms/e-coli.svg'). Absent → graceful placeholder, never a broken image. */
  image?: string
  /** Short, quick-scan identifying characteristics shown on the card — 2-4 items, e.g. ["Lactose fermenter", "Facultative anaerobe"]. */
  quickTags: string[]
  /** Lower-cased search index terms beyond name/genus/species/tags — e.g. informal spellings, disease names. */
  searchKeywords?: string[]
  classification: OrganismClassification
  morphology: OrganismMorphology
  habitat?: OrganismHabitat
  labIdentification?: OrganismLabIdentification
  /** "How to recognize it" — the highest-yield identification clues, in priority order. */
  identificationClues: string[]
  clinicalImportance?: OrganismClinicalImportance
  examFacts: OrganismExamFacts
  /** IDs of other OrganismProfile entries — same genus, similar morphology, commonly confused, etc. */
  relatedOrganismIds?: string[]
  sources: OrganismSource[]
}
