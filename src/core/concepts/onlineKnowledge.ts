/**
 * core/concepts/onlineKnowledge — Sprint 3.1 correction.
 *
 * NO AI. Nothing here "writes" an explanation — every string returned by
 * this module is either a direct excerpt pulled from a real page at a
 * real URL, or a link title. The caller shows the source attribution
 * (`sourceName`/`sourceUrl`) next to anything rendered from here.
 *
 * WIKIPEDIA REMOVED FROM THE OVERVIEW PIPELINE. `fetchOnlineSummary` —
 * the only function of this module that feeds the Concept Overview — no
 * longer calls Wikipedia in any form. It now queries NCBI's E-utilities
 * (PubMed) directly from the browser: `eutils.ncbi.nlm.nih.gov` is a
 * public, keyless JSON/text API; unlike `en.wikipedia.org` it is not
 * something this codebase can independently confirm sends
 * `Access-Control-Allow-Origin` for browser `fetch()` calls without a
 * live browser to test against, so every call below is wrapped so a
 * CORS/network failure degrades to "unavailable" — it is never allowed
 * to throw, and it never falls back to Wikipedia or any invented text.
 *
 * WHY NOT CDC/WHO/ICMR DIRECTLY: none of them publish a public,
 * CORS-enabled, key-free content API a static client-side PWA can call.
 * That's a genuine capability gap, not a shortcut — see the module-level
 * comment in the Sprint 3.1 status report for the full explanation.
 * Faking those sources or silently substituting Wikipedia for them would
 * violate the "do not invent, do not mislabel a source" rule, so instead
 * this module simply doesn't claim to reach them.
 *
 * WHAT'S STILL WIKIPEDIA-BACKED, ON PURPOSE, FOR NOW: `fetchOnlineRelated`
 * and `verifyCandidateExists` below still call Wikipedia. They feed
 * `RelatedConceptsPanel.tsx` only — not the Overview — and this pass was
 * scoped to "fix the Concept Overview only, do not touch
 * RelatedConceptsPanel.tsx or its feature behavior." Removing Wikipedia
 * from these two would change what that panel shows, which is explicitly
 * out of scope for this change. Flagged clearly for a follow-up pass.
 *
 * FAILURE MODE: any network error, timeout, or empty result resolves to
 * `undefined` rather than throwing — callers fall back to local library
 * material.
 */

import { db } from '../db'

const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const CACHE_KEY_PREFIX = 'onlineKnowledgeCache:v2:'
const NCBI_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export interface OnlineSummary {
  title: string
  /** Direct excerpt text from the source — never rewritten/paraphrased by this app. */
  extract: string
  sourceName: 'PubMed (NCBI)'
  sourceUrl: string
  /** True when `extract` is a paper abstract rather than a general definition — the UI should label it accordingly instead of implying it's a textbook definition. */
  isAbstract: boolean
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
    // Covers network failure, timeout, AND a CORS rejection (which
    // surfaces to `fetch` as a generic TypeError, indistinguishable
    // from being offline) — all treated the same way: source unavailable.
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchText(url: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return undefined
    return await res.text()
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/** Reasonable client-side check before attempting a network call at all. */
export function isLikelyOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

/**
 * Best-effort extraction of just the abstract paragraph from a PubMed
 * `efetch rettype=abstract&retmode=text` response, which otherwise mixes
 * in the citation line, title, author list, and a trailing PMID/DOI
 * footer. Heuristic (the abstract is reliably the longest paragraph in
 * the response) rather than a strict parser — if it can't confidently
 * find one, returns `undefined` rather than guessing wrong.
 */
function extractAbstractParagraph(raw: string): string | undefined {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0 && !/^PMID:/i.test(p) && !/^DOI:/i.test(p) && !/^©/.test(p))

  if (paragraphs.length === 0) return undefined
  const longest = paragraphs.reduce((a, b) => (b.length > a.length ? b : a))
  // A real abstract paragraph reads as prose, not a citation/author line.
  if (longest.length < 60) return undefined
  return longest
}

/**
 * NCBI/PubMed lookup — Priority 1 of the source hierarchy. Searches
 * PubMed for the concept name, and if a result exists, pulls its
 * abstract text and citation. Returns `undefined` (never invents, never
 * substitutes another source) when: offline, the request fails/times
 * out (including a CORS rejection), no PubMed result exists, or a result
 * exists but no usable abstract paragraph could be extracted from it.
 * Cached per normalized name for `CACHE_TTL_MS`.
 */
export async function fetchOnlineSummary(name: string): Promise<OnlineSummary | undefined> {
  const key = name.trim().toLowerCase()
  if (!key) return undefined

  const cached = await readCache<OnlineSummary>(key)
  if (cached && isFresh(cached)) return cached.value ?? undefined

  if (!isLikelyOnline()) return cached?.value ?? undefined

  const term = encodeURIComponent(name.trim())
  const searchData = (await fetchJson(
    `${NCBI_EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=1&sort=relevance&term=${term}`
  )) as { esearchresult?: { idlist?: string[] } } | undefined

  const pmid = searchData?.esearchresult?.idlist?.[0]
  if (!pmid) {
    await writeCache(key, null)
    return undefined
  }

  const [summaryData, abstractText] = await Promise.all([
    fetchJson(`${NCBI_EUTILS_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`) as Promise<
      { result?: Record<string, { title?: string }> } | undefined
    >,
    fetchText(`${NCBI_EUTILS_BASE}/efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id=${pmid}`)
  ])

  const title = summaryData?.result?.[pmid]?.title
  const abstract = abstractText ? extractAbstractParagraph(abstractText) : undefined

  if (!title || !abstract) {
    await writeCache(key, null)
    return undefined
  }

  const summary: OnlineSummary = {
    title,
    extract: abstract,
    sourceName: 'PubMed (NCBI)',
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    isAbstract: true
  }
  await writeCache(key, summary)
  return summary
}

// ---------------------------------------------------------------------
// Related-tab support only (RelatedConceptsPanel.tsx) — intentionally
// UNCHANGED in this pass, see the module comment above. Still
// Wikipedia-backed; scheduled for its own correction pass so as not to
// change Related-tab behavior while only the Overview was in scope here.
// ---------------------------------------------------------------------

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

export async function verifyCandidateExists(name: string): Promise<boolean> {
  const key = name.trim().toLowerCase()
  if (!key) return false
  const cached = await readCache<{ exists: boolean }>(`verify:${key}`)
  if (cached && isFresh(cached)) return Boolean(cached.value?.exists)
  if (!isLikelyOnline()) return Boolean(cached?.value?.exists)

  const encoded = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
  const data = (await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`)) as
    | { type?: string; extract?: string }
    | undefined
  const exists = Boolean(data && data.type !== 'disambiguation' && data.extract)
  await writeCache(`verify:${key}`, { exists })
  return exists
}

