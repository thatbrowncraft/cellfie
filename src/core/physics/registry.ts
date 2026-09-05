/**
 * core/physics/registry — Physics knowledge base, Tier 1 Foundation.
 *
 * Same loading strategy as `core/laboratory/registry.ts` and
 * `core/organisms/registry.ts`: Vite's `import.meta.glob` eagerly
 * discovers every `*.json` file under each
 * `src/content/physics/<category>/` folder at build time. Adding
 * concept #40 or formula #40 later means dropping a new JSON file into
 * the matching folder — nothing here needs to change.
 *
 * This file is not yet imported by any route or navigation component
 * (see the Physics/Chemistry expansion report for why). It is a
 * complete, working, isolated registry ready to be wired into a
 * `PhysicsPage`/`PhysicsDetailPage` pair and the router the same way
 * Laboratory's registry is wired to `LaboratoryPage`/`LaboratoryDetailPage`.
 */
import type { PhysicsCategory, PhysicsConcept, PhysicsContent, PhysicsFormula, PhysicsSearchHit } from './types'

function loadCategory<T extends PhysicsContent>(glob: Record<string, { default: unknown }>, category: PhysicsCategory): T[] {
  const items: T[] = []
  for (const [path, mod] of Object.entries(glob)) {
    const data = mod.default as Partial<PhysicsContent> | undefined
    if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !data.id || typeof data.title !== 'string' || !data.title) {
      // eslint-disable-next-line no-console
      console.warn(`[physics] Skipping malformed ${category} content file: ${path}`)
      continue
    }
    if (data.category !== category) {
      // eslint-disable-next-line no-console
      console.warn(`[physics] Skipping ${path}: category field "${String(data.category)}" does not match folder category "${category}"`)
      continue
    }
    items.push(data as T)
  }
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

const conceptModules = import.meta.glob<{ default: unknown }>('/src/content/physics/concepts/*.json', { eager: true })
const formulaModules = import.meta.glob<{ default: unknown }>('/src/content/physics/formulas/*.json', { eager: true })

export const ALL_PHYSICS_CONCEPTS: PhysicsConcept[] = loadCategory<PhysicsConcept>(conceptModules, 'concept')
export const ALL_PHYSICS_FORMULAS: PhysicsFormula[] = loadCategory<PhysicsFormula>(formulaModules, 'formula')

const ALL_PHYSICS_CONTENT: PhysicsContent[] = [...ALL_PHYSICS_CONCEPTS, ...ALL_PHYSICS_FORMULAS]

const PHYSICS_CONTENT_BY_ID = new Map(ALL_PHYSICS_CONTENT.map((c) => [c.id, c]))

export const PHYSICS_CATEGORY_LABELS: Record<PhysicsCategory, string> = {
  concept: 'Concepts',
  formula: 'Formula Hub'
}

export const PHYSICS_CATEGORY_LIST_BY_CATEGORY: Record<PhysicsCategory, PhysicsContent[]> = {
  concept: ALL_PHYSICS_CONCEPTS,
  formula: ALL_PHYSICS_FORMULAS
}

export function listPhysicsByCategory(category: PhysicsCategory): PhysicsContent[] {
  return PHYSICS_CATEGORY_LIST_BY_CATEGORY[category] ?? []
}

export function getPhysicsContentById(id: string): PhysicsContent | undefined {
  return PHYSICS_CONTENT_BY_ID.get(id)
}

export function countPhysicsByCategory(): Record<PhysicsCategory, number> {
  return {
    concept: ALL_PHYSICS_CONCEPTS.length,
    formula: ALL_PHYSICS_FORMULAS.length
  }
}

export function resolvePhysicsRelated(ids: string[] | undefined): PhysicsContent[] {
  if (!ids || ids.length === 0) return []
  return ids.map((id) => PHYSICS_CONTENT_BY_ID.get(id)).filter((x): x is PhysicsContent => Boolean(x))
}

function buildHaystack(item: PhysicsContent): string {
  const parts: (string | undefined)[] = [item.title, item.subcategory, item.category, ...(item.searchKeywords ?? [])]
  if (item.category === 'concept') {
    parts.push(item.summary)
    if (item.comparison) item.comparison.forEach((c) => parts.push(c.aspect, c.left, c.right))
  }
  if (item.category === 'formula') parts.push(item.expression, item.domain, ...item.variables.map((v) => v.symbol))
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const HAYSTACK_BY_ID = new Map(ALL_PHYSICS_CONTENT.map((c) => [c.id, buildHaystack(c)]))

export function searchPhysics(query: string): PhysicsSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_PHYSICS_CONTENT.filter((c) => (HAYSTACK_BY_ID.get(c.id) ?? buildHaystack(c)).includes(q)).map((c) => ({
    id: c.id,
    category: c.category,
    title: c.title,
    subtitle: PHYSICS_CATEGORY_LABELS[c.category]
  }))
}
