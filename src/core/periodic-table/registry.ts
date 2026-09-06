/**
 * core/periodic-table/registry — Study Vault Periodic Table feature.
 *
 * Same loading strategy as `core/laboratory/registry.ts`: Vite's
 * `import.meta.glob(..., { eager: true })` discovers every `*.json`
 * under `src/content/periodic-table/elements/` at build time. This
 * module (and everything under `src/modules/periodic-table/`) is only
 * ever imported from the lazy-loaded `PeriodicTablePage`/
 * `ElementDetailPage` route components (see `app/router.tsx`), so the
 * 118-element dataset only ever ships in the chunk for someone who
 * actually opens the Periodic Table — visiting any other route never
 * downloads it. Adding element #119 later means dropping in one more
 * JSON file; nothing here needs to change.
 */
import type { ElementCategory, ElementProfile } from './types'

const elementModules = import.meta.glob<{ default: unknown }>('/src/content/periodic-table/elements/*.json', {
  eager: true
})

function isElementProfile(data: unknown): data is ElementProfile {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<ElementProfile>
  return (
    typeof d.id === 'string' &&
    !!d.id &&
    d.category === 'element' &&
    typeof d.atomicNumber === 'number' &&
    typeof d.symbol === 'string' &&
    typeof d.name === 'string'
  )
}

function loadElements(): ElementProfile[] {
  const items: ElementProfile[] = []
  for (const [path, mod] of Object.entries(elementModules)) {
    const data = mod.default
    if (!isElementProfile(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[periodic-table] Skipping malformed element content file: ${path}`)
      continue
    }
    items.push(data)
  }
  return items.sort((a, b) => a.atomicNumber - b.atomicNumber)
}

export const ALL_ELEMENTS: ElementProfile[] = loadElements()

const BY_ID = new Map(ALL_ELEMENTS.map((e) => [e.id, e]))
const BY_ATOMIC_NUMBER = new Map(ALL_ELEMENTS.map((e) => [e.atomicNumber, e]))
const BY_SYMBOL = new Map(ALL_ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]))

export function getElementById(id: string): ElementProfile | undefined {
  return BY_ID.get(id)
}

export function getElementByAtomicNumber(z: number): ElementProfile | undefined {
  return BY_ATOMIC_NUMBER.get(z)
}

export function getElementBySymbol(symbol: string): ElementProfile | undefined {
  return BY_SYMBOL.get(symbol.toLowerCase())
}

export function listByCategory(category: ElementCategory): ElementProfile[] {
  return ALL_ELEMENTS.filter((e) => e.elementCategory === category)
}

export function listByBlock(block: ElementProfile['block']): ElementProfile[] {
  return ALL_ELEMENTS.filter((e) => e.block === block)
}

export function listByPeriod(period: number): ElementProfile[] {
  return ALL_ELEMENTS.filter((e) => e.period === period)
}

/**
 * Search by name, symbol, atomic number, or category label — brief §9.
 * Deliberately simple substring/exact matching (no fuzzy/semantic
 * matching), consistent with Cellfie's existing deterministic,
 * no-AI concept-matching stance elsewhere in the app.
 */
export function searchElements(query: string): ElementProfile[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const asNumber = Number(q)
  if (Number.isInteger(asNumber) && String(asNumber) === q) {
    const hit = getElementByAtomicNumber(asNumber)
    return hit ? [hit] : []
  }
  return ALL_ELEMENTS.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.symbol.toLowerCase() === q ||
      e.elementCategory.replace(/-/g, ' ').includes(q) ||
      e.elementCategoryLabel.toLowerCase().includes(q)
  )
}

export function countByCategory(): Record<ElementCategory, number> {
  const counts = {} as Record<ElementCategory, number>
  for (const e of ALL_ELEMENTS) {
    counts[e.elementCategory] = (counts[e.elementCategory] ?? 0) + 1
  }
  return counts
}
