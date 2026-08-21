/**
 * core/organisms/types — Sprint 4, Organism Explorer (Master Revision).
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
 *
 * MASTER REVISION additions (all additive — no existing field removed
 * or renamed except `relatedOrganismIds` → `relatedOrganisms`, which
 * every shipped content file has been migrated to in this same
 * revision, so nothing references the old shape anymore):
 *
 * 1. Normalized, filterable *Category fields alongside the existing
 *    free-text display fields on OrganismMorphology (§6 — filters must
 *    operate on real biological categories, not substring matches like
 *    `oxygenRequirement.includes('anaerobe')` incorrectly matching
 *    "Facultative anaerobe").
 * 2. `fungalDetails` / `protozoanDetails` / `virusDetails` — optional,
 *    category-specific structured blocks (§7-§9, §34) so a virus never
 *    has to fill in a bacterial Gram-reaction field just to have
 *    *something* to filter on.
 * 3. `relatedOrganisms` replaces the old plain `relatedOrganismIds`
 *    string array with `{ id, relationship }` pairs so the detail page
 *    can say *why* two organisms are related instead of a generic
 *    "Related organisms" list (§36).
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

/** The categories the Explorer always offers a tab for, even at 0 count, per §3 ("main planned categories can remain visible if the architecture supports future expansion"). Algae/Other stay hidden at 0 count — they're extensibility placeholders, not part of the initial planned set. */
export const primaryOrganismCategories: OrganismCategory[] = ['bacteria', 'fungi', 'protozoa', 'virus']

// ---------------------------------------------------------------------------
// Shared / cross-category normalized enums
// ---------------------------------------------------------------------------

export type GramReaction = 'positive' | 'negative' | 'variable' | 'not-applicable'

export const gramReactionLabels: Record<GramReaction, string> = {
  positive: 'Gram-positive',
  negative: 'Gram-negative',
  variable: 'Gram-variable',
  'not-applicable': 'Not Gram-typed'
}

/** §9/§8 — shared by protozoa and viruses so "fecal-oral" etc. is one vocabulary, not two. */
export type TransmissionRoute =
  | 'fecal-oral'
  | 'vector-borne'
  | 'sexual'
  | 'respiratory'
  | 'blood-body-fluids'
  | 'zoonotic'
  | 'other'

export const transmissionRouteLabels: Record<TransmissionRoute, string> = {
  'fecal-oral': 'Fecal-oral',
  'vector-borne': 'Vector-borne',
  sexual: 'Sexual',
  respiratory: 'Respiratory',
  'blood-body-fluids': 'Blood/body fluids',
  zoonotic: 'Zoonotic',
  other: 'Other'
}

// ---------------------------------------------------------------------------
// Bacteria — normalized morphology categories (§5, §6)
// ---------------------------------------------------------------------------

export type ShapeCategory =
  | 'coccus'
  | 'bacillus'
  | 'coccobacillus'
  | 'spiral'
  | 'spirochete'
  | 'filamentous'
  | 'pleomorphic'

export const shapeCategoryLabels: Record<ShapeCategory, string> = {
  coccus: 'Cocci',
  bacillus: 'Bacilli',
  coccobacillus: 'Coccobacilli',
  spiral: 'Spiral',
  spirochete: 'Spirochete',
  filamentous: 'Filamentous',
  pleomorphic: 'Pleomorphic'
}

export type ArrangementCategory = 'single' | 'pairs' | 'chains' | 'clusters' | 'palisades'

export const arrangementCategoryLabels: Record<ArrangementCategory, string> = {
  single: 'Singles',
  pairs: 'Pairs',
  chains: 'Chains',
  clusters: 'Clusters',
  palisades: 'Palisades'
}

export type OxygenRequirementCategory = 'obligate-aerobe' | 'facultative-anaerobe' | 'obligate-anaerobe' | 'microaerophile'

export const oxygenRequirementCategoryLabels: Record<OxygenRequirementCategory, string> = {
  'obligate-aerobe': 'Obligate aerobe',
  'facultative-anaerobe': 'Facultative anaerobe',
  'obligate-anaerobe': 'Obligate anaerobe',
  microaerophile: 'Microaerophile'
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
  /** Free-text display value, e.g. "Rod (bacillus)". */
  shape?: string
  /** Normalized — what the Shape filter actually matches against. */
  shapeCategory?: ShapeCategory
  arrangement?: string
  arrangementCategory?: ArrangementCategory
  gramReaction?: GramReaction
  acidFast?: boolean
  size?: string
  sporeForming?: boolean
  capsule?: string
  /** Normalized — what the Capsule filter matches against. Absent when encapsulation isn't a meaningful/documented characteristic for this organism. */
  encapsulated?: boolean
  motility?: string
  /** Normalized — what the Motility filter matches against. */
  motile?: boolean
  /** Free-text display value, e.g. "Facultative anaerobe". */
  oxygenRequirement?: string
  /** Normalized — what the Oxygen filter actually matches against (§6: prevents "Facultative anaerobe" text incorrectly matching an "anaerobe" substring filter). */
  oxygenRequirementCategory?: OxygenRequirementCategory
  /** Any structural detail that doesn't fit the fields above. */
  notes?: string
}

// ---------------------------------------------------------------------------
// Fungi — category-specific structured block (§7, §34)
// ---------------------------------------------------------------------------

export type FungalMorphologicalType = 'yeast' | 'mold' | 'dimorphic'

export const fungalMorphologicalTypeLabels: Record<FungalMorphologicalType, string> = {
  yeast: 'Yeast',
  mold: 'Mold',
  dimorphic: 'Dimorphic'
}

export type HyphaeType = 'septate' | 'aseptate' | 'pseudohyphae' | 'true-hyphae'

export const hyphaeTypeLabels: Record<HyphaeType, string> = {
  septate: 'Septate',
  aseptate: 'Aseptate',
  pseudohyphae: 'Pseudohyphae',
  'true-hyphae': 'True hyphae'
}

export type FungalClinicalGroup = 'superficial' | 'cutaneous' | 'subcutaneous' | 'systemic' | 'opportunistic'

export const fungalClinicalGroupLabels: Record<FungalClinicalGroup, string> = {
  superficial: 'Superficial',
  cutaneous: 'Cutaneous',
  subcutaneous: 'Subcutaneous',
  systemic: 'Systemic',
  opportunistic: 'Opportunistic'
}

export interface FungalDetails {
  morphologicalType?: FungalMorphologicalType
  hyphae?: HyphaeType[]
  /** Free-text reproductive/structural features, e.g. ["Conidia", "Chlamydospores"] — deliberately not an enum since this list is genuinely open-ended (§7). */
  reproductiveStructures?: string[]
  clinicalGroup?: FungalClinicalGroup
}

// ---------------------------------------------------------------------------
// Protozoa — category-specific structured block (§8, §34)
// ---------------------------------------------------------------------------

export type ProtozoanGroup = 'amoeba' | 'flagellate' | 'ciliate' | 'apicomplexan'

export const protozoanGroupLabels: Record<ProtozoanGroup, string> = {
  amoeba: 'Amoebae',
  flagellate: 'Flagellates',
  ciliate: 'Ciliates',
  apicomplexan: 'Apicomplexans/sporozoa'
}

export type BodyLocation = 'intestinal' | 'blood' | 'tissue' | 'urogenital' | 'other'

export const bodyLocationLabels: Record<BodyLocation, string> = {
  intestinal: 'Intestinal',
  blood: 'Blood',
  tissue: 'Tissue',
  urogenital: 'Urogenital',
  other: 'Other'
}

export interface ProtozoanDetails {
  group?: ProtozoanGroup
  majorLocation?: BodyLocation
  transmissionRoute?: TransmissionRoute
  /** Free-text life-cycle form present in the specimen being described, e.g. "Trophozoite and cyst stages". */
  lifeCycleForm?: string
}

// ---------------------------------------------------------------------------
// Viruses — category-specific structured block (§9, §33, §34)
// ---------------------------------------------------------------------------

export type ViralGenomeType = 'dna' | 'rna'

export const viralGenomeTypeLabels: Record<ViralGenomeType, string> = {
  dna: 'DNA',
  rna: 'RNA'
}

export type ViralGenomeStrandedness = 'ssdna' | 'dsdna' | 'ssrna' | 'dsrna'

export const viralGenomeStrandednessLabels: Record<ViralGenomeStrandedness, string> = {
  ssdna: 'ssDNA',
  dsdna: 'dsDNA',
  ssrna: 'ssRNA',
  dsrna: 'dsRNA'
}

export type ViralEnvelope = 'enveloped' | 'non-enveloped'

export const viralEnvelopeLabels: Record<ViralEnvelope, string> = {
  enveloped: 'Enveloped',
  'non-enveloped': 'Non-enveloped'
}

export type ViralReplicationSite = 'cytoplasmic' | 'nuclear' | 'other'

export const viralReplicationSiteLabels: Record<ViralReplicationSite, string> = {
  cytoplasmic: 'Cytoplasmic',
  nuclear: 'Nuclear',
  other: 'Other'
}

export interface VirusDetails {
  genomeType?: ViralGenomeType
  genomeStrandedness?: ViralGenomeStrandedness
  envelope?: ViralEnvelope
  capsidSymmetry?: string
  replicationSite?: ViralReplicationSite
  transmissionRoute?: TransmissionRoute
}

// ---------------------------------------------------------------------------
// Habitat, lab identification, clinical importance, exam facts — unchanged
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Related organisms — typed relationship (§36)
// ---------------------------------------------------------------------------

export type RelatedOrganismRelationship =
  | 'same-genus'
  | 'similar-morphology'
  | 'differential-identification'
  | 'commonly-confused'
  | 'same-clinical-specimen'
  | 'same-laboratory-workflow'
  | 'same-broad-classification'

export const relatedOrganismRelationshipLabels: Record<RelatedOrganismRelationship, string> = {
  'same-genus': 'Same genus',
  'similar-morphology': 'Similar morphology',
  'differential-identification': 'Differential identification',
  'commonly-confused': 'Commonly confused',
  'same-clinical-specimen': 'Same clinical specimen',
  'same-laboratory-workflow': 'Same laboratory workflow',
  'same-broad-classification': 'Same broad classification'
}

export interface RelatedOrganismLink {
  id: string
  relationship: RelatedOrganismRelationship
}

// ---------------------------------------------------------------------------
// The organism profile itself
// ---------------------------------------------------------------------------

export interface OrganismProfile {
  id: string
  scientificName: string
  commonName?: string
  category: OrganismCategory
  /**
   * Path to the built-in scientific illustration for this organism, e.g.
   * '/organisms/escherichia-coli.svg'. Served from `public/organisms/`
   * (Vite copies `public/` as-is, so this is a plain static path, not a
   * bundler import — content files are plain JSON and can't `import`).
   * A user's own custom image (see core/organisms/customImages.ts)
   * always takes priority over this at render time; this field is only
   * ever the built-in fallback, never overwritten by a custom upload
   * (§21, §23).
   */
  image?: string
  /** Short, quick-scan identifying characteristics shown on the card — 2-4 items, e.g. ["Lactose fermenter", "Facultative anaerobe"]. */
  quickTags: string[]
  /** Lower-cased search index terms beyond name/genus/species/tags — e.g. informal spellings, disease names. */
  searchKeywords?: string[]
  classification: OrganismClassification
  morphology: OrganismMorphology
  /** Only meaningful for category: 'fungi'. Absent for every other category. */
  fungalDetails?: FungalDetails
  /** Only meaningful for category: 'protozoa'. Absent for every other category. */
  protozoanDetails?: ProtozoanDetails
  /** Only meaningful for category: 'virus'. Absent for every other category — a virus profile never fills in bacterial Gram-reaction/shape fields (§9, §35). */
  virusDetails?: VirusDetails
  habitat?: OrganismHabitat
  labIdentification?: OrganismLabIdentification
  /** "How to recognize it" — the highest-yield identification clues, in priority order. */
  identificationClues: string[]
  clinicalImportance?: OrganismClinicalImportance
  examFacts: OrganismExamFacts
  /** Other organisms this one is meaningfully related to, each tagged with *why* (§36). */
  relatedOrganisms?: RelatedOrganismLink[]
  sources: OrganismSource[]
  /**
   * Knowledge Layer Integration — provenance. Absent (or 'curated-local')
   * for every hand-authored file under src/content/organisms; the
   * registry loader stamps that explicitly so nothing downstream has to
   * treat "absent" and "curated" as different cases. 'knowledge-layer'
   * is a session-only profile built from live retrieval that hasn't
   * been saved yet; 'user-saved' is the same kind of profile after the
   * user has explicitly persisted it to their local device (§10/§11).
   */
  sourceType?: OrganismSourceType
  /**
   * Present only on 'knowledge-layer'/'user-saved' profiles that
   * actually found something online. Every field here is a direct,
   * unedited excerpt from a real source at a real URL — never
   * Cellfie-authored prose, and never a stand-in for the structured
   * classification/morphology/lab-ID fields above, which stay empty
   * when no reliable source provided that specific structured fact
   * (§7/§38 — omit rather than guess).
   */
  knowledgeLayer?: KnowledgeLayerInfo
  /**
   * A trusted external image (currently: NLM's Open-i biomedical figure
   * search, via core/concepts/onlineKnowledge.ts) for an organism that
   * has neither a user upload nor a built-in Cellfie SVG yet (§25/§28).
   * Always carries its own attribution — never hotlinked without one.
   */
  externalImage?: ExternalImageReference
}

// ---------------------------------------------------------------------------
// Knowledge Layer Integration (§1-§47 of the Knowledge Layer brief)
// ---------------------------------------------------------------------------

export type OrganismSourceType = 'curated-local' | 'knowledge-layer' | 'user-saved'

/** A single direct excerpt from one real, named, linked source — the shape every Knowledge Layer field uses, matching core/concepts/onlineKnowledge.ts's own OnlineSummary/OnlineKnowledgeSection convention rather than inventing a parallel one. */
export interface SourcedExcerpt {
  text: string
  sourceName: string
  sourceUrl: string
  /** True when `text` is a paper abstract rather than a general/definitional excerpt — the UI labels it accordingly rather than implying it's a textbook definition. */
  isAbstract?: boolean
}

export interface KnowledgeLayerInfo {
  /** When this profile was retrieved/last refreshed — epoch ms. */
  retrievedAt: number
  /** A general description excerpt — from PubMed (biomedical-looking names) or a Wikipedia-filtered general-reference tier, whichever `fetchOnlineSummary` found (§8/§38: never invented, never Wikipedia). */
  generalReference?: SourcedExcerpt
  /** NCBI MeSH's own scope note for this term, when MeSH has a matching descriptor — the closest thing to a authoritative one-paragraph classification/definition this app can retrieve without AI-based extraction. */
  meshScopeNote?: SourcedExcerpt
}

export interface ExternalImageReference {
  imageUrl: string
  caption?: string
  sourceName: string
  sourceUrl: string
}
