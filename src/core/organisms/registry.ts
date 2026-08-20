/**
 * core/organisms/registry — Sprint 4, Organism Explorer (Master Revision).
 *
 * Same loading strategy as core/concepts/curatedLessons/registry.ts:
 * Vite's `import.meta.glob` eagerly discovers every `*.json` file in
 * `src/content/organisms/` at build time. Adding organism #25 or #200
 * means dropping a new JSON file into that folder — nothing here, in
 * OrganismExplorerPage, or in OrganismDetailPage needs to change.
 *
 * This keeps the Organism Explorer offline-first by construction: the
 * data is bundled at build time, not fetched at runtime, so search and
 * filtering both work fully offline (§43/§44) — no network request is
 * ever made from this module.
 *
 * Master Revision §6: every filter below matches against a *normalized*
 * category field (an enum or boolean set by the content author), never
 * a free-text substring. This is why `oxygenRequirementCategory` exists
 * separately from the free-text `oxygenRequirement` display string —
 * `oxygenRequirement.includes('anaerobe')` would incorrectly match
 * "Facultative anaerobe" when filtering for true anaerobes; matching
 * `oxygenRequirementCategory === 'obligate-anaerobe'` cannot.
 */
import type {
  ArrangementCategory,
  BodyLocation,
  FungalClinicalGroup,
  FungalMorphologicalType,
  GramReaction,
  HyphaeType,
  OrganismCategory,
  OrganismProfile,
  OxygenRequirementCategory,
  ProtozoanGroup,
  RelatedOrganismRelationship,
  ShapeCategory,
  TransmissionRoute,
  ViralEnvelope,
  ViralGenomeStrandedness,
  ViralGenomeType,
  ViralReplicationSite
} from './types'

const organismModules = import.meta.glob<{ default: unknown }>('/src/content/organisms/*.json', { eager: true })

/** A lightweight runtime shape check — not full schema validation. A malformed content file is skipped with a console warning rather than crashing the whole Explorer. */
function isValidOrganism(x: unknown): x is OrganismProfile {
  if (!x || typeof x !== 'object') return false
  const o = x as Partial<OrganismProfile>
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.scientificName === 'string' &&
    o.scientificName.length > 0 &&
    typeof o.category === 'string' &&
    Array.isArray(o.quickTags) &&
    Boolean(o.classification) &&
    Boolean(o.morphology) &&
    Array.isArray(o.identificationClues) &&
    Boolean(o.examFacts) &&
    Array.isArray(o.sources)
  )
}

const ALL_ORGANISMS: OrganismProfile[] = Object.entries(organismModules)
  .map(([path, mod]) => {
    const data = mod.default
    if (!isValidOrganism(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[organisms] Skipping malformed organism content file: ${path}`)
      return undefined
    }
    return data
  })
  .filter((organism): organism is OrganismProfile => Boolean(organism))
  // Stable, predictable order — alphabetical by scientific name, so the
  // grid layout doesn't shuffle based on file-system load order.
  .sort((a, b) => a.scientificName.localeCompare(b.scientificName))

const ORGANISMS_BY_ID = new Map(ALL_ORGANISMS.map((o) => [o.id, o]))

/** Every organism profile Cellfie currently ships, in scientific-name order. */
export function listOrganisms(): OrganismProfile[] {
  return ALL_ORGANISMS
}

/** A single organism by id, or undefined if it doesn't exist (e.g. stale link, malformed content file skipped at build time). */
export function getOrganismById(id: string): OrganismProfile | undefined {
  return ORGANISMS_BY_ID.get(id)
}

/** Resolves an organism's `relatedOrganisms` links to actual profiles, silently dropping any id that doesn't resolve (§36 — each link now carries *why* the two are related). */
export function getRelatedOrganisms(
  organism: OrganismProfile
): { organism: OrganismProfile; relationship: RelatedOrganismRelationship }[] {
  if (!organism.relatedOrganisms || organism.relatedOrganisms.length === 0) return []
  return organism.relatedOrganisms
    .map((link) => {
      const related = ORGANISMS_BY_ID.get(link.id)
      return related ? { organism: related, relationship: link.relationship } : undefined
    })
    .filter((x): x is { organism: OrganismProfile; relationship: RelatedOrganismRelationship } => Boolean(x))
}

// ---------------------------------------------------------------------------
// Search (§11) — local, substring, case-insensitive, multi-field
// ---------------------------------------------------------------------------

const gramSearchTerms: Record<GramReaction, string[]> = {
  positive: ['gram positive', 'gram-positive', "gram's positive"],
  negative: ['gram negative', 'gram-negative', "gram's negative"],
  variable: ['gram variable', 'gram-variable'],
  'not-applicable': []
}

/**
 * Builds one lower-cased haystack per organism from every field the
 * Sprint 4 spec calls out as searchable (§11): scientific/common name,
 * genus, category, tags, structured characteristics (Gram reaction,
 * shape, oxygen requirement, fungal/protozoan/viral normalized fields),
 * and important identification clues/biochemical test names. Case-
 * insensitive, substring-based — deliberately the simplest
 * implementation that satisfies the spec, no search library.
 */
function buildSearchHaystack(o: OrganismProfile): string {
  const parts = [
    o.scientificName,
    o.commonName,
    o.category,
    o.classification.genus,
    o.classification.species,
    o.classification.family,
    o.morphology.shape,
    o.morphology.shapeCategory,
    o.morphology.arrangement,
    ...(o.morphology.gramReaction ? gramSearchTerms[o.morphology.gramReaction] : []),
    o.morphology.acidFast ? 'acid-fast acid fast' : '',
    o.morphology.oxygenRequirement,
    o.fungalDetails?.morphologicalType,
    ...(o.fungalDetails?.hyphae ?? []),
    o.protozoanDetails?.group,
    o.protozoanDetails?.majorLocation,
    o.virusDetails?.genomeType,
    o.virusDetails?.genomeStrandedness,
    o.virusDetails?.envelope,
    o.quickTags.join(' '),
    o.identificationClues.join(' '),
    (o.labIdentification?.biochemicalTests ?? []).map((t) => t.test).join(' '),
    ...(o.searchKeywords ?? [])
  ]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const HAYSTACK_BY_ID = new Map(ALL_ORGANISMS.map((o) => [o.id, buildSearchHaystack(o)]))

export function searchOrganisms(organisms: OrganismProfile[], query: string): OrganismProfile[] {
  const q = query.trim().toLowerCase()
  if (!q) return organisms
  return organisms.filter((o) => (HAYSTACK_BY_ID.get(o.id) ?? buildSearchHaystack(o)).includes(q))
}

export function filterByCategory(organisms: OrganismProfile[], category: OrganismCategory | 'all'): OrganismProfile[] {
  if (category === 'all') return organisms
  return organisms.filter((o) => o.category === category)
}

/** Category counts for the current organism set — used to show "Bacteria (25)" style tab labels. Always computed live from the registry (§3/§41), never hardcoded. */
export function countByCategory(organisms: OrganismProfile[]): Partial<Record<OrganismCategory, number>> {
  const counts: Partial<Record<OrganismCategory, number>> = {}
  for (const o of organisms) counts[o.category] = (counts[o.category] ?? 0) + 1
  return counts
}

// ---------------------------------------------------------------------------
// Category-specific filters (§4, §5, §7, §8, §9) — each dimension is
// independently optional; `undefined` means "All" for that dimension.
// Every check below compares normalized fields only (§6).
// ---------------------------------------------------------------------------

export type GramFilterValue = 'positive' | 'negative' | 'acid-fast'

export interface BacteriaFilterState {
  gram?: GramFilterValue
  shapeCategory?: ShapeCategory
  arrangementCategory?: ArrangementCategory
  oxygenRequirementCategory?: OxygenRequirementCategory
  sporeForming?: boolean
  motile?: boolean
  encapsulated?: boolean
}

export const EMPTY_BACTERIA_FILTERS: BacteriaFilterState = {}

export function applyBacteriaFilters(organisms: OrganismProfile[], filters: BacteriaFilterState): OrganismProfile[] {
  return organisms.filter((o) => {
    const m = o.morphology
    if (filters.gram === 'acid-fast' && !m.acidFast) return false
    if (filters.gram === 'positive' && m.gramReaction !== 'positive') return false
    if (filters.gram === 'negative' && m.gramReaction !== 'negative') return false
    if (filters.shapeCategory && m.shapeCategory !== filters.shapeCategory) return false
    if (filters.arrangementCategory && m.arrangementCategory !== filters.arrangementCategory) return false
    if (filters.oxygenRequirementCategory && m.oxygenRequirementCategory !== filters.oxygenRequirementCategory) return false
    if (filters.sporeForming !== undefined && Boolean(m.sporeForming) !== filters.sporeForming) return false
    if (filters.motile !== undefined && Boolean(m.motile) !== filters.motile) return false
    if (filters.encapsulated !== undefined && Boolean(m.encapsulated) !== filters.encapsulated) return false
    return true
  })
}

export function countActiveBacteriaFilters(filters: BacteriaFilterState): number {
  return Object.values(filters).filter((v) => v !== undefined).length
}

export interface FungiFilterState {
  morphologicalType?: FungalMorphologicalType
  hyphae?: HyphaeType
  clinicalGroup?: FungalClinicalGroup
}

export const EMPTY_FUNGI_FILTERS: FungiFilterState = {}

export function applyFungiFilters(organisms: OrganismProfile[], filters: FungiFilterState): OrganismProfile[] {
  return organisms.filter((o) => {
    const d = o.fungalDetails
    if (filters.morphologicalType && d?.morphologicalType !== filters.morphologicalType) return false
    if (filters.hyphae && !(d?.hyphae ?? []).includes(filters.hyphae)) return false
    if (filters.clinicalGroup && d?.clinicalGroup !== filters.clinicalGroup) return false
    return true
  })
}

export function countActiveFungiFilters(filters: FungiFilterState): number {
  return Object.values(filters).filter((v) => v !== undefined).length
}

export interface ProtozoaFilterState {
  group?: ProtozoanGroup
  majorLocation?: BodyLocation
  transmissionRoute?: TransmissionRoute
}

export const EMPTY_PROTOZOA_FILTERS: ProtozoaFilterState = {}

export function applyProtozoaFilters(organisms: OrganismProfile[], filters: ProtozoaFilterState): OrganismProfile[] {
  return organisms.filter((o) => {
    const d = o.protozoanDetails
    if (filters.group && d?.group !== filters.group) return false
    if (filters.majorLocation && d?.majorLocation !== filters.majorLocation) return false
    if (filters.transmissionRoute && d?.transmissionRoute !== filters.transmissionRoute) return false
    return true
  })
}

export function countActiveProtozoaFilters(filters: ProtozoaFilterState): number {
  return Object.values(filters).filter((v) => v !== undefined).length
}

export interface VirusFilterState {
  genomeType?: ViralGenomeType
  genomeStrandedness?: ViralGenomeStrandedness
  envelope?: ViralEnvelope
  replicationSite?: ViralReplicationSite
  transmissionRoute?: TransmissionRoute
}

export const EMPTY_VIRUS_FILTERS: VirusFilterState = {}

export function applyVirusFilters(organisms: OrganismProfile[], filters: VirusFilterState): OrganismProfile[] {
  return organisms.filter((o) => {
    const d = o.virusDetails
    if (filters.genomeType && d?.genomeType !== filters.genomeType) return false
    if (filters.genomeStrandedness && d?.genomeStrandedness !== filters.genomeStrandedness) return false
    if (filters.envelope && d?.envelope !== filters.envelope) return false
    if (filters.replicationSite && d?.replicationSite !== filters.replicationSite) return false
    if (filters.transmissionRoute && d?.transmissionRoute !== filters.transmissionRoute) return false
    return true
  })
}

export function countActiveVirusFilters(filters: VirusFilterState): number {
  return Object.values(filters).filter((v) => v !== undefined).length
}
