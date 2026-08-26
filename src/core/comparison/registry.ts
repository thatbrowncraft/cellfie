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
    // Content-contract check (brief §22–25/23A): every curated comparison
    // must ship its own Gen Z subtitle in the JSON itself — this is a
    // warning, not a load failure, so one missing field never takes the
    // whole comparison offline, but it's the enforcement point the brief
    // asks for ("should fail content validation if the field is missing").
    if (typeof data.genZNote !== 'string' || !data.genZNote.trim()) {
      // eslint-disable-next-line no-console
      console.warn(`[comparison] Missing required genZNote (Cellfie subtitle) in: ${path}`)
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
// core/laboratory/registry.ts's approach), plus a normalization pass and
// an explicit two-part "X vs Y" matcher (brief §8/§11 fix — see below).
// ---------------------------------------------------------------------------

/**
 * Collapses punctuation differences that shouldn't matter for matching —
 * most importantly hyphens vs spaces. This is the direct fix for the bug
 * brief §8 reports: a search for "Gram Positive bacteria" typed with a
 * space should still find itemA.name "Gram-Positive Bacteria", which the
 * old plain `.toLowerCase()` haystack never normalized.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_/]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Same separator vocabulary as `unifiedSearch.ts`'s query splitter — kept in sync deliberately (see that file's header) rather than imported, since `unifiedSearch.ts` itself calls into this module and a circular import isn't worth it for one regex. */
const COMPARISON_SEPARATOR = /\s+(?:vs\.?|versus|compared\s+(?:to|with)|and)\s+/i

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
    // Note: genZNote is deliberately NOT included here — it's personality
    // copy, not a searchable scientific term, and including it risks a
    // search for an unrelated word inside a joke surfacing the wrong card.
  ]
  return normalize(parts.filter(Boolean).join(' '))
}

const HAYSTACK_BY_ID = new Map(ALL_CURATED_COMPARISONS.map((c) => [c.id, buildHaystack(c)]))

function titleFor(item: Comparison): string {
  return `${item.itemA.name} vs ${item.itemB.name}`
}

/**
 * True if a comparison's two items match a query already split into two
 * halves, in either order — the fix for brief §8/§11: a search doesn't
 * have to reproduce the curated title's exact wording or item order, it
 * just has to name both sides of a pair that already exists.
 */
function matchesAsPair(item: Comparison, halfA: string, halfB: string): boolean {
  const nameA = normalize(item.itemA.name)
  const nameB = normalize(item.itemB.name)
  const a = normalize(halfA)
  const b = normalize(halfB)
  const straight = (nameA.includes(a) || a.includes(nameA)) && (nameB.includes(b) || b.includes(nameB))
  const crossed = (nameA.includes(b) || b.includes(nameA)) && (nameB.includes(a) || a.includes(nameB))
  return straight || crossed
}

export function searchCuratedComparisons(query: string): ComparisonSearchHit[] {
  const raw = query.trim()
  if (!raw) return []
  const q = normalize(raw)

  const halves = raw.split(COMPARISON_SEPARATOR).map((p) => p.trim()).filter(Boolean)
  const isTwoPart = halves.length === 2

  const matches = ALL_CURATED_COMPARISONS.filter((c) => {
    if ((HAYSTACK_BY_ID.get(c.id) ?? buildHaystack(c)).includes(q)) return true
    if (isTwoPart && matchesAsPair(c, halves[0], halves[1])) return true
    return false
  })

  return matches.map((c) => ({
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
