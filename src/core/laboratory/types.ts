/**
 * core/laboratory/types — Laboratory Module, Tier 1 Foundation.
 *
 * Mirrors the loading/registry pattern already used by
 * `core/organisms/registry.ts` and `core/concepts/curatedLessons/registry.ts`:
 * curated JSON content, validated at build time, cross-linked by stable
 * string IDs rather than nested duplication (Implementation Brief §14).
 *
 * Three data layers stay separate per the brief's Architecture Rules (§2):
 *  - Layer 1 (this file + `src/content/laboratory/**`): curated Cellfie
 *    application content shipped with the repo. Read-only at runtime.
 *  - Layer 2 (`core/organisms/librarySources.ts`, out of scope here): the
 *    user's own Source Library (books/PDFs).
 *  - Layer 3 (`core/db`, Dexie): user-owned local data — notes, highlights,
 *    bookmarks, progress. Laboratory does not introduce a fourth layer;
 *    if/when Laboratory needs user annotations later, they belong in
 *    Layer 3 tables, never mixed into these curated JSON shapes.
 *
 * Scientific Accuracy Rule (brief §16): numeric/procedural values that are
 * method-, manufacturer-, or standard-dependent are represented with a
 * `ReferencedValue` (see below) rather than a bare literal, so the source
 * of that specific value is always visible instead of presented as a
 * silent universal fact.
 */

/** Every Laboratory content category. Extensible — a new category means a new value here plus a new content folder, no restructuring elsewhere. */
export type LaboratoryCategory =
  | 'protocol'
  | 'concept'
  | 'media'
  | 'biochemical-test'
  | 'biosafety'
  | 'equipment'
  | 'formula'

/** Distinguishes what kind of authority backs a piece of content (brief §15). Never treated as interchangeable. */
export type LabSourceType =
  | 'educational-guidance'
  | 'standard-method'
  | 'clinical-diagnostic-method'
  | 'manufacturer-specific'

export interface LabReference {
  label: string
  /** Organization/publication, e.g. "CDC/NIH BMBL", "CLSI", "ASM", "FDA BAM", manufacturer technical sheet name. */
  publisher?: string
  edition?: string
  url?: string
}

/**
 * A value that depends on method, manufacturer, organism, or standard —
 * the brief's §16 explicitly forbids presenting e.g. "121°C/15 psi/15 min"
 * or "30-300 colonies" as universal. Wrapping such values in this shape
 * keeps the dependency and its source attached wherever the value is
 * displayed, instead of a bare number.
 */
export interface ReferencedValue {
  /** Human-readable value/range, e.g. "121°C, 15 psi (~103 kPa), 15–20 minutes for a typical 1 L liquid load". */
  value: string
  /** What this value depends on and does not universally apply beyond. */
  dependsOn: string
  reference?: LabReference
  /** If true, no confident value could be sourced yet — shown as "reference needed" rather than fabricated (brief §16). */
  unverified?: boolean
}

export interface LabContentMeta {
  id: string
  category: LaboratoryCategory
  title: string
  subcategory?: string
  sourceType: LabSourceType
  version: string
  lastVerified: string
  references: LabReference[]
  scientificNotes?: string
  searchKeywords?: string[]
}

/** Cross-links use stable IDs only — never duplicated content (brief §14). Every array is optional; absence means "none recorded yet", not "none exist". */
export interface LabRelatedLinks {
  relatedProtocols?: string[]
  relatedConcepts?: string[]
  relatedMedia?: string[]
  relatedBiochemicalTests?: string[]
  relatedEquipment?: string[]
  relatedFormulas?: string[]
  relatedCalculators?: string[]
  relatedSafety?: string[]
}

// ---------------------------------------------------------------------------
// A. Protocols
// ---------------------------------------------------------------------------

export interface ProtocolStep {
  step: number
  instruction: string
  note?: string
}

export interface Protocol extends LabContentMeta, LabRelatedLinks {
  category: 'protocol'
  purpose: string
  principle: string
  requiredMaterials: string[]
  requiredReagents: string[]
  equipment: string[]
  procedure: ProtocolStep[]
  observations: string
  interpretation: string
  criticalNotes?: string[]
  precautions: string[]
  limitations: string[]
  biosafetyNotes?: string
}

// ---------------------------------------------------------------------------
// B. Concepts (Laboratory-specific reference entries — separate registry
// from `core/concepts` which covers the user's Learn/Knowledge Layer)
// ---------------------------------------------------------------------------

export interface LabConcept extends LabContentMeta, LabRelatedLinks {
  category: 'concept'
  summary: string
  explanation: string
  /** For "X vs Y" comparison concepts (e.g. "CFU vs direct cell count"). Omitted for single-concept entries. */
  comparison?: { aspect: string; left: string; right: string }[]
  commonMisconceptions?: string[]
  examples?: string[]
}

// ---------------------------------------------------------------------------
// C. Media
// ---------------------------------------------------------------------------

export interface MediaComposition {
  ingredient: string
  amount: string
}

export interface MediaFormulation {
  /** Identifies which source/manufacturer this specific formulation reflects — the brief §7 requirement that one manufacturer's formula never stands in as "the" universal formula. */
  sourceLabel: string
  reference?: LabReference
  compositionPerLiter: MediaComposition[]
  finalPh?: ReferencedValue
}

export interface Media extends LabContentMeta, LabRelatedLinks {
  category: 'media'
  abbreviation?: string
  classifications: string[]
  purpose: string
  targetOrganisms: string[]
  formulations: MediaFormulation[]
  preparationSummary: string
  sterilization?: ReferencedValue
  storage: string
  shelfLife?: ReferencedValue
  expectedAppearance: string
  qualityControl?: string
  reactions?: { organismOrGroup: string; reaction: string }[]
  manufacturerNotes?: string
}

// ---------------------------------------------------------------------------
// D. Biochemical Tests
// ---------------------------------------------------------------------------

export interface BiochemicalTest extends LabContentMeta, LabRelatedLinks {
  category: 'biochemical-test'
  principle: string
  purpose: string
  reagents: string[]
  procedure: ProtocolStep[]
  positiveResult: string
  negativeResult: string
  interpretation: string
  controls?: { type: 'positive' | 'negative'; organism: string }[]
  precautions: string[]
  limitations: string[]
  exampleOrganisms?: { organism: string; typicalResult: 'positive' | 'negative' | 'variable' }[]
}

// ---------------------------------------------------------------------------
// E. Biosafety
// ---------------------------------------------------------------------------

export interface BiosafetyTopic extends LabContentMeta, LabRelatedLinks {
  category: 'biosafety'
  summary: string
  explanation: string
  keyPractices: string[]
  commonMistakes?: string[]
  /** Explicit reminder text for topics where risk-group/BSL conflation is a known error (brief §8). Only populated where relevant. */
  scopeCaveat?: string
}

// ---------------------------------------------------------------------------
// F. Equipment & Glassware
// ---------------------------------------------------------------------------

export type EquipmentKind = 'instrument' | 'glassware' | 'consumable'

export interface Equipment extends LabContentMeta, LabRelatedLinks {
  category: 'equipment'
  kind: EquipmentKind
  purpose: string
  operatingPrinciple?: string
  basicOperation?: string[]
  importantSettings?: string[]
  calibration?: string
  maintenance?: string[]
  commonErrors?: { problem: string; cause: string; fix: string }[]
  safety?: string[]
}

// ---------------------------------------------------------------------------
// G. Formula Hub
// ---------------------------------------------------------------------------

export interface FormulaVariable {
  symbol: string
  meaning: string
  unit?: string
}

export interface WorkedExample {
  scenario: string
  substitution: string
  result: string
}

export interface Formula extends LabContentMeta, LabRelatedLinks {
  category: 'formula'
  domain: string
  /** Plain-text symbolic expression, e.g. "CFU/mL = N / (Vplated × D)". No LaTeX renderer is in this project's dependency set, so this is the display form used everywhere. */
  expression: string
  explanation: string
  variables: FormulaVariable[]
  workedExample: WorkedExample
  commonMistakes?: string[]
}

export type LaboratoryContent = Protocol | LabConcept | Media | BiochemicalTest | BiosafetyTopic | Equipment | Formula

export interface LaboratorySearchHit {
  id: string
  category: LaboratoryCategory
  title: string
  subtitle?: string
}
