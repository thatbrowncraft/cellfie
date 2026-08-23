/**
 * core/laboratory/registry — Laboratory Module, Tier 1 Foundation.
 *
 * Same loading strategy as `core/organisms/registry.ts` and
 * `core/concepts/curatedLessons/registry.ts`: Vite's `import.meta.glob`
 * eagerly discovers every `*.json` file under each
 * `src/content/laboratory/<category>/` folder at build time. Adding a
 * Tier 2 protocol or media entry later means dropping a new JSON file
 * into the matching folder — nothing here needs to change (brief §13).
 *
 * Kept fully offline-first by construction: content is bundled at build
 * time, never fetched at runtime.
 */
import type {
  BiochemicalTest,
  BiosafetyTopic,
  Equipment,
  Formula,
  LabConcept,
  LaboratoryCategory,
  LaboratoryContent,
  LaboratorySearchHit,
  Media,
  Protocol
} from './types'

function loadCategory<T extends LaboratoryContent>(glob: Record<string, { default: unknown }>, category: LaboratoryCategory): T[] {
  const items: T[] = []
  for (const [path, mod] of Object.entries(glob)) {
    const data = mod.default as Partial<LaboratoryContent> | undefined
    if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !data.id || typeof data.title !== 'string' || !data.title) {
      // eslint-disable-next-line no-console
      console.warn(`[laboratory] Skipping malformed ${category} content file: ${path}`)
      continue
    }
    if (data.category !== category) {
      // eslint-disable-next-line no-console
      console.warn(`[laboratory] Skipping ${path}: category field "${String(data.category)}" does not match folder category "${category}"`)
      continue
    }
    items.push(data as T)
  }
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

const protocolModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/protocols/*.json', { eager: true })
const conceptModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/concepts/*.json', { eager: true })
const mediaModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/media/*.json', { eager: true })
const testModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/biochemical-tests/*.json', { eager: true })
const biosafetyModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/biosafety/*.json', { eager: true })
const equipmentModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/equipment/*.json', { eager: true })
const formulaModules = import.meta.glob<{ default: unknown }>('/src/content/laboratory/formulas/*.json', { eager: true })

export const ALL_PROTOCOLS: Protocol[] = loadCategory<Protocol>(protocolModules, 'protocol')
export const ALL_CONCEPTS: LabConcept[] = loadCategory<LabConcept>(conceptModules, 'concept')
export const ALL_MEDIA: Media[] = loadCategory<Media>(mediaModules, 'media')
export const ALL_TESTS: BiochemicalTest[] = loadCategory<BiochemicalTest>(testModules, 'biochemical-test')
export const ALL_BIOSAFETY: BiosafetyTopic[] = loadCategory<BiosafetyTopic>(biosafetyModules, 'biosafety')
export const ALL_EQUIPMENT: Equipment[] = loadCategory<Equipment>(equipmentModules, 'equipment')
export const ALL_FORMULAS: Formula[] = loadCategory<Formula>(formulaModules, 'formula')

const ALL_CONTENT: LaboratoryContent[] = [
  ...ALL_PROTOCOLS,
  ...ALL_CONCEPTS,
  ...ALL_MEDIA,
  ...ALL_TESTS,
  ...ALL_BIOSAFETY,
  ...ALL_EQUIPMENT,
  ...ALL_FORMULAS
]

const CONTENT_BY_ID = new Map(ALL_CONTENT.map((c) => [c.id, c]))

export const CATEGORY_LABELS: Record<LaboratoryCategory, string> = {
  protocol: 'Protocols',
  concept: 'Concepts',
  media: 'Media',
  'biochemical-test': 'Biochemical Tests',
  biosafety: 'Biosafety',
  equipment: 'Equipment & Glassware',
  formula: 'Formula Hub'
}

export const CATEGORY_LIST_BY_CATEGORY: Record<LaboratoryCategory, LaboratoryContent[]> = {
  protocol: ALL_PROTOCOLS,
  concept: ALL_CONCEPTS,
  media: ALL_MEDIA,
  'biochemical-test': ALL_TESTS,
  biosafety: ALL_BIOSAFETY,
  equipment: ALL_EQUIPMENT,
  formula: ALL_FORMULAS
}

export function listByCategory(category: LaboratoryCategory): LaboratoryContent[] {
  return CATEGORY_LIST_BY_CATEGORY[category] ?? []
}

export function getLabContentById(id: string): LaboratoryContent | undefined {
  return CONTENT_BY_ID.get(id)
}

export function countByCategory(): Record<LaboratoryCategory, number> {
  return {
    protocol: ALL_PROTOCOLS.length,
    concept: ALL_CONCEPTS.length,
    media: ALL_MEDIA.length,
    'biochemical-test': ALL_TESTS.length,
    biosafety: ALL_BIOSAFETY.length,
    equipment: ALL_EQUIPMENT.length,
    formula: ALL_FORMULAS.length
  }
}

/** Resolves an item's related-content ID lists (brief §14) to actual content objects, silently dropping unresolved IDs (e.g. a Tier 2 id referenced ahead of that content existing yet). */
export function resolveRelated(ids: string[] | undefined): LaboratoryContent[] {
  if (!ids || ids.length === 0) return []
  return ids.map((id) => CONTENT_BY_ID.get(id)).filter((x): x is LaboratoryContent => Boolean(x))
}

// ---------------------------------------------------------------------------
// Search — local, substring, case-insensitive, multi-field (mirrors
// core/organisms/registry.ts's approach). Consumed by both the Laboratory
// hub's own search bar and, via core/search, Universal Search (brief §21).
// ---------------------------------------------------------------------------

function buildHaystack(item: LaboratoryContent): string {
  const parts: (string | undefined)[] = [item.title, item.subcategory, item.category, ...(item.searchKeywords ?? [])]
  if (item.category === 'media') parts.push(item.abbreviation)
  if (item.category === 'protocol' || item.category === 'biochemical-test') parts.push(item.purpose)
  if (item.category === 'concept') parts.push(item.summary)
  if (item.category === 'formula') parts.push(item.expression, item.domain)
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const HAYSTACK_BY_ID = new Map(ALL_CONTENT.map((c) => [c.id, buildHaystack(c)]))

export function searchLaboratory(query: string): LaboratorySearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_CONTENT.filter((c) => (HAYSTACK_BY_ID.get(c.id) ?? buildHaystack(c)).includes(q)).map((c) => ({
    id: c.id,
    category: c.category,
    title: c.title,
    subtitle: CATEGORY_LABELS[c.category]
  }))
}
