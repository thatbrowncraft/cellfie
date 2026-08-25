/**
 * core/comparison/registry — Comparison Studio, Tier 1 Foundation.
 *
 * Same loading strategy as `core/laboratory/registry.ts` and
 * `core/organisms/registry.ts`: Vite's `import.meta.glob` eagerly
 * discovers every `*.json` file under `src/content/comparisons/` at
 * build time. Adding a new curated comparison later means dropping a
 * new JSON file into that folder — nothing here needs to change (brief
 * §23: "do not hard-code these into the UI").
 *
 * This module lives entirely inside the Comparison Studio lazy
 * boundary — nothing outside `modules/comparison-studio` or this
 * `core/comparison` folder imports it statically (brief §25/§26). The
 * one exception is `core/search/index.ts`, which reaches it only via a
 * dynamic `import()`, exactly like it already does for
 * `core/laboratory/registry.ts`.
 */
import type { Comparison, ComparisonDomain, ComparisonSearchHit } from './types'

function loadComparisons(glob: Record<string, { default: unknown }>): Comparison[] {
  const items: Comparison[] = []
  for (const [path, mod] of Object.entries(glob)) {
    const data = mod.default as Partial<Comparison> | undefined
    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.id !== 'string' ||
      !data.id ||
      !data.itemA?.name ||
      !data.itemB?.name ||
      !Array.isArray(data.aspects)
    ) {
      // eslint-disable-next-line no-console
      console.warn(`[comparison] Skipping malformed comparison content file: ${path}`)
      continue
    }
    items.push(data as Comparison)
  }
  return items.sort((a, b) => `${a.itemA.name} vs ${a.itemB.name}`.localeCompare(`${b.itemA.name} vs ${b.itemB.name}`))
}

const comparisonModules = import.meta.glob<{ default: unknown }>('/src/content/comparisons/*.json', { eager: true })

export const ALL_CURATED_COMPARISONS: Comparison[] = loadComparisons(comparisonModules)

const COMPARISON_BY_ID = new Map(ALL_CURATED_COMPARISONS.map((c) => [c.id, c]))

export function getCuratedComparisonById(id: string): Comparison | undefined {
  return COMPARISON_BY_ID.get(id)
}

export function listCuratedComparisons(): Comparison[] {
  return ALL_CURATED_COMPARISONS
}

export function countCuratedComparisons(): number {
  return ALL_CURATED_COMPARISONS.length
}

export function listDomainsInUse(): ComparisonDomain[] {
  const domains = new Set<ComparisonDomain>()
  for (const c of ALL_CURATED_COMPARISONS) domains.add(c.domain)
  return Array.from(domains)
}

// ---------------------------------------------------------------------------
// Search — local, substring, case-insensitive, multi-field (mirrors
// core/laboratory/registry.ts's approach exactly).
// ---------------------------------------------------------------------------

function buildHaystack(item: Comparison): string {
  const parts: (string | undefined)[] = [
    item.itemA.name,
    item.itemA.subtitle,
    item.itemB.name,
    item.itemB.subtitle,
    item.domain,
    item.difficulty,
    item.frequency,
    ...item.tags,
    ...item.aspects.map((a) => a.label)
  ]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const HAYSTACK_BY_ID = new Map(ALL_CURATED_COMPARISONS.map((c) => [c.id, buildHaystack(c)]))

function titleFor(item: Comparison): string {
  return `${item.itemA.name} vs ${item.itemB.name}`
}

export function searchCuratedComparisons(query: string): ComparisonSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_CURATED_COMPARISONS.filter((c) => (HAYSTACK_BY_ID.get(c.id) ?? buildHaystack(c)).includes(q)).map((c) => ({
    id: c.id,
    domain: c.domain,
    title: titleFor(c),
    subtitle: [c.itemA.subtitle, c.itemB.subtitle].filter(Boolean).join(' · ') || undefined,
    difficulty: c.difficulty,
    frequency: c.frequency
  }))
}

/**
 * Finds curated comparisons that already involve a given entity (by its
 * organism/Laboratory content id) — powers inline "Compare with…"
 * suggestions (brief §17) with real cross-links rather than an arbitrary
 * generated list.
 */
export function findComparisonsInvolving(refId: string): Comparison[] {
  return ALL_CURATED_COMPARISONS.filter((c) => c.itemA.refId === refId || c.itemB.refId === refId)
}
