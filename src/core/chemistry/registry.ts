/**
 * core/chemistry/registry — Chemistry knowledge base, Tier 1 Foundation.
 *
 * Same loading strategy as `core/physics/registry.ts`,
 * `core/laboratory/registry.ts`, and `core/organisms/registry.ts`:
 * Vite's `import.meta.glob` eagerly discovers every `*.json` file under
 * each `src/content/chemistry/<category>/` folder at build time.
 *
 * Not yet imported by any route or navigation component — see the
 * Physics/Chemistry expansion report. Ready to be wired into a
 * `ChemistryPage`/`ChemistryDetailPage` pair the same way Laboratory's
 * registry is wired to its pages.
 */
import type { ChemistryCategory, ChemistryConcept, ChemistryContent, ChemistryFormula, ChemistrySearchHit } from './types'

function loadCategory<T extends ChemistryContent>(glob: Record<string, { default: unknown }>, category: ChemistryCategory): T[] {
  const items: T[] = []
  for (const [path, mod] of Object.entries(glob)) {
    const data = mod.default as Partial<ChemistryContent> | undefined
    if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !data.id || typeof data.title !== 'string' || !data.title) {
      // eslint-disable-next-line no-console
      console.warn(`[chemistry] Skipping malformed ${category} content file: ${path}`)
      continue
    }
    if (data.category !== category) {
      // eslint-disable-next-line no-console
      console.warn(`[chemistry] Skipping ${path}: category field "${String(data.category)}" does not match folder category "${category}"`)
      continue
    }
    items.push(data as T)
  }
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

const conceptModules = import.meta.glob<{ default: unknown }>('/src/content/chemistry/concepts/*.json', { eager: true })
const formulaModules = import.meta.glob<{ default: unknown }>('/src/content/chemistry/formulas/*.json', { eager: true })

export const ALL_CHEMISTRY_CONCEPTS: ChemistryConcept[] = loadCategory<ChemistryConcept>(conceptModules, 'concept')
export const ALL_CHEMISTRY_FORMULAS: ChemistryFormula[] = loadCategory<ChemistryFormula>(formulaModules, 'formula')

const ALL_CHEMISTRY_CONTENT: ChemistryContent[] = [...ALL_CHEMISTRY_CONCEPTS, ...ALL_CHEMISTRY_FORMULAS]

const CHEMISTRY_CONTENT_BY_ID = new Map(ALL_CHEMISTRY_CONTENT.map((c) => [c.id, c]))

export const CHEMISTRY_CATEGORY_LABELS: Record<ChemistryCategory, string> = {
  concept: 'Concepts',
  formula: 'Formula & Reaction Hub'
}

export const CHEMISTRY_CATEGORY_LIST_BY_CATEGORY: Record<ChemistryCategory, ChemistryContent[]> = {
  concept: ALL_CHEMISTRY_CONCEPTS,
  formula: ALL_CHEMISTRY_FORMULAS
}

export function listChemistryByCategory(category: ChemistryCategory): ChemistryContent[] {
  return CHEMISTRY_CATEGORY_LIST_BY_CATEGORY[category] ?? []
}

export function getChemistryContentById(id: string): ChemistryContent | undefined {
  return CHEMISTRY_CONTENT_BY_ID.get(id)
}

export function countChemistryByCategory(): Record<ChemistryCategory, number> {
  return {
    concept: ALL_CHEMISTRY_CONCEPTS.length,
    formula: ALL_CHEMISTRY_FORMULAS.length
  }
}

export function resolveChemistryRelated(ids: string[] | undefined): ChemistryContent[] {
  if (!ids || ids.length === 0) return []
  return ids.map((id) => CHEMISTRY_CONTENT_BY_ID.get(id)).filter((x): x is ChemistryContent => Boolean(x))
}

function buildHaystack(item: ChemistryContent): string {
  const parts: (string | undefined)[] = [item.title, item.subcategory, item.category, ...(item.searchKeywords ?? [])]
  if (item.category === 'concept') {
    parts.push(item.summary)
    if (item.comparison) item.comparison.forEach((c) => parts.push(c.aspect, c.left, c.right))
  }
  if (item.category === 'formula') parts.push(item.expression, item.domain, item.reactionType, ...item.variables.map((v) => v.symbol))
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const HAYSTACK_BY_ID = new Map(ALL_CHEMISTRY_CONTENT.map((c) => [c.id, buildHaystack(c)]))

export function searchChemistry(query: string): ChemistrySearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_CHEMISTRY_CONTENT.filter((c) => (HAYSTACK_BY_ID.get(c.id) ?? buildHaystack(c)).includes(q)).map((c) => ({
    id: c.id,
    category: c.category,
    title: c.title,
    subtitle: CHEMISTRY_CATEGORY_LABELS[c.category]
  }))
}
