/**
 * core/organisms/taxonomyResolution — Knowledge Layer + Source Library
 * brief, Phase 2 ("Fix species-level taxonomic search").
 *
 * PROBLEM THIS FIXES: searching "Lactobacillus acidophilus" previously
 * fell back to whatever `fetchOnlineSummary`/`fetchMeshClassification`
 * happened to match, which for many species-level binomials is only a
 * genus-level PubMed/MeSH record — and the resulting profile had no way
 * to say so. This module adds one focused, honest check: ask NCBI
 * Taxonomy (not a full-text search — a structured taxonomy database)
 * what rank it actually has a record for, and surface that rank
 * directly rather than letting a genus-level hit quietly pass as
 * species-specific.
 *
 * Reuses `fetchJson` from onlineKnowledge.ts (same timeout, same
 * "CORS/network failure degrades to undefined, never throws" contract)
 * instead of standing up a second HTTP client (§45).
 *
 * NCBI Taxonomy (`db=taxonomy` on the same eutils.ncbi.nlm.nih.gov host
 * already used elsewhere in this app) is a structured record lookup,
 * not a scrape of a rendered page — esearch/esummary are NCBI's own
 * public, key-free JSON endpoints, documented for this kind of
 * programmatic use. As with every other eutils call in this codebase,
 * this app's CORS access to it from a live deployed origin has not been
 * confirmed from within this environment; failures degrade to
 * `undefined`, never to a guessed rank.
 */
import { db } from '../db'
import { fetchJson, isLikelyOnline, NCBI_EUTILS_BASE } from '../concepts/onlineKnowledge'
import type { TaxonomicResolution } from './types'

const CACHE_KEY_PREFIX = 'organismTaxonomyCache:v1:'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days — taxonomic rank/accepted name changes rarely

interface CacheEntry {
  fetchedAt: number
  value: TaxonomicResolution | null
}

async function readCache(key: string): Promise<CacheEntry | undefined> {
  const record = await db.appSettings.get(`${CACHE_KEY_PREFIX}${key}`)
  return record?.value as CacheEntry | undefined
}

async function writeCache(key: string, value: TaxonomicResolution | null): Promise<void> {
  await db.appSettings.put({ key: `${CACHE_KEY_PREFIX}${key}`, value: { fetchedAt: Date.now(), value } })
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

interface NcbiTaxonomySummaryResult {
  uid?: string
  rank?: string
  scientificname?: string
}

interface NcbiTaxonomyEsearchResponse {
  esearchresult?: { idlist?: string[] }
}

interface NcbiTaxonomyEsummaryResponse {
  result?: Record<string, NcbiTaxonomySummaryResult | string[]>
}

/**
 * NCBI Taxonomy's `rank` field is free text ("species", "genus",
 * "subspecies", "family", "no rank", ...) — normalized here to the
 * three buckets `TaxonomicResolution` actually distinguishes. A rank
 * NCBI reports that isn't recognized falls into 'other' rather than
 * being guessed as species/genus.
 */
function normalizeRank(rawRank: string | undefined): 'species' | 'genus' | 'other' {
  const lower = (rawRank ?? '').toLowerCase()
  if (lower === 'species' || lower === 'subspecies' || lower === 'varietas' || lower === 'forma') return 'species'
  if (lower === 'genus') return 'genus'
  return 'other'
}

/**
 * §Phase 2 — resolves what taxonomic rank NCBI Taxonomy actually has a
 * record for, for the exact string the user searched. Only ever called
 * from a 'trusted'-mode Knowledge Layer lookup (never during a
 * 'my-sources'/'specific-source' search, which must not touch any
 * online source at all — §Phase 4-6). Returns `undefined` for offline,
 * network failure, or "no taxonomy record at all" — never a guessed
 * result standing in for a real one.
 */
export async function resolveTaxonomicRank(query: string): Promise<TaxonomicResolution | undefined> {
  const trimmed = query.trim()
  if (!trimmed) return undefined

  const cacheKey = trimmed.toLowerCase()
  const cached = await readCache(cacheKey)
  if (cached && isFresh(cached)) return cached.value ?? undefined
  if (!isLikelyOnline()) return cached?.value ?? undefined

  const term = encodeURIComponent(trimmed)
  const searchData = (await fetchJson(
    `${NCBI_EUTILS_BASE}/esearch.fcgi?db=taxonomy&retmode=json&retmax=1&term=${term}`
  )) as NcbiTaxonomyEsearchResponse | undefined
  const taxId = searchData?.esearchresult?.idlist?.[0]
  if (!taxId) {
    await writeCache(cacheKey, null)
    return undefined
  }

  const summaryData = (await fetchJson(`${NCBI_EUTILS_BASE}/esummary.fcgi?db=taxonomy&retmode=json&id=${taxId}`)) as
    | NcbiTaxonomyEsummaryResponse
    | undefined
  const record = summaryData?.result?.[taxId] as NcbiTaxonomySummaryResult | undefined
  if (!record?.scientificname) {
    await writeCache(cacheKey, null)
    return undefined
  }

  const resolution: TaxonomicResolution = {
    queriedName: trimmed,
    resolvedRank: normalizeRank(record.rank),
    acceptedName: record.scientificname,
    taxId,
    sourceName: 'NCBI Taxonomy',
    sourceUrl: `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${taxId}`
  }

  await writeCache(cacheKey, resolution)
  return resolution
}

/**
 * §Phase 2 — true only when the query itself looks like a species-level
 * binomial ("Genus species") but NCBI Taxonomy's own record for it
 * resolves to genus rank (or the accepted name is just the genus word).
 * This is exactly the "Lactobacillus acidophilus → silently shows
 * Lactobacillus-genus info" failure the brief called out — this helper
 * is what lets the UI say so instead of staying silent about it.
 */
export function isGenusOnlyResolutionForSpeciesQuery(query: string, resolution: TaxonomicResolution | undefined): boolean {
  if (!resolution) return false
  const parts = query.trim().split(/\s+/)
  const queryLooksLikeBinomial = parts.length >= 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z-]+$/.test(parts[1])
  if (!queryLooksLikeBinomial) return false
  return resolution.resolvedRank === 'genus'
}
