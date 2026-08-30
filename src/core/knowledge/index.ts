/**
 * core/knowledge — the ONE shared Online Sources retrieval service for
 * Comparison Studio, Laboratory, and Organism Explorer (Knowledge Layer
 * Repair brief §1/§30; second-pass audit §3/§6/§7). Every module calls
 * `searchKnowledgeEnrichment`; none of them talk to Europe PMC/NCBI
 * Bookshelf/PubMed directly. `core/concepts/onlineKnowledge.ts` (the Concept Hub's
 * own, separately-scoped Knowledge Layer) is untouched by this module —
 * see that file's own callers for why it needs to stay exactly as it is.
 *
 * ROOT-CAUSE FIX (first pass) — why "Search Again" kept returning the
 * same Europe PMC result: the old per-module lookups called a
 * single-result summary function with the exact same query every time.
 * "Search Again" only ever bypassed the app's own 7-day cache — it never
 * changed the query or excluded what was already shown, and the
 * provider itself is deterministic for an identical query, so bypassing
 * the cache just re-fetched and re-ranked the exact same top hit.
 *
 * SECOND-PASS FIX — "different" is not the same as "useful": the first
 * pass fixed repetition by walking a cached, deduped, ranked candidate
 * pool via `excludeIds`, but never checked whether the next unshown
 * candidate was actually relevant to the query — a metadata-only record
 * that merely happened to rank last could still get shown as if it were
 * a real Search Again result. This pass adds:
 *
 *   1. `isUsefulCandidate` (core/knowledge/rank.ts) — a candidate must
 *      have genuine SUBJECT term overlap with the query (title/abstract
 *      substring match), not merely be unshown, before it's returned
 *      (§6; refined in the third-pass audit so `aspect`/`comparedAgainst`
 *      are ranking-only signals, not part of this hard gate — see that
 *      file's docstring for why a literal aspect-wording requirement was
 *      wrong for real scientific literature).
 *   2. A BOUNDED fallback: when the pool has no useful unshown candidate
 *      left, exactly ONE broader query variant is tried (dropping the
 *      most specific part of the query — `aspect`, then
 *      `comparedAgainst`) before declaring the search genuinely
 *      exhausted (§7). This is a hard ceiling, not a retry loop — see
 *      `MAX_FALLBACK_VARIANTS`.
 *
 * PROVIDER SWAP ("Replace Crossref" brief) — Crossref has been removed
 * from `queryAdapters` below and its adapter file deleted outright, not
 * demoted or kept as a hidden fallback. It was a scholarly-metadata
 * registry first, which meant it often contributed only a bare paper
 * title with no explanatory content — exactly the "enrichment that
 * isn't actually enrichment" bug that brief describes. Its replacement,
 * `adapters/ncbiBookshelf.ts` (NCBI Bookshelf via the same key-free
 * E-utilities interface `adapters/pubmed.ts` already uses), indexes
 * biomedical/life-science textbooks and reference works instead of
 * individual papers — see that adapter's own docstring for the full
 * reasoning, including why it deliberately never fetches chapter body
 * text. Nothing else in this file changed to accommodate the swap:
 * `NormalizedKnowledgeResult` already made every provider interchangeable
 * from this module's point of view.
 *
 * FINANCIAL/CREDENTIAL SAFETY (brief §16/§17/§18): every adapter this
 * module calls is a plain `fetch()` against a public, key-free,
 * unauthenticated endpoint. There is no API key anywhere in this module
 * or its adapters, no billing code, no account, and therefore no path by
 * which a user's search could ever create a bill for the repository
 * owner or for a fork's owner. The bounded fallback above adds at most
 * one extra round of adapter calls per truly-exhausted search — never an
 * unbounded retry loop — so this guarantee isn't weakened by it.
 */
import { db } from '../db'
import { isLikelyOnline } from '../concepts/onlineKnowledge'
import { searchEuropePmc } from './adapters/europepmc'
import { searchBookshelf } from './adapters/ncbiBookshelf'
import { searchPubmed } from './adapters/pubmed'
import { dedupeResults } from './dedupe'
import { cacheKeyForContext } from './query'
import { isUsefulCandidate, rankResults } from './rank'
import { resultDisplayText } from './labels'
import type { KnowledgeQueryContext, KnowledgeSearchOptions, KnowledgeSearchResult, NormalizedKnowledgeResult } from './types'

export type { ContentAvailability, KnowledgeQueryContext, KnowledgeSearchOptions, KnowledgeSearchResult, KnowledgeSourceId, NormalizedKnowledgeResult } from './types'
export { contentAvailabilityLabel, resultDisplayText } from './labels'

const POOL_CACHE_PREFIX = 'knowledgeLayerPool:v1:'
const POOL_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — same horizon the rest of Cellfie's Knowledge Layer caches use

/** Hard ceiling on the bounded fallback strategy (brief §7: "no infinite querying, no retry storms"). Exactly one broader variant is tried, never more, no matter how many times Search Again is pressed. */
const MAX_FALLBACK_VARIANTS = 1

interface PoolCacheEntry {
  cachedAt: number
  pool: NormalizedKnowledgeResult[]
  /** Tracks whether the bounded fallback variant has already been tried and folded into this cached pool, so re-reading a fresh cache never re-triggers it. */
  fallbackAttempted: boolean
}

async function readPoolCache(key: string): Promise<PoolCacheEntry | undefined> {
  const record = await db.appSettings.get(key)
  return record?.value as PoolCacheEntry | undefined
}

async function writePoolCache(key: string, pool: NormalizedKnowledgeResult[], fallbackAttempted: boolean): Promise<void> {
  await db.appSettings.put({ key, value: { cachedAt: Date.now(), pool, fallbackAttempted } as PoolCacheEntry })
}

async function queryAdapters(context: KnowledgeQueryContext, limit: number): Promise<NormalizedKnowledgeResult[]> {
  const settled = await Promise.allSettled([
    searchEuropePmc(context, limit),
    searchBookshelf(context, limit),
    searchPubmed(context, limit)
  ])
  return settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
}

/**
 * Broader query variants tried in order, each dropping the most specific
 * part of the context first (brief §7's "contextual query variant").
 * Only ever consulted up to `MAX_FALLBACK_VARIANTS` times per pool.
 */
function buildFallbackVariant(context: KnowledgeQueryContext): KnowledgeQueryContext | undefined {
  if (context.aspect) return { subject: context.subject, comparedAgainst: context.comparedAgainst }
  if (context.comparedAgainst) return { subject: context.subject }
  return undefined
}

function pickUseful(pool: NormalizedKnowledgeResult[], excludeIds: Set<string>, context: KnowledgeQueryContext): NormalizedKnowledgeResult | undefined {
  return pool.find((r) => !excludeIds.has(r.id) && isUsefulCandidate(r, context))
}

/**
 * Fetches (or reuses a cached) deduped, ranked candidate pool for a
 * query, then returns the best USEFUL candidate not already in
 * `excludeIds` — see module docstring for the second-pass "useful, not
 * merely different" and bounded-fallback fixes. Never throws — every
 * adapter already swallows its own errors, and this function's own
 * cache I/O is the only other failure surface.
 */
export async function searchKnowledgeEnrichment(
  context: KnowledgeQueryContext,
  options: KnowledgeSearchOptions = {}
): Promise<KnowledgeSearchResult> {
  if (!context.subject.trim()) return { status: 'not-found' }

  const cacheKey = `${POOL_CACHE_PREFIX}${cacheKeyForContext(context)}`
  const excludeIds = new Set(options.excludeIds ?? [])
  const limit = options.poolSize ?? 10

  const cached = await readPoolCache(cacheKey)
  const cacheIsFresh = Boolean(cached && Date.now() - cached.cachedAt < POOL_TTL_MS)

  let pool: NormalizedKnowledgeResult[] | undefined
  let fallbackAttempted = false

  if (cacheIsFresh && !options.forceRefreshPool) {
    pool = cached!.pool
    fallbackAttempted = cached!.fallbackAttempted
  } else if (!isLikelyOnline()) {
    // Offline: stale pool beats nothing, but never claim a fresh fetch happened.
    if (cached?.pool?.length) {
      pool = cached.pool
      fallbackAttempted = cached.fallbackAttempted
    } else {
      return { status: 'offline' }
    }
  } else {
    const raw = await queryAdapters(context, limit)
    pool = rankResults(dedupeResults(raw), context).slice(0, 20)
    await writePoolCache(cacheKey, pool, false)
  }

  if (!pool || pool.length === 0) return { status: 'not-found', poolSize: 0 }

  const primaryCandidate = pickUseful(pool, excludeIds, context)
  if (primaryCandidate) return { status: 'found', result: primaryCandidate, poolSize: pool.length }

  // Nothing useful and unshown left in the primary pool. Per brief §7,
  // this is exactly where a BOUNDED fallback belongs — not before (that
  // would waste a request when the primary pool was already enough) and
  // not repeated (MAX_FALLBACK_VARIANTS caps it at one attempt total per
  // cached pool, regardless of how many more times Search Again is
  // pressed after that).
  if (fallbackAttempted || MAX_FALLBACK_VARIANTS < 1 || !isLikelyOnline()) {
    return { status: 'exhausted', poolSize: pool.length }
  }

  const variantContext = buildFallbackVariant(context)
  if (!variantContext) {
    // No broader variant exists (already a bare subject query) — mark
    // the fallback as "attempted" so this dead end isn't re-checked on
    // every subsequent Search Again for the same context.
    await writePoolCache(cacheKey, pool, true)
    return { status: 'exhausted', poolSize: pool.length }
  }

  const variantRaw = await queryAdapters(variantContext, limit)
  // Ranking still uses the FULL original `context` (including `aspect`) —
  // brief §2: "preserve the original aspect as a ranking preference
  // where useful". A merged candidate that happens to match the dropped
  // aspect wording still sorts higher than one that doesn't.
  const mergedPool = rankResults(dedupeResults([...pool, ...variantRaw]), context).slice(0, 30)
  await writePoolCache(cacheKey, mergedPool, true)

  // THIRD-PASS FIX (brief §2): usefulness is gated against `variantContext`
  // — the narrower context actually used to fetch this fallback round —
  // not the original `context`. With `isUsefulCandidate` now checking
  // only `subject` (see core/knowledge/rank.ts), `variantContext` and
  // `context` agree on the one thing that matters for the gate (`subject`
  // is never dropped by `buildFallbackVariant`), so this mainly documents
  // the correct invariant rather than changing today's outcome — but it
  // keeps this call site correct-by-construction if the gate is ever
  // extended to also consider `comparedAgainst`, instead of silently
  // reintroducing "rejected only because the dropped part is absent".
  const fallbackCandidate = pickUseful(mergedPool, excludeIds, variantContext)
  if (!fallbackCandidate) return { status: 'exhausted', poolSize: mergedPool.length }
  return { status: 'found', result: fallbackCandidate, poolSize: mergedPool.length }
}

/**
 * Compatibility helper for callers that only want a single best summary
 * shaped like `core/concepts/onlineKnowledge.ts`'s `OnlineSummary`
 * (currently `core/organisms/knowledgeLayer.ts`) — lets Organism
 * Explorer's one-shot profile lookup draw from the same multi-source
 * pool (Europe PMC + NCBI Bookshelf + PubMed) as Comparison Studio and
 * Laboratory without changing its own result shape or UI.
 *
 * Second-pass fix (brief §9): `isAbstract` is now strictly
 * `contentAvailability === 'ABSTRACT'` — a FULL_TEXT result is no longer
 * folded into the same flag an ABSTRACT result gets. Since this
 * compatibility shape only has room for one boolean, a FULL_TEXT result
 * is represented as `isAbstract: false` here (i.e. "not merely an
 * abstract") — `core/organisms/knowledgeLayer.ts`'s own `OnlineSummary`
 * type doesn't have a third state to put it in, which is a known,
 * documented limitation of this compatibility path (see that file).
 *
 * ROOT-CAUSE FIX (Replace Crossref brief §11): `extract` used to fall
 * back to `r.title` when a candidate had no abstract (e.g. every NCBI
 * Bookshelf/PubMed METADATA_ONLY result) — silently presenting a bare
 * title as if it were the enrichment excerpt. Now uses
 * `resultDisplayText`, the one shared, honest fallback (see
 * `./labels.ts`) — a plain "no excerpt available" notice, never a
 * relabeled title.
 */
export async function fetchBestKnowledgeSummary(
  subject: string
): Promise<{ title: string; extract: string; sourceName: string; sourceUrl: string; isAbstract: boolean; attributionNotice?: string } | undefined> {
  const search = await searchKnowledgeEnrichment({ subject })
  if (search.status !== 'found' || !search.result) return undefined
  const r = search.result
  return {
    title: r.title,
    extract: resultDisplayText(r),
    sourceName: r.sourceLabel,
    sourceUrl: r.externalUrl,
    isAbstract: r.contentAvailability === 'ABSTRACT',
    // Compliance patch: carried through so Organism Explorer's compatibility
    // shape (core/organisms/knowledgeLayer.ts) can surface the same NCBI
    // attribution / conservative-reuse notice the shared pool already
    // attaches — see core/knowledge/attribution.ts.
    attributionNotice: r.attributionNotice
  }
}
