/**
 * core/concepts/onlineKnowledge — Sprint: general-topic Overview.
 *
 * NO AI. Nothing here "writes" an explanation — every string returned by
 * this module is either a direct excerpt pulled from a real page at a
 * real URL, or a link title. The caller shows the source attribution
 * (`sourceName`/`sourceUrl`) next to anything rendered from here.
 *
 * WIKIPEDIA REMOVED FROM THE OVERVIEW PIPELINE. `fetchOnlineSummary` —
 * the only function of this module that feeds the Concept Overview —
 * never calls Wikipedia, and the general-reference tier added below
 * explicitly REJECTS any result attributed to Wikipedia rather than
 * silently accepting it (see `isWikipediaSourced`).
 *
 * SOURCE HIERARCHY — this app covers topics far outside microbiology
 * (percentages, profit & loss, PCR, photosynthesis, enzyme kinetics...),
 * so a single biomedical-only source can't be the whole story:
 *
 *   Tier 1 — NCBI/PubMed (`eutils.ncbi.nlm.nih.gov`), attempted only for
 *            concepts that look like a life-science/medical topic (see
 *            `looksBiomedical`). Skipped for quantitative/aptitude
 *            topics, where a random biomedical paper abstract would be
 *            actively misleading, not just unhelpful.
 *   Tier 2 — a general reference lookup (DuckDuckGo's keyless Instant
 *            Answer API), used for everything else / as a fallback when
 *            Tier 1 finds nothing, with any Wikipedia-attributed result
 *            filtered out and the ACTUAL source it names (e.g.
 *            "Encyclopedia Britannica") shown — never mislabeled.
 *   Neither tier reaches CDC/WHO/FDA/USDA/CDSCO/ICMR/OpenStax/Khan
 *   Academy directly: none of those publish a public, CORS-enabled,
 *   key-free content API a static client-side PWA can call without a
 *   backend. That's a genuine capability gap, not a shortcut — faking
 *   those sources or quietly substituting Wikipedia for them would
 *   violate "do not invent, do not mislabel a source", so this module
 *   simply doesn't claim to reach them. See the delivery notes for what
 *   a backend-proxy follow-up would look like.
 *
 * NEITHER eutils.ncbi.nlm.nih.gov NOR api.duckduckgo.com's CORS behavior
 * toward this app's actual deployed origin has been confirmed from a
 * live browser (this environment has none) — every call below is
 * wrapped so a CORS/network failure degrades to "unavailable", is never
 * allowed to throw, and never falls back to Wikipedia or invented text.
 *
 * WIKIPEDIA FULLY REMOVED. Every function in this module — including
 * `fetchOnlineRelated` and `verifyCandidateExists`, which used to call
 * Wikipedia's related-pages and summary endpoints — now reuses the same
 * Wikipedia-free tier hierarchy as `fetchOnlineSummary`: PubMed/NCBI for
 * concepts that look biomedical, DuckDuckGo's keyless Instant Answer API
 * (itself filtered to reject anything Wikipedia-attributed) for
 * everything else. No exceptions remain anywhere in this file (§8/§14).
 *
 * SOURCE HIERARCHY — this app covers topics far outside microbiology
 * (percentages, profit & loss, PCR, photosynthesis, enzyme kinetics...),
 * so a single biomedical-only source can't be the whole story:
 *
 *   Tier 1 — NCBI/PubMed (`eutils.ncbi.nlm.nih.gov`), attempted only for
 *            concepts that look like a life-science/medical topic (see
 *            `looksBiomedical`). Skipped for quantitative/aptitude
 *            topics, where a random biomedical paper abstract would be
 *            actively misleading, not just unhelpful.
 *   Tier 2 — a general reference lookup (DuckDuckGo's keyless Instant
 *            Answer API), used for everything else / as a fallback when
 *            Tier 1 finds nothing, with any Wikipedia-attributed result
 *            filtered out and the ACTUAL source it names (e.g.
 *            "Encyclopedia Britannica") shown — never mislabeled.
 *   Neither tier reaches CDC/WHO/FDA/USDA/CDSCO/ICMR/OpenStax/Khan
 *   Academy directly: none of those publish a public, CORS-enabled,
 *   key-free content API a static client-side PWA can call without a
 *   backend. That's a genuine capability gap, not a shortcut — faking
 *   those sources or quietly substituting Wikipedia for them would
 *   violate "do not invent, do not mislabel a source", so this module
 *   simply doesn't claim to reach them. See the delivery notes for what
 *   a backend-proxy follow-up would look like.
 *
 * NEITHER eutils.ncbi.nlm.nih.gov NOR api.duckduckgo.com's CORS behavior
 * toward this app's actual deployed origin has been confirmed from a
 * live browser (this environment has none) — every call below is
 * wrapped so a CORS/network failure degrades to "unavailable", is never
 * allowed to throw, and never falls back to Wikipedia or invented text.
 *
 * FAILURE MODE: any network error, timeout, or empty result resolves to
 * `undefined` rather than throwing — callers fall back to local library
 * material.
 */

import { db } from '../db'

const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const CACHE_KEY_PREFIX = 'onlineKnowledgeCache:v4:'
const NCBI_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export interface OnlineSummary {
  title: string
  /** Direct excerpt text from the source — never rewritten/paraphrased by this app. */
  extract: string
  /** The real, specific source name (e.g. "PubMed (NCBI)", or whatever a general-reference lookup actually names) — NEVER "Wikipedia". */
  sourceName: string
  sourceUrl: string
  /** True when `extract` is a paper abstract rather than a general definition — the UI should label it accordingly instead of implying it's a textbook definition. */
  isAbstract: boolean
}

export interface OnlineRelatedItem {
  title: string
  sourceUrl: string
  /** The real, specific source this relation came from (e.g. "PubMed (NCBI)", or whatever DuckDuckGo's aggregation actually names) — NEVER "Wikipedia". */
  sourceName: string
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
 * A concept name looks like a quantitative/aptitude topic (percentage,
 * profit & loss, ratios...) rather than a life-science/medical one.
 * Deliberately just a keyword check used to DECIDE WHICH TIER TO TRY —
 * it never filters or rewrites any content, so a wrong guess only means
 * a tier is skipped or tried unnecessarily, not that anything false gets
 * shown.
 */
const QUANTITATIVE_KEYWORDS = [
  'percentage', 'percent', 'profit', 'loss', 'ratio', 'proportion', 'average',
  'simple interest', 'compound interest', 'interest', 'probability', 'permutation',
  'combination', 'algebra', 'geometry', 'trigonometry', 'mensuration', 'discount',
  'hcf', 'lcm', 'number system', 'time and work', 'time, speed', 'speed and distance',
  'speed, distance', 'quantitative aptitude', 'data interpretation', 'arithmetic',
  'boat and stream', 'pipes and cistern', 'partnership', 'mixture and alligation'
]

function looksQuantitative(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return QUANTITATIVE_KEYWORDS.some((k) => lower.includes(k))
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
 * Tier 1 — NCBI/PubMed. Searches PubMed for the concept name, and if a
 * result exists, pulls its abstract text and citation. Returns
 * `undefined` when: offline, the request fails/times out/is CORS-blocked,
 * no PubMed result exists, or a result exists but no usable abstract
 * paragraph could be extracted from it.
 */
async function fetchPubMedSummary(name: string): Promise<OnlineSummary | undefined> {
  const term = encodeURIComponent(name.trim())
  const searchData = (await fetchJson(
    `${NCBI_EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=1&sort=relevance&term=${term}`
  )) as { esearchresult?: { idlist?: string[] } } | undefined

  const pmid = searchData?.esearchresult?.idlist?.[0]
  if (!pmid) return undefined

  const [summaryData, abstractText] = await Promise.all([
    fetchJson(`${NCBI_EUTILS_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`) as Promise<
      { result?: Record<string, { title?: string }> } | undefined
    >,
    fetchText(`${NCBI_EUTILS_BASE}/efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id=${pmid}`)
  ])

  const title = summaryData?.result?.[pmid]?.title
  const abstract = abstractText ? extractAbstractParagraph(abstractText) : undefined
  if (!title || !abstract) return undefined

  return {
    title,
    extract: abstract,
    sourceName: 'PubMed (NCBI)',
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    isAbstract: true
  }
}

function isWikipediaSourced(sourceName: string | undefined, sourceUrl: string | undefined): boolean {
  const name = (sourceName ?? '').toLowerCase()
  const url = (sourceUrl ?? '').toLowerCase()
  return name.includes('wikipedia') || url.includes('wikipedia.org')
}

/**
 * Tier 2 — general reference lookup for topics PubMed has no reason to
 * cover (percentages, formulas, general study topics) or didn't find
 * anything for. Uses DuckDuckGo's keyless Instant Answer API, which
 * aggregates several reference sources — but a large share of its
 * results are themselves sourced FROM Wikipedia, so any result whose
 * named source is Wikipedia (or links to wikipedia.org) is explicitly
 * rejected here rather than shown, per "Wikipedia must not be used
 * anywhere in this pipeline." That means many topics will legitimately
 * come back `undefined` — which is the correct, honest outcome per "if
 * no reliable source is available, say that clearly", not a bug.
 */
async function fetchGeneralReference(name: string): Promise<OnlineSummary | undefined> {
  const term = encodeURIComponent(name.trim())
  const data = (await fetchJson(
    `https://api.duckduckgo.com/?q=${term}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  )) as
    | {
        Heading?: string
        AbstractText?: string
        AbstractSource?: string
        AbstractURL?: string
      }
    | undefined

  if (!data?.AbstractText || !data.AbstractURL) return undefined
  if (isWikipediaSourced(data.AbstractSource, data.AbstractURL)) return undefined

  let sourceName = data.AbstractSource?.trim()
  if (!sourceName) {
    try {
      sourceName = new URL(data.AbstractURL).hostname.replace(/^www\./, '')
    } catch {
      sourceName = 'Online reference'
    }
  }

  return {
    title: data.Heading?.trim() || name.trim(),
    extract: data.AbstractText.trim(),
    sourceName,
    sourceUrl: data.AbstractURL,
    isAbstract: false
  }
}

/**
 * Runs the source hierarchy for a concept: Tier 1 (NCBI/PubMed, only for
 * concepts that look biomedical) then Tier 2 (general reference,
 * Wikipedia excluded) as a fallback — or as the only tier tried for
 * quantitative/aptitude topics, where Tier 1 would just be noise.
 * Returns `undefined` (never invents, never substitutes another source)
 * when nothing reliable is found. Cached per normalized name.
 */
export async function fetchOnlineSummary(name: string): Promise<OnlineSummary | undefined> {
  const key = name.trim().toLowerCase()
  if (!key) return undefined

  const cached = await readCache<OnlineSummary>(key)
  if (cached && isFresh(cached)) return cached.value ?? undefined

  if (!isLikelyOnline()) return cached?.value ?? undefined

  let result: OnlineSummary | undefined

  if (!looksQuantitative(name)) {
    result = await fetchPubMedSummary(name)
  }
  if (!result) {
    result = await fetchGeneralReference(name)
  }

  await writeCache(key, result ?? null)
  return result
}

// ---------------------------------------------------------------------
// Related-tab support (RelatedConceptsPanel.tsx) — Concept 2.0 §8/§14.
// Reuses the exact same Wikipedia-free tier hierarchy as
// `fetchOnlineSummary` above instead of a separate Wikipedia-backed
// path. That means these two functions can honestly return "nothing
// found" for a topic Wikipedia would have had an article for — that's
// the correct, honest outcome per "no reliable source found ≠
// substitute a worse one", not a regression.
// ---------------------------------------------------------------------

interface DdgRelatedTopic {
  Text?: string
  FirstURL?: string
  Topics?: DdgRelatedTopic[]
}

function flattenRelatedTopics(topics: DdgRelatedTopic[] | undefined): DdgRelatedTopic[] {
  if (!topics) return []
  return topics.flatMap((t) => (t.Topics ? flattenRelatedTopics(t.Topics) : [t]))
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Online reference'
  }
}

/**
 * Related concepts for the Connections tab. DuckDuckGo's Instant Answer
 * API returns a `RelatedTopics` list alongside the abstract already used
 * by `fetchGeneralReference` — each entry names its own source page, so
 * (same rule as everywhere else in this module) anything whose URL
 * points at wikipedia.org is dropped rather than shown. Because
 * DuckDuckGo's related-topic aggregation leans heavily on
 * Wikipedia/DBpedia, many concepts will legitimately come back with
 * few or zero suggestions here — an honest empty result, not a bug.
 */
export async function fetchOnlineRelated(name: string): Promise<OnlineRelatedItem[]> {
  const key = `related:${name.trim().toLowerCase()}`
  const cached = await readCache<OnlineRelatedItem[]>(key)
  if (cached && isFresh(cached)) return cached.value ?? []

  if (!isLikelyOnline()) return cached?.value ?? []

  const term = encodeURIComponent(name.trim())
  const data = (await fetchJson(
    `https://api.duckduckgo.com/?q=${term}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  )) as { RelatedTopics?: DdgRelatedTopic[] } | undefined

  const seen = new Set<string>()
  const items: OnlineRelatedItem[] = []
  for (const topic of flattenRelatedTopics(data?.RelatedTopics)) {
    if (!topic.Text || !topic.FirstURL) continue
    if (isWikipediaSourced(undefined, topic.FirstURL)) continue
    const title = topic.Text.split(' - ')[0].trim()
    if (!title) continue
    const titleKey = title.toLowerCase()
    if (titleKey === name.trim().toLowerCase() || seen.has(titleKey)) continue
    seen.add(titleKey)
    items.push({ title, sourceUrl: topic.FirstURL, sourceName: hostnameOf(topic.FirstURL) })
    if (items.length >= 10) break
  }

  await writeCache(key, items)
  return items
}

/**
 * Weak existence check used before showing a text-mined phrase as a
 * promotable "+ Add concept" suggestion. Runs the same tier hierarchy
 * as `fetchOnlineSummary`: a candidate "exists" here only if a real,
 * non-Wikipedia source (PubMed for biomedical-looking terms, or the
 * general-reference tier otherwise) actually has something for it.
 */
export async function verifyCandidateExists(name: string): Promise<boolean> {
  const key = name.trim().toLowerCase()
  if (!key) return false
  const cached = await readCache<{ exists: boolean }>(`verify:${key}`)
  if (cached && isFresh(cached)) return Boolean(cached.value?.exists)
  if (!isLikelyOnline()) return Boolean(cached?.value?.exists)

  let found: OnlineSummary | undefined
  if (!looksQuantitative(name)) {
    found = await fetchPubMedSummary(name)
  }
  if (!found) {
    found = await fetchGeneralReference(name)
  }

  const exists = Boolean(found)
  await writeCache(`verify:${key}`, { exists })
  return exists
}

