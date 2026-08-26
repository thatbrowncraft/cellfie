/**
 * core/comparison/unifiedSearch — Comparison Studio's single landing-page
 * search box (brief §3/§8-13/§32-33).
 *
 * This is deliberately a thin orchestration layer, not a new search
 * engine (brief §31 is explicit about that). It only combines two
 * pieces of search that already exist:
 *   - `searchCuratedComparisons` (registry.ts) — the existing curated
 *     comparison index.
 *   - `searchComparableEntities` (entitySearch.ts) — the existing
 *     Organism/Laboratory-backed entity picker, already dynamic-imported
 *     for bundle-size reasons.
 *
 * What's new here is purely the *query understanding*: recognizing that
 * "Gram positive bacteria vs Gram negative bacteria" is two entities
 * separated by a comparison word, even when no curated JSON exists for
 * that exact pair (the bug brief §8 reports) and even when punctuation/
 * hyphenation don't line up with the curated title text.
 *
 * "My Library" and "Online Knowledge" are deliberately NOT re-implemented
 * here — per brief §9/§19/§20/§34, those stay exactly where they already
 * live: per-aspect, inside the Comparison Workspace via
 * `ComparisonSourcesPanel` / `core/comparison/knowledgeLayer.ts`. Once a
 * search here resolves to a comparison (curated, entity-pair, or fully
 * custom), the workspace's existing source panel is how the user pulls
 * in Library/Online material — there is no separate global source
 * search box to keep in sync with that one.
 */
import { searchCuratedComparisons } from './registry'
import { searchComparableEntities, type EntitySearchHit } from './entitySearch'
import type { ComparisonSearchHit } from './types'

/** Splits on the common ways people phrase a comparison query. Order matters: longer/more specific separators are tried before bare "vs" so "compared to" doesn't get chewed up by a looser match. */
const SEPARATOR_PATTERN = /\s+(?:vs\.?|versus|compared\s+(?:to|with)|and)\s+/i

/** Naive two-way split of a comparison-flavored query into candidate item names. Returns undefined if the query doesn't look like an "X vs Y" phrase at all (a single term, or more than two parts). */
export function splitComparisonQuery(query: string): [string, string] | undefined {
  const parts = query
    .trim()
    .split(SEPARATOR_PATTERN)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length !== 2) return undefined
  return [parts[0], parts[1]]
}

export type UnifiedSearchResult =
  | { kind: 'curated'; hits: ComparisonSearchHit[] }
  | { kind: 'entity-pair'; itemA: EntitySearchHit; itemB: EntitySearchHit; query: string }
  | { kind: 'no-match'; query: string }
  | { kind: 'empty' }

/**
 * Resolves a landing-page search into one of the result states the UI
 * needs to render (brief §33's "search result states"):
 *  - `curated` — one or more existing curated comparisons match; open
 *    directly, same as before.
 *  - `entity-pair` — no curated comparison matches the query as typed,
 *    but both halves resolve to real Cellfie entities (an organism or
 *    Laboratory item each) — offer "Build comparison" (brief §8B/§12A/
 *    §12/§32).
 *  - `no-match` — nothing curated, and the query either isn't two-part
 *    or its halves don't resolve to known entities — offer "Create
 *    custom comparison" as the non-dead-end fallback (brief §12E/§33).
 *
 * Curated search always runs first and wins outright when it finds
 * anything — an exact/partial curated match is always the better
 * answer than a freshly-built one, matching the "the exact comparison
 * exists" flow being the first search-resolution branch in the brief.
 */
export async function resolveComparisonSearch(query: string): Promise<UnifiedSearchResult> {
  const q = query.trim()
  if (!q) return { kind: 'empty' }

  const curatedHits = searchCuratedComparisons(q)
  if (curatedHits.length > 0) return { kind: 'curated', hits: curatedHits }

  const halves = splitComparisonQuery(q)
  if (!halves) return { kind: 'no-match', query: q }

  const [rawA, rawB] = halves
  const [hitsA, hitsB] = await Promise.all([searchComparableEntities(rawA, 1), searchComparableEntities(rawB, 1)])
  const bestA = hitsA[0]
  const bestB = hitsB[0]
  if (bestA && bestB) return { kind: 'entity-pair', itemA: bestA, itemB: bestB, query: q }

  return { kind: 'no-match', query: q }
}
