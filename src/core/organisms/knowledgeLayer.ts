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
import type { OrganismCategory, OrganismProfile, OrganismSource } from './types'

const KL_CACHE_PREFIX = 'organismKnowledgeLayer:v1:'
const KL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — same horizon as onlineKnowledge.ts

interface KLCacheEntry {
  fetchedAt: number
  profile: OrganismProfile | null
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

async function readKLCache(id: string): Promise<KLCacheEntry | undefined> {
  const record = await db.appSettings.get(`${KL_CACHE_PREFIX}${id}`)
  return record?.value as KLCacheEntry | undefined
}

async function writeKLCache(id: string, profile: OrganismProfile | null): Promise<void> {
  await db.appSettings.put({ key: `${KL_CACHE_PREFIX}${id}`, value: { fetchedAt: Date.now(), profile } as KLCacheEntry })
}

/** Reads a previously-retrieved Knowledge Layer profile straight from cache, no network — used by OrganismDetailPage so reopening/back-navigating to one doesn't re-trigger retrieval (§22). Returns undefined for anything never looked up, cached-as-empty, or expired. */
export async function getCachedKnowledgeLayerProfile(id: string): Promise<OrganismProfile | undefined> {
  const entry = await readKLCache(id)
  if (!entry || !entry.profile) return undefined
  if (Date.now() - entry.fetchedAt >= KL_CACHE_TTL_MS) return undefined
  return entry.profile
}

// ---------------------------------------------------------------------
// The lookup itself
// ---------------------------------------------------------------------

export type KnowledgeLayerLookupStatus = 'found' | 'not-found' | 'offline' | 'error'

export interface KnowledgeLayerLookupResult {
  status: KnowledgeLayerLookupStatus
  profile?: OrganismProfile
}

/**
 * §19/§42 — only ever called from an explicit user action (a "Search
 * trusted scientific sources" tap), never from a keystroke or from
 * routing to an id that happens not to resolve locally. Checks the
 * Knowledge Layer cache first (§22), then — only if online (§21) —
 * runs the real retrieval tiers and normalizes whatever they found into
 * an `OrganismProfile` shaped exactly like a curated one, so it can
 * flow through the existing OrganismCard/OrganismDetailPage unchanged
 * (§3/§4).
 */
export async function lookupOrganismOnline(query: string): Promise<KnowledgeLayerLookupResult> {
  const trimmed = query.trim()
  if (!looksLikeOrganismQuery(trimmed)) return { status: 'not-found' }

  const id = canonicalOrganismId(trimmed)
  if (!id) return { status: 'not-found' }

  const cached = await readKLCache(id)
  if (cached?.profile && Date.now() - cached.fetchedAt < KL_CACHE_TTL_MS) {
    return { status: 'found', profile: cached.profile }
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
  try {
    const results = await Promise.all([fetchOnlineSummary(trimmed), fetchMeshClassification(trimmed), fetchVisualReferences(trimmed)])
    summary = results[0]
    mesh = results[1]
    visuals = results[2]
  } catch {
    // fetchOnlineSummary/fetchMeshClassification/fetchVisualReferences
    // are themselves documented to never throw — this catch exists only
    // as a last-resort safety net so a genuinely unexpected error still
    // degrades to a clean failure state instead of crashing the page.
    return { status: 'error' }
  }

  if (!summary && !mesh) {
    // Nothing reliable found anywhere — an honest empty result, not a
    // guess or a substitute lower-quality source (§8/§38).
    await writeKLCache(id, null)
    return { status: 'not-found' }
  }

  const combinedText = [trimmed, summary?.extract, mesh?.scopeNote].filter(Boolean).join(' ')
  const category = guessCategory(combinedText)
  const { genus, species } = splitBinomial(trimmed)

  const sources: OrganismSource[] = []
  if (summary) {
    sources.push({ name: summary.sourceName, kind: summary.isAbstract ? 'scientific' : 'educational', url: summary.sourceUrl })
  }
  if (mesh) {
    sources.push({ name: mesh.sourceName, kind: 'scientific', url: mesh.sourceUrl })
  }
  const visual = visuals[0]
  if (visual) {
    sources.push({ name: visual.sourceName, kind: 'scientific', url: visual.sourceUrl })
  }

  const profile: OrganismProfile = {
    id,
    scientificName: trimmed,
    category,
    quickTags: [],
    classification: { genus, species },
    morphology: {},
    identificationClues: [],
    examFacts: {},
    sources,
    sourceType: 'knowledge-layer',
    knowledgeLayer: {
      retrievedAt: Date.now(),
      generalReference: summary
        ? { text: summary.extract, sourceName: summary.sourceName, sourceUrl: summary.sourceUrl, isAbstract: summary.isAbstract }
        : undefined,
      meshScopeNote: mesh?.scopeNote ? { text: mesh.scopeNote, sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl } : undefined
    },
    externalImage: visual
      ? { imageUrl: visual.imageUrl, caption: visual.caption, sourceName: visual.sourceName, sourceUrl: visual.sourceUrl }
      : undefined
  }

  await writeKLCache(id, profile)
  return { status: 'found', profile }
}
