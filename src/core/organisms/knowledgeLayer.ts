/**
 * core/organisms/knowledgeLayer — Knowledge Layer Integration brief,
 * §1-§9, §16-§22, §38, §42.
 *
 * This module is deliberately thin: ALL real retrieval — the source
 * hierarchy, the CORS/offline handling, the caching primitives, the
 * "never invent, never throw" discipline — already lives in
 * core/concepts/onlineKnowledge.ts, built for the Concept Hub's own
 * Knowledge Layer. Per the brief's own §45 ("reuse existing
 * architecture... do not add a new API client if an existing source
 * abstraction already exists, do not duplicate retrieval logic"), this
 * module calls straight into that one instead of standing up a second,
 * organism-specific retrieval stack:
 *
 *   fetchOnlineSummary()      → PubMed (biomedical names) or a
 *                                Wikipedia-filtered general-reference
 *                                tier — a direct excerpt + real source.
 *   fetchMeshClassification() → NCBI MeSH's own scope note for the
 *                                term, when one exists — the closest
 *                                thing to an authoritative one-
 *                                paragraph classification this app can
 *                                retrieve without AI-based extraction.
 *   fetchVisualReferences()   → Open-i (NLM) — real, attributed figures
 *                                from real published biomedical
 *                                literature (§28's "trusted external
 *                                image" tier).
 *
 * HONEST SCOPE (§7/§38): none of the above can reliably tell you a
 * specific organism's Gram reaction, shape, or a biochemical test
 * result — that would require actual language understanding of
 * unstructured prose, which this no-AI architecture doesn't have and
 * shouldn't fake. A Knowledge Layer profile therefore always has an
 * empty/mostly-empty `morphology`, `labIdentification`,
 * `identificationClues`, and `examFacts` — that's the correct, honest
 * result of "omit rather than guess", not a bug to work around. What it
 * DOES reliably carry: the scientific name, a best-effort genus/species
 * split, a best-effort category guess, a general-reference excerpt, a
 * MeSH scope note where one exists, a trusted external image where one
 * exists, and full source attribution for everything above.
 *
 * CACHING (§22): reuses the exact same db.appSettings key/value cache
 * mechanism onlineKnowledge.ts's own tiers already use — no second
 * cache layer, same store, same TTL horizon, same "stale beats nothing
 * when offline" fallback rule.
 */
import { db } from '../db'
import {
  fetchMeshClassification,
  fetchOnlineSummary,
  fetchVisualReferences,
  isLikelyOnline,
  type MeshClassification,
  type OnlineSummary,
  type VisualReference
} from '../concepts/onlineKnowledge'
import { canonicalOrganismId } from './canonicalId'
import { resolveTaxonomicRank, isGenusOnlyResolutionForSpeciesQuery } from './taxonomyResolution'
import { buildReferenceLinks } from './referenceLinks'
import { lookupInAllLibrarySources, lookupInSpecificLibrarySource, LibrarySearchTimeoutError } from './librarySources'
import type { KnowledgeSourceMode, OrganismCategory, OrganismProfile, OrganismSource } from './types'

const KL_CACHE_PREFIX = 'organismKnowledgeLayer:v1:'
const KL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — same horizon as onlineKnowledge.ts

interface KLCacheEntry {
  fetchedAt: number
  profile: OrganismProfile | null
}

/**
 * §Phase 4-6 — the cache key is namespaced by source mode (and, for
 * 'specific-source', by which book) so a "My Sources" result for
 * "Lactobacillus acidophilus" can never be served back as if it were a
 * "Trusted Scientific Sources" result or vice versa. Trusted-mode keeps
 * the original unsuffixed key so every profile cached before this
 * change (and `getCachedKnowledgeLayerProfile`'s existing callers, which
 * only ever check the trusted/default case) keeps working unchanged.
 */
function cacheKeyFor(id: string, mode: KnowledgeSourceMode, libraryItemId?: string): string {
  if (mode === 'trusted') return `${KL_CACHE_PREFIX}${id}`
  if (mode === 'specific-source') return `${KL_CACHE_PREFIX}${id}:specific:${libraryItemId ?? 'unknown'}`
  return `${KL_CACHE_PREFIX}${id}:my-sources`
}

// ---------------------------------------------------------------------
// §18 — search intent: organism name vs. filter/category concept
// ---------------------------------------------------------------------

/**
 * Phrases that describe a *filter concept*, not a specific organism —
 * e.g. "Gram positive bacteria" or "acid-fast" must never turn into a
 * fabricated organism profile just because they contain capitalized-
 * looking words. Not a real taxonomy check (this app has no taxonomy
 * database) — just enough to keep the two cases honestly separate.
 */
const FILTER_CONCEPT_PATTERNS: RegExp[] = [
  /\bgram[\s-]?(positive|negative|variable)\b/i,
  /\bacid[\s-]?fast\b/i,
  /\bcocc(us|i|obacill\w*)\b/i,
  /\bbacill(us|i)\b/i,
  /\b(obligate|facultative)?\s?(aerobe|anaerobe|microaerophile)\b/i,
  /\bspore[\s-]?form\w*\b/i,
  /\bnon-?motile\b/i,
  /\bencapsulated\b/i,
  /\b(yeast|mold|mould|dimorphic)\b/i,
  /\b(flagellate|ciliate|amoeba|apicomplexan)s?\b/i,
  /\benveloped\b/i,
  /\bss[rd]na|ds[rd]na\b/i,
  /\bbacteria\b/i,
  /\bfungi\b/i,
  /\bviruses\b/i
]

/**
 * A cheap, deterministic gate for whether a search string looks like it
 * could be an organism name (a handful of words, no obvious filter
 * vocabulary) rather than a microbiology concept/filter phrase (§18).
 */
export function looksLikeOrganismQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (FILTER_CONCEPT_PATTERNS.some((re) => re.test(trimmed))) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  return words.length > 0 && words.length <= 4
}

// ---------------------------------------------------------------------
// Best-effort normalization helpers — deterministic, never AI-guessed
// ---------------------------------------------------------------------

/** Very small, deliberately conservative keyword guess at the organism's category from whatever text was actually retrieved (§6). Falls back to 'other' rather than picking a wrong specific category. */
function guessCategory(text: string): OrganismCategory {
  const lower = text.toLowerCase()
  if (/\bvirus(es)?\b|\bviral\b|\bvirion\b/.test(lower)) return 'virus'
  if (/\bfung(us|i|al)\b|\byeast\b|\bmo[u]?ld\b/.test(lower)) return 'fungi'
  if (/\bprotozo\w*\b|\bparasit\w*\b|\bamoeb\w*\b|\bflagellate\w*\b/.test(lower)) return 'protozoa'
  if (/\bbacteri\w*\b|\bbacillus\b|\bcoccus\b|\bgram[\s-]?(positive|negative)\b/.test(lower)) return 'bacteria'
  return 'other'
}

/** If the query looks like a binomial ("Genus species"), split it the same way the curated library formats it (e.g. "Escherichia coli" → genus "Escherichia", species "E. coli"). Returns an empty object for anything else — never a guess dressed up as a fact. */
function splitBinomial(name: string): { genus?: string; species?: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z-]+$/.test(parts[1])) {
    return { genus: parts[0], species: `${parts[0][0]}. ${parts[1]}` }
  }
  return {}
}

// ---------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------

async function readKLCache(cacheKey: string): Promise<KLCacheEntry | undefined> {
  const record = await db.appSettings.get(cacheKey)
  return record?.value as KLCacheEntry | undefined
}

async function writeKLCache(cacheKey: string, profile: OrganismProfile | null): Promise<void> {
  await db.appSettings.put({ key: cacheKey, value: { fetchedAt: Date.now(), profile } as KLCacheEntry })
}

/** Reads a previously-retrieved Knowledge Layer profile straight from cache, no network — used by OrganismDetailPage so reopening/back-navigating to one doesn't re-trigger retrieval (§22). Always checks the trusted-mode (default) cache slot — the one every direct-navigation/save flow actually cares about. Returns undefined for anything never looked up, cached-as-empty, or expired. */
export async function getCachedKnowledgeLayerProfile(id: string): Promise<OrganismProfile | undefined> {
  const entry = await readKLCache(cacheKeyFor(id, 'trusted'))
  if (!entry || !entry.profile) return undefined
  if (Date.now() - entry.fetchedAt >= KL_CACHE_TTL_MS) return undefined
  return entry.profile
}

// ---------------------------------------------------------------------
// The lookup itself
// ---------------------------------------------------------------------

/** 'timed-out' is distinct from 'error' — the search may still find something, it just didn't finish inside the time Cellfie is willing to make someone wait (brief: "never allow infinite spinners"). */
export type KnowledgeLayerLookupStatus = 'found' | 'not-found' | 'not-found-in-source' | 'offline' | 'error' | 'timed-out'

export interface KnowledgeLayerLookupResult {
  status: KnowledgeLayerLookupStatus
  profile?: OrganismProfile
  /** Only set when status === 'not-found-in-source' — which book came up empty, for the "couldn't find enough information in [book]" message (§Phase 6). */
  searchedSourceName?: string
}

export interface KnowledgeLayerLookupOptions {
  /** Defaults to 'trusted' — every entry point (search-as-you-type suggestions, direct navigation, etc.) that doesn't explicitly pass a mode gets the exact same "never touches the user's books" behavior as before this change (§Phase 4). */
  mode?: KnowledgeSourceMode
  /** Required when mode === 'specific-source'; ignored otherwise. */
  libraryItemId?: string
  /** §Phase 12 — "Refresh scientific information" passes this so a saved organism's explicit refresh action actually re-fetches instead of just handing back the same cached profile it already has. */
  forceRefresh?: boolean
}

/**
 * §19/§42 — only ever called from an explicit user action (a "Search
 * trusted scientific sources" tap, or an explicit "My Sources"/"Choose a
 * specific source" search), never from a keystroke or from routing to
 * an id that happens not to resolve locally. Checks the Knowledge Layer
 * cache first (§22), then — only if online, and only for 'trusted'/
 * 'my-sources' modes* — runs the real retrieval tiers and normalizes
 * whatever they found into an `OrganismProfile` shaped exactly like a
 * curated one, so it can flow through the existing
 * OrganismCard/OrganismDetailPage unchanged (§3/§4).
 *
 * *'specific-source' and 'my-sources' never call any online source —
 * they only read the user's already-imported local library (§Phase 4-8:
 * "the source boundary must be explicit... never silently supplemented
 * with trusted-source content").
 */
export async function lookupOrganismOnline(
  query: string,
  options: KnowledgeLayerLookupOptions = {}
): Promise<KnowledgeLayerLookupResult> {
  const mode: KnowledgeSourceMode = options.mode ?? 'trusted'
  const trimmed = query.trim()
  if (!looksLikeOrganismQuery(trimmed)) return { status: 'not-found' }

  const id = canonicalOrganismId(trimmed)
  if (!id) return { status: 'not-found' }

  const cacheKey = cacheKeyFor(id, mode, options.libraryItemId)
  const cached = await readKLCache(cacheKey)
  if (!options.forceRefresh && cached?.profile && Date.now() - cached.fetchedAt < KL_CACHE_TTL_MS) {
    return { status: 'found', profile: cached.profile }
  }

  if (mode === 'my-sources' || mode === 'specific-source') {
    return lookupFromLibrarySources(trimmed, id, mode, cacheKey, options.libraryItemId)
  }

  if (!isLikelyOnline()) {
    // Graceful offline degradation, same rule onlineKnowledge.ts itself
    // follows: a stale cached profile beats nothing, but we never
    // pretend to have fetched fresh data (§20/§21).
    return cached?.profile ? { status: 'found', profile: cached.profile } : { status: 'offline' }
  }

  let summary: OnlineSummary | undefined
  let mesh: MeshClassification | undefined
  let visuals: VisualReference[] = []
  let taxonomy: Awaited<ReturnType<typeof resolveTaxonomicRank>>
  try {
    const results = await Promise.all([
      fetchOnlineSummary(trimmed),
      fetchMeshClassification(trimmed),
      fetchVisualReferences(trimmed),
      resolveTaxonomicRank(trimmed)
    ])
    summary = results[0]
    mesh = results[1]
    visuals = results[2]
    taxonomy = results[3]
  } catch {
    // fetchOnlineSummary/fetchMeshClassification/fetchVisualReferences/
    // resolveTaxonomicRank are themselves documented to never throw —
    // this catch exists only as a last-resort safety net so a genuinely
    // unexpected error still degrades to a clean failure state instead
    // of crashing the page.
    return { status: 'error' }
  }

  if (!summary && !mesh && !taxonomy) {
    // Nothing reliable found anywhere — an honest empty result, not a
    // guess or a substitute lower-quality source (§8/§38).
    await writeKLCache(cacheKey, null)
    return { status: 'not-found' }
  }

  const combinedText = [trimmed, summary?.extract, mesh?.scopeNote, taxonomy?.acceptedName].filter(Boolean).join(' ')
  const category = guessCategory(combinedText)
  const { genus, species } = splitBinomial(trimmed)

  const sources: OrganismSource[] = []
  if (summary) {
    sources.push({ name: summary.sourceName, kind: summary.isAbstract ? 'scientific' : 'educational', url: summary.sourceUrl })
  }
  if (mesh) {
    sources.push({ name: mesh.sourceName, kind: 'scientific', url: mesh.sourceUrl })
  }
  if (taxonomy) {
    sources.push({ name: taxonomy.sourceName, kind: 'scientific', url: taxonomy.sourceUrl })
  }
  const visual = visuals[0]
  if (visual) {
    sources.push({ name: visual.sourceName, kind: 'scientific', url: visual.sourceUrl })
  }

  // §Phase 2 — the actual "Lactobacillus acidophilus" fix: if the query
  // reads as a species binomial but NCBI Taxonomy's own record for it
  // only resolves to genus rank, say so explicitly instead of quietly
  // presenting genus-level information as if it were species-specific.
  const genusOnlyForSpeciesQuery = isGenusOnlyResolutionForSpeciesQuery(trimmed, taxonomy)

  const profile: OrganismProfile = {
    id,
    scientificName: trimmed,
    category,
    quickTags: [],
    classification: { genus, species },
    morphology: {},
    identificationClues: genusOnlyForSpeciesQuery
      ? [
          `Only genus-level information was reliably found for "${trimmed}" — showing what's available for the genus ${
            taxonomy?.acceptedName ?? genus ?? trimmed.split(/\s+/)[0]
          } rather than guessing species-specific detail.`
        ]
      : [],
    examFacts: {},
    sources,
    sourceType: 'knowledge-layer',
    knowledgeLayer: {
      retrievedAt: Date.now(),
      generalReference: summary
        ? { text: summary.extract, sourceName: summary.sourceName, sourceUrl: summary.sourceUrl, isAbstract: summary.isAbstract }
        : undefined,
      meshScopeNote: mesh?.scopeNote ? { text: mesh.scopeNote, sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl } : undefined,
      sourceMode: 'trusted',
      taxonomicResolution: taxonomy,
      referenceLinks: buildReferenceLinks(trimmed, category)
    },
    externalImage: visual
      ? { imageUrl: visual.imageUrl, caption: visual.caption, sourceName: visual.sourceName, sourceUrl: visual.sourceUrl }
      : undefined
  }

  await writeKLCache(cacheKey, profile)
  return { status: 'found', profile }
}

/**
 * §Phase 5-9 — "My Sources" / "Choose a specific source". Reads only
 * the user's already-imported local library (never an online source —
 * see the `lookupOrganismOnline` doc comment above for why that
 * boundary matters). Builds a profile shaped like any other Knowledge
 * Layer result so it flows through the same OrganismCard/
 * OrganismDetailPage rendering, but every `sources` entry is
 * `kind: 'local-book'` with real book/page provenance, and nothing here
 * is ever silently topped up with PubMed/MeSH/NCBI content.
 */
async function lookupFromLibrarySources(
  trimmed: string,
  id: string,
  mode: 'my-sources' | 'specific-source',
  cacheKey: string,
  libraryItemId?: string
): Promise<KnowledgeLayerLookupResult> {
  if (mode === 'specific-source' && !libraryItemId) return { status: 'not-found' }

  let result: Awaited<ReturnType<typeof lookupInAllLibrarySources>>
  try {
    result =
      mode === 'specific-source'
        ? await lookupInSpecificLibrarySource(trimmed, libraryItemId as string)
        : await lookupInAllLibrarySources(trimmed)
  } catch (err) {
    if (err instanceof LibrarySearchTimeoutError) return { status: 'timed-out' }
    return { status: 'error' }
  }

  if (result.excerpts.length === 0) {
    // Explicitly NOT the same as 'not-found' — the organism may well be
    // covered by trusted scientific sources; it just isn't in this
    // particular local source. The UI is expected to offer an explicit
    // "Search trusted scientific sources" action from here (§Phase 6),
    // never fall back to it automatically.
    const searchedSourceName =
      mode === 'specific-source' ? result.matchedBooks[0]?.title : undefined
    return { status: 'not-found-in-source', searchedSourceName }
  }

  const combinedText = [trimmed, ...result.excerpts.map((e) => e.text)].join(' ')
  const category = guessCategory(combinedText)
  const { genus, species } = splitBinomial(trimmed)

  const profile: OrganismProfile = {
    id,
    scientificName: trimmed,
    category,
    quickTags: [],
    classification: { genus, species },
    morphology: {},
    identificationClues: [],
    examFacts: {},
    sources: result.sources,
    sourceType: 'knowledge-layer',
    knowledgeLayer: {
      retrievedAt: Date.now(),
      sourceMode: mode,
      libraryItemId: mode === 'specific-source' ? libraryItemId : undefined,
      libraryExcerpts: result.excerpts
    }
  }

  await writeKLCache(cacheKey, profile)
  return { status: 'found', profile }
}
