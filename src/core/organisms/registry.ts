/**
 * core/organisms/registry — Sprint 4, Organism Explorer.
 *
 * Same loading strategy as core/concepts/curatedLessons/registry.ts:
 * Vite's `import.meta.glob` eagerly discovers every `*.json` file in
 * `src/content/organisms/` at build time. Adding organism #9, #20, or
 * #200 means dropping a new JSON file into that folder — nothing here,
 * in OrganismExplorerPage, or in OrganismDetailPage needs to change.
 *
 * This keeps the Organism Explorer offline-first by construction: the
 * data is bundled at build time, not fetched at runtime, so search and
 * filtering work with no network at all (Sprint 4 spec §18/§19).
 */
import type { GramReaction, OrganismCategory, OrganismProfile } from './types'

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

/** Resolves an organism's `relatedOrganismIds` to actual profiles, silently dropping any id that doesn't resolve. */
export function getRelatedOrganisms(organism: OrganismProfile): OrganismProfile[] {
  if (!organism.relatedOrganismIds || organism.relatedOrganismIds.length === 0) return []
  return organism.relatedOrganismIds
    .map((id) => ORGANISMS_BY_ID.get(id))
    .filter((o): o is OrganismProfile => Boolean(o))
}

const gramSearchTerms: Record<GramReaction, string[]> = {
  positive: ['gram positive', 'gram-positive', "gram's positive"],
  negative: ['gram negative', 'gram-negative', "gram's negative"],
  variable: ['gram variable', 'gram-variable'],
  'not-applicable': []
}

/**
 * Builds one lower-cased haystack per organism from every field the
 * Sprint 4 spec calls out as searchable (§1): name, genus, species,
 * common name, key characteristics, Gram reaction, shape, and any
 * laboratory identifier a content author added as a search keyword.
 * Case-insensitive, substring-based — deliberately the simplest
 * implementation that satisfies the spec, no search library.
 */
function buildSearchHaystack(o: OrganismProfile): string {
  const parts = [
    o.scientificName,
    o.commonName,
    o.classification.genus,
    o.classification.species,
    o.classification.family,
    o.morphology.shape,
    o.morphology.arrangement,
    ...(o.morphology.gramReaction ? gramSearchTerms[o.morphology.gramReaction] : []),
    o.morphology.acidFast ? 'acid-fast acid fast' : '',
    o.quickTags.join(' '),
    o.identificationClues.join(' '),
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

export type SecondaryFilterId =
  | 'all'
  | 'gram-positive'
  | 'gram-negative'
  | 'acid-fast'
  | 'cocci'
  | 'bacilli'
  | 'spiral'
  | 'aerobic'
  | 'anaerobic'

export const secondaryFilterOptions: { value: SecondaryFilterId; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gram-positive', label: 'Gram-positive' },
  { value: 'gram-negative', label: 'Gram-negative' },
  { value: 'acid-fast', label: 'Acid-fast' },
  { value: 'cocci', label: 'Cocci' },
  { value: 'bacilli', label: 'Bacilli' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'aerobic', label: 'Aerobic' },
  { value: 'anaerobic', label: 'Anaerobic' }
]

export function applySecondaryFilter(organisms: OrganismProfile[], filter: SecondaryFilterId): OrganismProfile[] {
  if (filter === 'all') return organisms
  return organisms.filter((o) => {
    const shape = (o.morphology.shape ?? '').toLowerCase()
    const oxygen = (o.morphology.oxygenRequirement ?? '').toLowerCase()
    switch (filter) {
      case 'gram-positive':
        return o.morphology.gramReaction === 'positive'
      case 'gram-negative':
        return o.morphology.gramReaction === 'negative'
      case 'acid-fast':
        return Boolean(o.morphology.acidFast)
      case 'cocci':
        return shape.includes('coccu') || shape.includes('cocci')
      case 'bacilli':
        return shape.includes('bacill') || shape.includes('rod')
      case 'spiral':
        return shape.includes('spiral') || shape.includes('spirochete') || shape.includes('curved')
      case 'aerobic':
        return oxygen.includes('aerobic') && !oxygen.includes('anaerobic')
      case 'anaerobic':
        return oxygen.includes('anaerobic')
      default:
        return true
    }
  })
}

export function filterByCategory(organisms: OrganismProfile[], category: OrganismCategory | 'all'): OrganismProfile[] {
  if (category === 'all') return organisms
  return organisms.filter((o) => o.category === category)
}

/** Category counts for the current organism set — used to show "Bacteria (6)" style pill labels and to know which categories are even worth showing. */
export function countByCategory(organisms: OrganismProfile[]): Partial<Record<OrganismCategory, number>> {
  const counts: Partial<Record<OrganismCategory, number>> = {}
  for (const o of organisms) counts[o.category] = (counts[o.category] ?? 0) + 1
  return counts
}
