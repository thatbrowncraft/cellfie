/**
 * core/concepts/onlineKnowledge — Sprint 4 (Concept Explorer + Scientific
 * Knowledge Enrichment), online scientific enrichment for explicitly
 * selected concepts.
 *
 * NO AI. No LLM, no embeddings, no summarization model, nothing here
 * "writes" an explanation — every string returned by this module is
 * either a direct extract pulled from a real page at a real URL, or a
 * link title. The caller is responsible for showing the source
 * attribution (`sourceName`/`sourceUrl`) next to anything rendered from
 * here, per the brief's "Definition / Source: NCBI" pairing.
 *
 * SOURCE CHOICE — an honest explanation of the tradeoff: the brief asks
 * to prioritize NCBI/CDC/WHO/university sources. None of those publish a
 * public, CORS-enabled, no-API-key JSON endpoint that a static
 * client-side PWA can call directly from the browser (NCBI's E-utilities
 * are CORS-blocked for arbitrary origins; CDC/WHO have no public content
 * API at all). Adding a server-side proxy would mean standing up and
 * paying for backend infrastructure, which is out of scope for a
 * local-first PWA with "no new dependencies". Wikipedia's REST API
 * (`en.wikipedia.org/api/rest_v1`) is the one major reference source
 * that is (a) free, (b) keyless, (c) CORS-enabled for browser calls, and
 * (d) sourced from a scientifically-reviewed, citation-backed article for
 * the kind of established topic this app deals with (Gram staining,
 * peptidoglycan, etc.). It is used here as the online source, always
 * clearly labeled "Wikipedia" — never mislabeled as NCBI/CDC/WHO — so the
 * person always knows exactly where a sentence came from. If a future
 * sprint adds a backend, swapping in NCBI/CDC/WHO calls here is a
 * same-shaped, additive change.
 *
 * FAILURE MODE: any network error, timeout, 404, or disambiguation page
 * resolves to `undefined` rather than throwing — callers fall back to
 * local library material, per the brief's "online fails → local still
 * works" requirement.
 */

import { db } from '../db'

const REQUEST_TIMEOUT_MS = 6000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — long enough to avoid refetching on every visit, short enough that a re-check eventually happens.
const CACHE_KEY_PREFIX = 'onlineKnowledgeCache:v1:'

export interface OnlineSummary {
  title: string
  /** Direct extract text from the source article — never rewritten/paraphrased by this app. */
  extract: string
  sourceName: 'Wikipedia'
  sourceUrl: string
}

export interface OnlineRelatedItem {
  title: string
  sourceUrl: string
}

interface CacheEntry<T> {
  fetchedAt: number
  value: T | null
}

async function readCache<T>(key: string): Promise<CacheEntry<T> | undefined> {
  const record = await db.appSettings.get(`${CACHE_KEY_PREFIX}${key}`)
  return record?.value as CacheEntry<T> | undefined
}

async function writeCache<T>(key: string, value: T | null): Promise<void> {
  await db.appSettings.put({ key: `${CACHE_KEY_PREFIX}${key}`, value: { fetchedAt: Date.now(), value } })
}

function isFresh(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return undefined
    return await res.json()
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/** Reasonable client-side check before attempting a network call at all — avoids waiting out a timeout while offline. */
export function isLikelyOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

/**
 * Looks up a concept's Wikipedia summary. Returns `undefined` when the
 * concept has no article, the article is a disambiguation page (too
 * ambiguous to attribute a definition to), or the request fails/times
 * out/is offline. Cached per normalized name for `CACHE_TTL_MS`.
 */
export async function fetchOnlineSummary(name: string): Promise<OnlineSummary | undefined> {
  const key = name.trim().toLowerCase()
  if (!key) return undefined

  const cached = await readCache<OnlineSummary>(key)
  if (cached && isFresh(cached)) return cached.value ?? undefined

  if (!isLikelyOnline()) return cached?.value ?? undefined

  const encoded = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
  const data = (await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`)) as
    | {
        type?: string
        title?: string
        extract?: string
        content_urls?: { desktop?: { page?: string } }
      }
    | undefined

  if (!data || data.type === 'disambiguation' || !data.extract || !data.title) {
    await writeCache(key, null)
    return undefined
  }

  const summary: OnlineSummary = {
    title: data.title,
    extract: data.extract,
    sourceName: 'Wikipedia',
    sourceUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`
  }
  await writeCache(key, summary)
  return summary
}

/**
 * Wikipedia's own "related pages" recommendation for a title — a
 * curated, already-scientifically-adjacent list (for "Gram staining"
 * this reliably includes things like Gram-positive/Gram-negative
 * bacteria, crystal violet, peptidoglycan) rather than raw text-mined
 * phrases. This is what backs the "Online related concept suggestions"
 * UI — never auto-added, always requires the person to click "Add
 * concept" (see `promoteConceptCandidate`).
 */
export async function fetchOnlineRelated(name: string): Promise<OnlineRelatedItem[]> {
  const key = `related:${name.trim().toLowerCase()}`
  const cached = await readCache<OnlineRelatedItem[]>(key)
  if (cached && isFresh(cached)) return cached.value ?? []

  if (!isLikelyOnline()) return cached?.value ?? []

  const encoded = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
  const data = (await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/related/${encoded}`)) as
    | { pages?: { title?: string; content_urls?: { desktop?: { page?: string } } }[] }
    | undefined

  const pages = data?.pages
  if (!pages) {
    await writeCache(key, null)
    return []
  }

  const items: OnlineRelatedItem[] = pages
    .filter((p): p is { title: string; content_urls?: { desktop?: { page?: string } } } => Boolean(p.title))
    .map((p) => ({
      title: p.title.replace(/_/g, ' '),
      sourceUrl: p.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`
    }))
    .filter((p) => p.title.toLowerCase() !== name.trim().toLowerCase())
    .slice(0, 10)

  await writeCache(key, items)
  return items
}

/**
 * Weak online verification for a locally-mined candidate phrase (see
 * `findCandidateConceptsFromKnownPages` in ./extraction): does a
 * standard (non-disambiguation) Wikipedia article exist for it at all?
 * This does not guarantee the phrase is scientifically meaningful — see
 * the honest caveat in RelatedConceptsPanel's copy — but it reliably
 * rejects OCR fragments, broken words, and sentence fragments, which
 * essentially never have their own encyclopedia article.
 */
export async function verifyCandidateExists(name: string): Promise<boolean> {
  const summary = await fetchOnlineSummary(name)
  return Boolean(summary)
}
