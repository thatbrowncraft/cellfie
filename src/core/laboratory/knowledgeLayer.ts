/**
 * core/laboratory/knowledgeLayer — Laboratory 2.0 brief §16-21; Knowledge
 * Layer Repair brief §1/§30; second-pass audit §4/§9.
 *
 * Deliberately thin, mirroring `core/organisms/knowledgeLayer.ts`
 * exactly: every real retrieval primitive already exists elsewhere in
 * the app, so this module is just Laboratory-shaped wiring on top of it,
 * not a second retrieval stack (brief §29-30, "do not build a second
 * Library" / "do not build a second Online Knowledge engine").
 *
 *   - "My Library" mode reuses `lookupInAllLibrarySources` /
 *     `lookupInSpecificLibrarySource` from `core/organisms/librarySources`
 *     (which itself wraps `core/concepts/librarySearch` +
 *     `core/concepts/documentText`) — genuinely generic term search over
 *     the user's own imported books, nothing organism-specific about it.
 *   - "Online Knowledge" mode reuses the SHARED multi-source Knowledge
 *     Layer (`core/knowledge`, Europe PMC + NCBI Bookshelf + PubMed) for its
 *     general-reference excerpt, and `fetchMeshClassification` from
 *     `core/concepts/onlineKnowledge` for its supplementary NCBI MeSH
 *     scope note — the same MeSH lookup the Concept Hub and Organism
 *     Explorer already use. This module is shared by Comparison Studio
 *     (via `core/comparison/knowledgeLayer.ts`) and Laboratory — one
 *     retrieval path for both.
 *
 * Three-layer separation (brief §16-21) is enforced by construction:
 * a lookup only ever reads ONE mode per call — 'my-library' never falls
 * back to 'online' silently, and neither ever mixes into the curated
 * Cellfie JSON that the caller already has from the registry. The
 * caller (LaboratoryDetailPage) is responsible for labeling each layer
 * distinctly in the UI and for triggering lookups only on explicit user
 * action, never automatically on page load (same "no silent trusted-
 * source supplementation" rule the organism Knowledge Layer follows).
 *
 * HONEST SCOPE: a lab topic search term is usually a technique/media/
 * test/equipment/formula name (e.g. "Gram staining", "MacConkey Agar"),
 * not an organism binomial — the shared Knowledge Layer and
 * `fetchMeshClassification` are general-purpose term lookups, so they
 * work the same way here as they do for an organism name. No fabricated
 * excerpt, no invented URL, no source mislabeling: every returned field
 * traces to a real call into the existing modules above.
 */
import { db } from '../db'
import { fetchMeshClassification, isLikelyOnline, type MeshClassification } from '../concepts/onlineKnowledge'
import { contentAvailabilityLabel, resultDisplayText, searchKnowledgeEnrichment, type ContentAvailability, type KnowledgeQueryContext } from '../knowledge'
import { lookupInAllLibrarySources, lookupInSpecificLibrarySource, LibrarySearchTimeoutError } from '../organisms/librarySources'
import type { KnowledgeSourceMode, LibrarySourceExcerpt, OrganismSource as LabSource } from '../organisms/types'

export type { KnowledgeSourceMode, LibrarySourceExcerpt }
export type { LabSource }
export { contentAvailabilityLabel }

const KL_CACHE_PREFIX = 'labKnowledgeLayer:v1:'
const KL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — same horizon as onlineKnowledge.ts / organisms/knowledgeLayer.ts

/**
 * 'timed-out' (brief: "never allow infinite spinners") is distinct from
 * 'error' — it means the search may still genuinely find something, it
 * just didn't finish inside the time Cellfie is willing to make someone
 * wait; the UI offers "Try again" for it exactly like 'error', just
 * with honest wording.
 *
 * 'exhausted' is new (Knowledge Layer Repair brief §9/§24): the shared
 * multi-source pool for this query has genuinely run out of candidates
 * that weren't already shown/dismissed this session — distinct from
 * 'not-found' (which means nothing was ever found at all).
 */
export type LabKnowledgeLookupStatus = 'found' | 'not-found' | 'not-found-in-source' | 'offline' | 'error' | 'timed-out' | 'exhausted'

export interface LabKnowledgeLookupResult {
  status: LabKnowledgeLookupStatus
  searchedSourceName?: string
  /**
   * `id` is the actual fix for "Search Again returns the same result":
   * the caller (LabSourcesPanel/ComparisonSourcesPanel) collects the
   * `id`s of every result it has shown or dismissed this session and
   * passes them back as `excludeIds` on the next search, so the shared
   * pool advances to a genuinely different candidate/provider instead
   * of repeating the same one (see core/knowledge/index.ts).
   *
   * Second-pass fix (audit brief §9/§10): `isAbstract` is kept only for
   * source callers that predate `contentAvailability` and is now
   * strictly `contentAvailability === 'ABSTRACT'` — it is no longer true
   * for FULL_TEXT results too. Every UI panel in this codebase has been
   * updated to render `contentAvailabilityLabel(contentAvailability)`
   * instead of branching on `isAbstract`, so a full-text result reads
   * "Full text available from …", not "Abstract from …".
   */
  generalReference?: {
    id: string
    text: string
    sourceName: string
    sourceUrl: string
    isAbstract?: boolean
    contentAvailability?: ContentAvailability
    fullTextUrl?: string
    /** Compliance patch: NCBI attribution (PubMed/Bookshelf) or a conservative-reuse notice (Europe PMC abstract excerpt) — see `core/knowledge/attribution.ts`. `undefined` for bare metadata, which needs none. */
    attributionNotice?: string
  }
  meshScopeNote?: { text: string; sourceName: string; sourceUrl: string }
  libraryExcerpts?: LibrarySourceExcerpt[]
  sources: LabSource[]
  retrievedAt?: number
  /** How many candidates were found in total for this query — lets the UI say "3 of 3 sources shown" instead of a bare "no more results". */
  poolSize?: number
}

interface KLCacheEntry {
  fetchedAt: number
  result: LabKnowledgeLookupResult
}

/**
 * SECOND-PASS FIX (audit brief §4): this wrapper cache used to be keyed
 * only by `(labContentId, mode)` — it relied entirely on every caller
 * remembering to bake `aspect`/`comparedAgainst` into a unique
 * `labContentId` string themselves (which today's callers do, e.g.
 * Comparison Studio's per-aspect panel uses
 * `comparison:{id}:{aspectId}:{side}` as its id) to avoid one aspect's
 * cached result leaking into another's. That's fragile by construction:
 * a future caller that reuses the same `labContentId` across two
 * different aspects (exactly the "PCR / Principle" vs "PCR / Procedure"
 * scenario the audit calls out) would silently get served the wrong
 * cached result, even though the underlying multi-source pool cache
 * (`core/knowledge/index.ts`) is correctly scoped by the full query
 * context. This function now folds `aspect`/`comparedAgainst` into the
 * key directly — the wrapper's own cache identity can no longer diverge
 * from the actual query context regardless of what a caller passes as
 * `labContentId`.
 */
function cacheKeyFor(labContentId: string, mode: KnowledgeSourceMode, libraryItemId?: string, aspect?: string, comparedAgainst?: string): string {
  if (mode === 'trusted') {
    const context = `${(aspect ?? '').trim().toLowerCase()}|${(comparedAgainst ?? '').trim().toLowerCase()}`
    return `${KL_CACHE_PREFIX}${labContentId}:online:${context}`
  }
  if (mode === 'specific-source') return `${KL_CACHE_PREFIX}${labContentId}:specific:${libraryItemId ?? 'unknown'}`
  return `${KL_CACHE_PREFIX}${labContentId}:my-sources`
}

async function readCache(key: string): Promise<KLCacheEntry | undefined> {
  const record = await db.appSettings.get(key)
  return record?.value as KLCacheEntry | undefined
}

async function writeCache(key: string, result: LabKnowledgeLookupResult): Promise<void> {
  await db.appSettings.put({ key, value: { fetchedAt: Date.now(), result } as KLCacheEntry })
}

export interface LabKnowledgeLookupOptions {
  mode: KnowledgeSourceMode
  libraryItemId?: string
  forceRefresh?: boolean
  /** Aspect/facet being enriched (e.g. "principle", "key distinguishing feature") — folded into the online query for real contextual search instead of a bare topic keyword (brief §8). Ignored for library modes. */
  aspect?: string
  /** The other side of a comparison, when this lookup is for one side of an "A vs B" comparison — folded into the online query. Ignored for library modes. */
  comparedAgainst?: string
  /**
   * Result ids already shown/dismissed this session for the SAME
   * topic+aspect — excluded from the next candidate. This is what
   * makes "Search Again" genuinely different instead of looping.
   * Works for BOTH modes: for `mode: 'trusted'` these are online pool
   * ids (from a previous `generalReference.id`); for `'my-sources'`/
   * `'specific-source'` these are library excerpt ids (from a
   * previous `libraryExcerpts[].id`, each `${libraryItemId}:${page}`
   * — see `core/organisms/types.ts`'s `LibrarySourceExcerpt`).
   */
  excludeIds?: string[]
}

/**
 * Looks up a curated Laboratory topic (by its display title, e.g.
 * "Gram Staining") in either "My Library" or "Online Knowledge".
 * `labContentId` is only used to namespace the cache — never sent
 * anywhere, never mixed into the result.
 */
export async function lookupLabTopicKnowledge(
  title: string,
  labContentId: string,
  options: LabKnowledgeLookupOptions
): Promise<LabKnowledgeLookupResult> {
  const { mode, libraryItemId, forceRefresh, aspect, comparedAgainst, excludeIds } = options
  const cacheKey = cacheKeyFor(labContentId, mode, libraryItemId, aspect, comparedAgainst)

  // A "Search Again" call (excludeIds present) must never short-circuit
  // on the single-result cache below — that cache only ever remembers
  // the FIRST result shown for this topic, which is exactly the value
  // that needs to be excluded now, not replayed.
  const isSearchAgain = Boolean(excludeIds?.length)

  const cached = isSearchAgain ? undefined : await readCache(cacheKey)
  if (!isSearchAgain && !forceRefresh && cached && Date.now() - cached.fetchedAt < KL_CACHE_TTL_MS) {
    return cached.result
  }

  if (mode === 'my-sources' || mode === 'specific-source') {
    return lookupFromLibrary(title, mode, cacheKey, libraryItemId, excludeIds)
  }

  return lookupFromOnline(title, cacheKey, cached?.result, { aspect, comparedAgainst, excludeIds })
}

/**
 * SEARCH AGAIN FIX (My Library): `excludeIds` now flows through to
 * `lookupInAllLibrarySources`/`lookupInSpecificLibrarySource` — see
 * `core/organisms/librarySources.ts`. Same "isSearchAgain must never
 * short-circuit on, or write into, the single-result cache" rule
 * `lookupFromOnline` below already follows: a Search Again result is
 * intentionally ephemeral (session-scoped via `excludeIds`), never
 * something a later plain reopen of this topic gets served from
 * `writeCache`. Nothing about a genuinely FIRST library search
 * (`excludeIds` empty/absent) changes.
 */
async function lookupFromLibrary(
  title: string,
  mode: 'my-sources' | 'specific-source',
  cacheKey: string,
  libraryItemId?: string,
  excludeIds?: string[]
): Promise<LabKnowledgeLookupResult> {
  if (mode === 'specific-source' && !libraryItemId) return { status: 'not-found', sources: [] }

  const isSearchAgain = Boolean(excludeIds?.length)
  const excludeSet = new Set(excludeIds ?? [])

  let result: Awaited<ReturnType<typeof lookupInAllLibrarySources>>
  try {
    result =
      mode === 'specific-source'
        ? await lookupInSpecificLibrarySource(title, libraryItemId as string, excludeSet)
        : await lookupInAllLibrarySources(title, excludeSet)
  } catch (err) {
    if (err instanceof LibrarySearchTimeoutError) return { status: 'timed-out', sources: [] }
    return { status: 'error', sources: [] }
  }

  if (result.excerpts.length === 0) {
    if (isSearchAgain && result.matchedBooks.length > 0) {
      // Search Again ran out of unseen excerpts across every matched
      // book — an honest "no more" state, distinct from 'not-found-in-
      // source' (which means this topic isn't covered here AT ALL).
      return { status: 'exhausted', sources: [] }
    }
    // Not the same as 'not-found' — this specific source (or the whole
    // library) simply doesn't cover the topic; Online Knowledge remains
    // a separate, explicit option, never an automatic fallback.
    const searchedSourceName = mode === 'specific-source' ? result.matchedBooks[0]?.title : undefined
    return { status: 'not-found-in-source', searchedSourceName, sources: [] }
  }

  const lookupResult: LabKnowledgeLookupResult = {
    status: 'found',
    libraryExcerpts: result.excerpts,
    sources: result.sources,
    retrievedAt: Date.now()
  }
  // Same rule as lookupFromOnline: only the very first (non-excludeIds)
  // lookup for this topic is cached as "the" result.
  if (!isSearchAgain) await writeCache(cacheKey, lookupResult)
  return lookupResult
}

interface OnlineLookupContext {
  aspect?: string
  comparedAgainst?: string
  excludeIds?: string[]
}

async function lookupFromOnline(
  title: string,
  cacheKey: string,
  staleResult: LabKnowledgeLookupResult | undefined,
  context: OnlineLookupContext
): Promise<LabKnowledgeLookupResult> {
  if (!isLikelyOnline()) {
    // Stale-beats-nothing offline fallback, same rule as onlineKnowledge.ts
    // and organisms/knowledgeLayer.ts -- but only ever the same layer's own
    // stale cache, never quietly substituting a different mode's result.
    return staleResult ?? { status: 'offline', sources: [] }
  }

  const isSearchAgain = Boolean(context.excludeIds?.length)
  const queryContext: KnowledgeQueryContext = { subject: title, aspect: context.aspect, comparedAgainst: context.comparedAgainst }

  let mesh: MeshClassification | undefined
  let enrichment: Awaited<ReturnType<typeof searchKnowledgeEnrichment>>
  try {
    const results = await Promise.all([
      // MeSH classification is stable reference data, not a "result" a
      // person dismisses in a loop -- no need to re-fetch it on Search
      // Again, but it's cheap/cached and harmless to include either way.
      fetchMeshClassification(title),
      searchKnowledgeEnrichment(queryContext, { excludeIds: context.excludeIds })
    ])
    mesh = results[0]
    enrichment = results[1]
  } catch {
    // Neither call is documented to throw, but this is a last-resort
    // safety net so a genuinely unexpected error still degrades cleanly.
    return { status: 'error', sources: [] }
  }

  if (enrichment.status === 'offline') return staleResult ?? { status: 'offline', sources: [] }

  if (enrichment.status === 'exhausted') {
    // Multi-source pool ran out of candidates that weren't already
    // shown/dismissed -- an honest "no more distinct results" state
    // (brief SS9/SS24), never a repeat of something already dismissed.
    return { status: 'exhausted', sources: [], poolSize: enrichment.poolSize }
  }

  if (!mesh && enrichment.status !== 'found') {
    const emptyResult: LabKnowledgeLookupResult = { status: 'not-found', sources: [] }
    if (!isSearchAgain) await writeCache(cacheKey, emptyResult)
    return emptyResult
  }

  const online = enrichment.result
  const sources: LabSource[] = []
  if (online) sources.push({ name: online.sourceLabel, kind: 'scientific', url: online.externalUrl })
  if (mesh) sources.push({ name: mesh.sourceName, kind: 'scientific', url: mesh.sourceUrl })

  const lookupResult: LabKnowledgeLookupResult = {
    status: 'found',
    generalReference: online
      ? {
          id: online.id,
          // ROOT-CAUSE FIX (Replace Crossref brief §11): used to fall back to
          // `online.title` when there was no abstract — silently presenting a
          // bare title as if it were the enrichment excerpt. `resultDisplayText`
          // is the one shared, honest fallback (see `core/knowledge/labels.ts`).
          text: resultDisplayText(online),
          sourceName: online.sourceLabel,
          sourceUrl: online.externalUrl,
          isAbstract: online.contentAvailability === 'ABSTRACT',
          contentAvailability: online.contentAvailability,
          fullTextUrl: online.fullTextUrl,
          attributionNotice: online.attributionNotice
        }
      : undefined,
    meshScopeNote: mesh?.scopeNote ? { text: mesh.scopeNote, sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl } : undefined,
    sources,
    retrievedAt: Date.now(),
    poolSize: enrichment.poolSize
  }
  // Only the very first (non-excludeIds) lookup for this topic is
  // cached as "the" result -- a Search Again result is intentionally
  // ephemeral (session-scoped via excludeIds), not something a later
  // plain re-open of this topic should be served automatically.
  if (!isSearchAgain) await writeCache(cacheKey, lookupResult)
  return lookupResult
}
