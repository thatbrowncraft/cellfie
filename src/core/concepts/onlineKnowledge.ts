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
 *
 * CONCEPT 2.0 PHASE 1 — added `fetchOnlineKnowledge`, which is now the
 * PRIMARY feed for the Learn tab's Study Overview (see
 * modules/concepts/ConceptDetailPage.tsx). Instead of one flat
 * `extract` string, it returns an array of `OnlineKnowledgeSection`s —
 * every section still a direct, unedited excerpt from one real source
 * at one real URL, but now potentially several of them side by side
 * (e.g. a PubChem compound description AND a PubMed abstract). No
 * section heading is ever invented from the concept's topic ("Structure",
 * "Function", ...) — a heading is either the source's own framing
 * (e.g. "PubChem — ChEBI") or a generic, source-type label ("Research
 * abstract", "Overview"), never something implying the source itself
 * organized its content that way. Adds a third, key-free, CORS-friendly
 * tier — PubChem PUG REST — tried for every concept (not gated by a
 * keyword guess): it simply returns nothing for non-chemical names, so
 * no "if this concept is a chemical" branching is needed. PDF/library
 * material is intentionally NOT part of this function — `buildStudyOverview`
 * in extraction.ts is that separate, PDF-only path; as of Concept Hub
 * Refinement it is no longer called from the Learn tab (its badly-OCR'd
 * "From your library" rendering was removed), but the function itself is
 * untouched — nothing about a person's books or IndexedDB data changed.
 */

import { db } from '../db'

const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const CACHE_KEY_PREFIX = 'onlineKnowledgeCache:v4:'
const NCBI_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const EUROPEPMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest'

/**
 * Decodes the small set of HTML entities that genuinely show up in raw
 * NCBI/MeSH/Europe PMC text (scope notes, abstracts) — never applied to
 * anything this app writes itself. Deliberately narrow (a fixed
 * replace list, not a full HTML parser) since this only ever runs on
 * plain scientific text, never on markup this app needs to render.
 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&plusmn;/g, '±')
    .replace(/&alpha;/g, 'α')
    .replace(/&beta;/g, 'β')
    .replace(/&gamma;/g, 'γ')
    .replace(/&delta;/g, 'δ')
    .replace(/<[^>]*>/g, '')
}

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
// Concept 2.0 Phase 1 — structured, multi-source Learn tab content.
// ---------------------------------------------------------------------

export interface OnlineKnowledgeSection {
  /** Source-derived or generic-by-source-type label — never an invented topic heading (see file header). */
  heading: string
  /** Direct excerpt text from the source — never rewritten/paraphrased. */
  text: string
  sourceName: string
  sourceUrl: string
  /** True when `text` is a paper abstract rather than a general definition. */
  isAbstract: boolean
}

interface PubChemDescriptionInfo {
  Title?: string
  Description?: string
  DescriptionSourceName?: string
  DescriptionURL?: string
}

/**
 * Tier — PubChem PUG REST (`pubchem.ncbi.nlm.nih.gov`), key-free and
 * called for every concept name (no topic guess needed: a non-chemical
 * name simply resolves to no CID and this returns an empty array, which
 * is the honest, correct outcome — not a bug). When a compound match
 * exists, PubChem itself aggregates description text from several
 * curated sources (ChEBI, LOTUS, HSDB, ...) each with its own name/URL;
 * every one of those is surfaced as its own attributed section rather
 * than merged into one. Capped at 3 so one very well-annotated compound
 * can't crowd out everything else on the page.
 */
async function fetchPubChemSections(name: string): Promise<OnlineKnowledgeSection[]> {
  const term = encodeURIComponent(name.trim())
  const cidData = (await fetchJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${term}/cids/JSON`
  )) as { IdentifierList?: { CID?: number[] } } | undefined
  const cid = cidData?.IdentifierList?.CID?.[0]
  if (!cid) return []

  const descData = (await fetchJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`
  )) as { InformationList?: { Information?: PubChemDescriptionInfo[] } } | undefined

  const infos = descData?.InformationList?.Information ?? []
  const sections: OnlineKnowledgeSection[] = []
  const seenText = new Set<string>()
  for (const info of infos) {
    const text = info.Description?.trim()
    if (!text || seenText.has(text)) continue
    seenText.add(text)
    sections.push({
      heading: info.DescriptionSourceName ? `PubChem — ${info.DescriptionSourceName}` : 'PubChem',
      text,
      sourceName: info.DescriptionSourceName?.trim() || 'PubChem (NCBI)',
      sourceUrl: info.DescriptionURL?.trim() || `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      isAbstract: false
    })
    if (sections.length >= 3) break
  }
  return sections
}

/**
 * PRIMARY feed for the Learn tab's Study Overview. Book-First Learning
 * Engine: research literature (PubMed, Europe PMC) is deliberately NOT
 * collected here anymore — a research abstract must never stand in as
 * the primary Core Concept lesson just because no textbook/definition
 * tier had anything (see this file's own header comment, and
 * `researchReadings.ts`, where Europe PMC is correctly surfaced as
 * "Research & Further Reading" instead). This function now runs only
 * the PubChem tier (chemistry-specific, appropriately a Learn-tab
 * primary source per the source hierarchy) and, only if that found
 * nothing at all, the general-reference tier (Wikipedia-filtered) as a
 * last resort. Never throws; an empty array is the honest "nothing
 * reliable found" result the caller must show as such, not fill in
 * with invented text.
 */
export async function fetchOnlineKnowledge(name: string): Promise<OnlineKnowledgeSection[]> {
  const trimmed = name.trim()
  if (!trimmed) return []
  const key = `sections:${trimmed.toLowerCase()}`

  const cached = await readCache<OnlineKnowledgeSection[]>(key)
  if (cached && isFresh(cached)) return cached.value ?? []
  if (!isLikelyOnline()) return cached?.value ?? []

  const sections: OnlineKnowledgeSection[] = []

  sections.push(...(await fetchPubChemSections(trimmed)))

  if (sections.length === 0) {
    const general = await fetchGeneralReference(trimmed)
    if (general) {
      sections.push({
        heading: 'Overview',
        text: general.extract,
        sourceName: general.sourceName,
        sourceUrl: general.sourceUrl,
        isAbstract: false
      })
    }
  }

  await writeCache(key, sections)
  return sections
}

// ---------------------------------------------------------------------
// Detailed Study — MeSH classification & relationship tier.
//
// Reference: this mirrors the retrieval approach used by an earlier
// Google AI Studio prototype of the Concept Hub, rebuilt here against
// this file's own fetch/cache/fail-soft conventions (typed, no `any`,
// routed through `db.appSettings` like every other tier). NCBI's
// E-Utilities `mesh` database is free and key-free for this volume of
// traffic (3 req/sec without a key; see NLM's published usage policy).
//
// Purpose: PubChem/PubMed/DuckDuckGo (above) give a definition, but
// none of them give a concept's place in a controlled classification
// hierarchy, or a curated, typed set of related scientific terms.
// MeSH (Medical Subject Headings) is the one free, key-free NCBI
// resource that has both. Administrative/noisy MeSH qualifiers
// ("isolation", "statistics", "legislation and jurisprudence", ...)
// are filtered out before anything from this tier is surfaced —
// see `isNoiseTerm`.
// ---------------------------------------------------------------------

/** Administrative/procedural MeSH qualifiers that are real MeSH terms but never scientifically meaningful as a "relationship" on their own — filtered out before display, never shown to the person. */
const NOISE_MESH_TERMS = new Set([
  'isolation',
  'purification',
  'methods',
  'statistics',
  'trends',
  'standards',
  'instrumentation',
  'analysis',
  'history',
  'organization and administration',
  'economics',
  'legislation and jurisprudence',
  'statistics and numerical data',
  'supply and distribution',
  'classification',
  'ethics',
  'manpower',
  'adverse effects',
  'toxicity',
  'veterinary'
])

/** True if `term` is an administrative MeSH qualifier, or the concept's own name, rather than a scientifically meaningful related term. */
export function isNoiseMeshTerm(term: string, queryConcept: string): boolean {
  if (!term) return true
  const lower = term.toLowerCase().trim()
  const queryLower = queryConcept.toLowerCase().trim()
  if (NOISE_MESH_TERMS.has(lower)) return true
  if (lower === queryLower) return true
  if (lower.startsWith('isolation') || lower.startsWith('purification')) return true
  return false
}

export interface MeshRelationship {
  /** The related term's own name, decoded and trimmed — never invented. */
  targetName: string
  /** A short, source-derived relationship label (which MeSH link list this came from), never a specific biological claim this app authored. */
  relationshipType: 'is_a' | 'contains_subtype' | 'associated_with' | 'related_to'
  sourceName: string
  sourceUrl: string
}

export interface MeshClassification {
  meshId: string
  /** The authoritative definition text MeSH itself provides for this descriptor — used as the Detailed Study "Definition" tier when present. */
  scopeNote?: string
  parentName?: string
  childNames: string[]
  meshUI?: string
  yearIntroduced?: string
  subheadings: string[]
  relationships: MeshRelationship[]
  sourceName: string
  sourceUrl: string
}

interface MeshSummaryRecord {
  ds_recordtype?: string
  ds_meshterms?: string[]
  ds_scopenote?: string
  ds_meshui?: string
  ds_yearintroduced?: string
  ds_subheading?: string[]
  ds_idxlinks?: { parent?: string; children?: string[] }[]
  ds_seerelated?: string[]
  ds_headingmappedtolist?: string[]
}

/**
 * Detailed Study — Classification & Relationships tier. Searches the
 * MeSH database for a descriptor matching the concept name (falling
 * back to an unqualified search if the `[MeSH Terms]`-qualified one
 * finds nothing), then batch-fetches every parent/child/see-related/
 * mapped-heading id it names in one `esummary` call. Returns
 * `undefined` — never a guess — for concepts MeSH has no descriptor
 * for (most non-biomedical topics, and some biomedical ones too).
 * Cached per normalized name, same TTL as every other tier here.
 */
export async function fetchMeshClassification(name: string): Promise<MeshClassification | undefined> {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  const key = `mesh:${trimmed.toLowerCase()}`

  const cached = await readCache<MeshClassification>(key)
  if (cached && isFresh(cached)) return cached.value ?? undefined
  if (!isLikelyOnline()) return cached?.value ?? undefined

  const term = encodeURIComponent(trimmed)
  let searchData = (await fetchJson(
    `${NCBI_EUTILS_BASE}/esearch.fcgi?db=mesh&retmode=json&term=${term}%5BMeSH+Terms%5D`
  )) as { esearchresult?: { idlist?: string[] } } | undefined
  let idList = searchData?.esearchresult?.idlist ?? []

  if (idList.length === 0) {
    searchData = (await fetchJson(`${NCBI_EUTILS_BASE}/esearch.fcgi?db=mesh&retmode=json&term=${term}`)) as
      | { esearchresult?: { idlist?: string[] } }
      | undefined
    idList = searchData?.esearchresult?.idlist ?? []
  }

  if (idList.length === 0) {
    await writeCache(key, null)
    return undefined
  }

  const idBatch = idList.slice(0, 10).join(',')
  const summaryData = (await fetchJson(`${NCBI_EUTILS_BASE}/esummary.fcgi?db=mesh&id=${idBatch}&retmode=json`)) as
    | { result?: Record<string, MeshSummaryRecord> }
    | undefined

  const lowerConcept = trimmed.toLowerCase()
  let meshId: string | undefined
  let record: MeshSummaryRecord | undefined

  // Exact-name-match descriptor takes priority over the first hit.
  for (const id of idList) {
    const candidate = summaryData?.result?.[id]
    if (!candidate) continue
    const terms = (candidate.ds_meshterms ?? []).map((t) => t.toLowerCase())
    if (candidate.ds_recordtype === 'descriptor' && terms.includes(lowerConcept)) {
      meshId = id
      record = candidate
      break
    }
  }
  if (!record) {
    for (const id of idList) {
      const candidate = summaryData?.result?.[id]
      if (candidate && (candidate.ds_recordtype === 'descriptor' || candidate.ds_recordtype === 'supplemental-record')) {
        meshId = id
        record = candidate
        break
      }
    }
  }

  if (!record || !meshId) {
    await writeCache(key, null)
    return undefined
  }

  const sourceUrl = `https://www.ncbi.nlm.nih.gov/mesh/${meshId}`
  const sourceName = 'NCBI MeSH'
  const scopeNote = record.ds_scopenote ? decodeHTMLEntities(record.ds_scopenote) : undefined
  const subheadings = (record.ds_subheading ?? []).map((s) => decodeHTMLEntities(s))

  const parentIds = (record.ds_idxlinks ?? []).map((l) => l.parent).filter((v): v is string => Boolean(v))
  const childIds = (record.ds_idxlinks ?? []).flatMap((l) => l.children ?? []).slice(0, 6)
  const seeRelatedIds = (record.ds_seerelated ?? []).slice(0, 6)
  const mappedIds = (record.ds_headingmappedtolist ?? []).slice(0, 6)

  const relIdSpecs: { id: string; relationshipType: MeshRelationship['relationshipType'] }[] = [
    ...parentIds.map((id) => ({ id, relationshipType: 'is_a' as const })),
    ...childIds.map((id) => ({ id, relationshipType: 'contains_subtype' as const })),
    ...mappedIds.map((id) => ({ id, relationshipType: 'associated_with' as const })),
    ...seeRelatedIds.map((id) => ({ id, relationshipType: 'related_to' as const }))
  ]

  let parentName: string | undefined
  const childNames: string[] = []
  const relationships: MeshRelationship[] = []

  if (relIdSpecs.length > 0) {
    const uniqueIds = Array.from(new Set(relIdSpecs.map((r) => r.id)))
    const relSummaryData = (await fetchJson(
      `${NCBI_EUTILS_BASE}/esummary.fcgi?db=mesh&id=${uniqueIds.join(',')}&retmode=json`
    )) as { result?: Record<string, MeshSummaryRecord> } | undefined

    const seenTargets = new Set<string>()
    for (const spec of relIdSpecs) {
      const relRecord = relSummaryData?.result?.[spec.id]
      const rawName = relRecord?.ds_meshterms?.[0]
      if (!rawName) continue
      const cleanName = decodeHTMLEntities(rawName).trim()
      if (isNoiseMeshTerm(cleanName, trimmed)) continue
      const dedupeKey = cleanName.toLowerCase()
      if (seenTargets.has(dedupeKey)) continue
      seenTargets.add(dedupeKey)

      if (spec.relationshipType === 'is_a' && !parentName) parentName = cleanName
      if (spec.relationshipType === 'contains_subtype' && childNames.length < 6) childNames.push(cleanName)

      relationships.push({
        targetName: cleanName,
        relationshipType: spec.relationshipType,
        sourceName,
        sourceUrl: `https://www.ncbi.nlm.nih.gov/mesh/${spec.id}`
      })
      if (relationships.length >= 12) break
    }
  }

  const result: MeshClassification = {
    meshId,
    scopeNote,
    parentName,
    childNames,
    meshUI: record.ds_meshui,
    yearIntroduced: record.ds_yearintroduced,
    subheadings,
    relationships,
    sourceName,
    sourceUrl
  }

  await writeCache(key, result)
  return result
}

// ---------------------------------------------------------------------
// Detailed Study — Europe PMC literature tier.
//
// The official, free EBI endpoint (europepmc.org/RestfulWebService) —
// no key, no registration required for this volume of traffic. Do not
// confuse with the unrelated third-party paid "Europe PMC API" wrapper
// sometimes listed on commercial API marketplaces; this app only ever
// calls www.ebi.ac.uk directly.
// ---------------------------------------------------------------------

export interface EuropePmcArticle {
  title: string
  journal?: string
  pubYear?: string
  abstractText: string
  sourceName: string
  sourceUrl: string
}

interface EuropePmcResultItem {
  title?: string
  journalTitle?: string
  pubYear?: string
  abstractText?: string
  pmid?: string
  pmcid?: string
  id?: string
}

/**
 * Concept-in-title relevance score, deliberately simple and generic
 * (never keyed to what the concept IS): rewards the concept name
 * appearing in the title (more so at the very start) over merely
 * appearing somewhere in the abstract, so a paper that's actually
 * ABOUT the concept ranks above one that just mentions it in passing.
 */
function scoreArticleRelevance(item: EuropePmcResultItem, name: string): number {
  const title = decodeHTMLEntities(item.title ?? '').toLowerCase()
  const abstract = decodeHTMLEntities(item.abstractText ?? '').toLowerCase()
  const lowerName = name.toLowerCase().trim()
  if (!title) return -100
  let score = 0
  if (title.includes(lowerName)) {
    score += 25
    if (title.startsWith(lowerName)) score += 10
  }
  if (abstract.includes(lowerName)) score += 5
  return score
}

// ---------------------------------------------------------------------
// Generality / specialization scoring.
//
// A paper's title containing the concept's name is not the same as a
// paper being an appropriate GENERAL/foundational source for that
// concept. "DNA" appears in the title of thousands of papers about a
// single disease pathway, a single gene fusion, a single patient
// cohort — real, valid science, but not what Detailed Study's
// Definition/Structure/Mechanism modules should teach from. This is a
// generic, vocabulary-level heuristic (the words below are the
// standard shape of clinical/molecular-pathway paper titles in
// general, not anything specific to any one concept), so it applies
// the same way to any concept name Cellfie is asked about.
// ---------------------------------------------------------------------

const GENERALITY_TITLE_RE =
  /\b(overview|review|introduction to|fundamentals?|principles? of|structure and function|biology of|basics? of|what is|primer)\b/i
const SPECIALIZED_MARKER_RE =
  /\b(case report|cohort|randomi[sz]ed|clinical trial|patients? with|in vitro|in vivo|knockout|xenograft|mutant|fusion|syndrome|carcinoma|lymphoma|neoplasm|tumou?r|biomarker|prognosis|prognostic|subtype|genotype|phenotype of)\b/gi
const ACRONYM_RE = /\b[A-Z0-9]{2,6}\b/g

/**
 * Counts ALLCAPS/short acronym tokens in the ORIGINAL-CASE title that
 * aren't the concept's own name and aren't ordinary short words — a
 * title dense with these (gene/protein/pathway shorthand: "BCL6",
 * "MBD1", "DLBCL") is the shape of a narrow molecular/clinical paper,
 * not a general teaching source.
 */
function countForeignAcronyms(originalTitle: string, name: string): number {
  const lowerName = name.toLowerCase()
  const matches = originalTitle.match(ACRONYM_RE) ?? []
  return matches.filter((m) => m.toLowerCase() !== lowerName && !/^(AND|THE|FOR|WITH|FROM|VIA)$/i.test(m)).length
}

/**
 * Adjusts a base relevance score down for signals that a paper is a
 * narrow clinical/molecular-pathway study (not appropriate as a
 * foundational educational source for a general concept) and up for
 * signals that it's a general/review-style treatment. Returns the
 * adjusted score; callers apply a minimum-acceptance threshold on top
 * of this so a specialized paper doesn't just rank lower — it's
 * excluded outright from foundational sections.
 */
function scoreArticleGenerality(item: EuropePmcResultItem, name: string, baseScore: number): number {
  const originalTitle = decodeHTMLEntities(item.title ?? '')
  const abstract = decodeHTMLEntities(item.abstractText ?? '')
  let score = baseScore

  const foreignAcronyms = countForeignAcronyms(originalTitle, name)
  if (foreignAcronyms >= 3) score -= 10
  else if (foreignAcronyms === 2) score -= 5

  const specializedInTitle = (originalTitle.match(SPECIALIZED_MARKER_RE) ?? []).length
  const specializedInAbstractStart = (abstract.slice(0, 240).match(SPECIALIZED_MARKER_RE) ?? []).length
  score -= specializedInTitle * 6
  score -= specializedInAbstractStart * 2

  if (GENERALITY_TITLE_RE.test(originalTitle)) score += 12

  return score
}

/** Minimum adjusted-generality score for a paper to be usable as foundational (Structure/Mechanism) content — see scoreArticleGenerality. Below this, the paper is excluded rather than ranked lower, per "relevance is more important than completeness". */
const GENERALITY_ACCEPT_THRESHOLD = 20

/**
 * Defense-in-depth: `fetchEuropePmcArticles` already excludes
 * over-specialized papers before returning, but detailedStudy.ts's
 * Structure/Mechanism module builders shouldn't have to TRUST that
 * every `EuropePmcArticle[]` they're ever handed came from that exact
 * call path (a future refactor, a stale cache shape, a test) — so this
 * is exported as a second, independent check callers can run again
 * right where the article is actually used as foundational content.
 * Same scoring, same threshold; just callable without an `item`-shaped
 * object.
 */
export function isArticleTooSpecialized(title: string, abstractText: string, name: string): boolean {
  const score = scoreArticleGenerality({ title, abstractText }, name, scoreArticleRelevance({ title, abstractText }, name))
  return score < GENERALITY_ACCEPT_THRESHOLD
}

/**
 * Detailed Study — additional literature tier alongside the existing
 * PubMed single-best-hit tier above. Fetches up to 12 candidates from
 * Europe PMC, scores them for concept relevance (see
 * `scoreArticleRelevance`), and returns the top matches with a real
 * abstract — never more than 4, so this concept's Structure/Mechanism
 * modules have distinct real excerpts to choose from without one
 * heavily-published concept crowding out everything else. Returns an
 * empty array (never invents) when nothing usable is found.
 */
export async function fetchEuropePmcArticles(name: string): Promise<EuropePmcArticle[]> {
  const trimmed = name.trim()
  if (!trimmed) return []
  const key = `europepmc:${trimmed.toLowerCase()}`

  const cached = await readCache<EuropePmcArticle[]>(key)
  if (cached && isFresh(cached)) return cached.value ?? []
  if (!isLikelyOnline()) return cached?.value ?? []

  const term = encodeURIComponent(`"${trimmed}"`)
  const data = (await fetchJson(
    `${EUROPEPMC_BASE}/search?query=${term}&resultType=core&format=json&pageSize=12`
  )) as { resultList?: { result?: EuropePmcResultItem[] } } | undefined

  const items = data?.resultList?.result ?? []
  const withScores = items
    .map((item) => {
      const relevance = scoreArticleRelevance(item, trimmed)
      return { item, score: scoreArticleGenerality(item, trimmed, relevance) }
    })
    // Relevance is more important than completeness (see this file's
    // fallback rules): a paper must both mention the concept AND clear
    // the generality bar to be treated as a foundational source. A
    // paper that fails this is simply not returned — never force-fit
    // as "the DNA paper" just because it was the best of a bad set.
    .filter((s) => s.score >= GENERALITY_ACCEPT_THRESHOLD && s.item.abstractText)
    .sort((a, b) => b.score - a.score)

  const results: EuropePmcArticle[] = []
  const seenAbstracts = new Set<string>()
  for (const { item } of withScores) {
    const abstractText = decodeHTMLEntities(item.abstractText ?? '').trim()
    if (!abstractText || seenAbstracts.has(abstractText)) continue
    seenAbstracts.add(abstractText)
    const sourceUrl = item.pmcid
      ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${item.pmcid}/`
      : item.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`
        : `https://europepmc.org/article/MED/${item.id ?? ''}`
    results.push({
      title: decodeHTMLEntities(item.title ?? '').trim(),
      journal: item.journalTitle?.trim(),
      pubYear: item.pubYear?.trim(),
      abstractText,
      sourceName: 'Europe PMC',
      sourceUrl
    })
    if (results.length >= 4) break
  }

  await writeCache(key, results)
  return results
}

// ---------------------------------------------------------------------
// Concept Hub Refinement §3/§4/§15 — this file's PubMed co-occurrence
// "two names in one paper" tier (formerly `fetchScientificRelationEvidence`)
// has been removed. Literature co-occurrence is NOT evidence that the
// person has connected two concepts, and this app must never again
// write it into ConceptRelation — see core/concepts/service.ts's
// `purgeAutomaticScientificRelations` for the corresponding cleanup of
// rows this tier wrote in earlier versions. MeSH-based relationship
// data (fetchMeshClassification, above) remains available to Detailed
// Study's "Important Functional Relationships" module ONLY — it is
// never persisted as a ConceptRelation.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Concept 2.0 Phase 4 — online scientific Visuals. Same rules as every
// other tier in this file: no AI-generated images, no Wikipedia/
// Wikimedia, no fabricated diagrams. Every returned image is a REAL
// image fetched from a REAL scientific source URL, with a caption and
// source attribution — never a generic stock/placeholder graphic. When
// nothing reliable is found the array is simply empty; the caller must
// show "No suitable scientific visual found yet.", not a placeholder.
// ---------------------------------------------------------------------

export interface VisualReference {
  imageUrl: string
  caption: string
  sourceName: string
  sourceUrl: string
}

/**
 * Tier — PubChem structure images. Reuses the same key-free CID lookup
 * as the Learn tab's PubChem section (fetchPubChemSections): if `name`
 * resolves to a real compound, PubChem's own PNG-rendering endpoint
 * returns its actual 2D structure diagram — an image PubChem itself
 * generates from the molecule's real structure data, not something this
 * app draws or guesses. `<img>` tags load cross-origin regardless of
 * CORS headers, so this works even though the JSON lookup above it
 * might not (see fetchJson's graceful no-CORS fallback).
 */
async function fetchPubChemVisual(name: string): Promise<VisualReference | undefined> {
  const term = encodeURIComponent(name.trim())
  const cidData = (await fetchJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${term}/cids/JSON`
  )) as { IdentifierList?: { CID?: number[] } } | undefined
  const cid = cidData?.IdentifierList?.CID?.[0]
  if (!cid) return undefined
  return {
    imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=300x300`,
    caption: `2D chemical structure of ${name}`,
    sourceName: 'PubChem (NCBI)',
    sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
  }
}

/**
 * Tier — Open-i (US National Library of Medicine's biomedical image
 * search — openi.nlm.nih.gov, not Wikipedia/Wikimedia). Real figures
 * pulled from real published biomedical literature, each with its own
 * article title as caption and a link back to the source article.
 * NOTE: this environment's own outbound network allowlist doesn't
 * include nlm.nih.gov, so this parser could not be exercised against a
 * live response while building it — it's written defensively against
 * Open-i's documented JSON shape and simply returns nothing (never
 * throws, never fabricates a caption) if a field it expects isn't
 * there. Worth a real smoke test once this is deployed somewhere that
 * can actually reach the endpoint.
 */
async function fetchOpenIVisuals(name: string): Promise<VisualReference[]> {
  const term = encodeURIComponent(name.trim())
  const data = (await fetchJson(`https://openi.nlm.nih.gov/api/search?query=${term}&it=xg,c,m,mc,p,ph,u&m=1&n=3`)) as
    | {
        list?: Array<{
          title?: string
          journal?: string
          articleURL?: string
          imgLarge?: string
          imgThumb?: string
          image?: { large?: { url?: string }; thumb?: { url?: string } }
        }>
      }
    | undefined

  const list = data?.list ?? []
  const results: VisualReference[] = []
  for (const item of list) {
    const rawPath = item.imgLarge ?? item.image?.large?.url ?? item.imgThumb ?? item.image?.thumb?.url
    if (!rawPath) continue
    const imageUrl = rawPath.startsWith('http') ? rawPath : `https://openi.nlm.nih.gov${rawPath}`
    const caption = item.title?.trim()
    if (!caption) continue
    results.push({
      imageUrl,
      caption,
      sourceName: item.journal?.trim() ? `${item.journal.trim()} via Open-i (NLM)` : 'Open-i (National Library of Medicine)',
      sourceUrl: item.articleURL?.trim() || 'https://openi.nlm.nih.gov'
    })
  }
  return results
}

/**
 * PRIMARY feed for the Visuals tab. Tries PubChem (structure diagrams,
 * for chemical concepts) and Open-i (real figures from real biomedical
 * papers) and returns whatever real, attributed images either one
 * actually found — never more than 4, so one heavily-annotated
 * concept can't overwhelm the tab. An empty array is the honest,
 * expected result for most non-biomedical/non-chemical concepts under
 * this no-AI, no-Wikipedia, key-free design — not a bug to work around
 * with a placeholder.
 */
export async function fetchVisualReferences(name: string): Promise<VisualReference[]> {
  const trimmed = name.trim()
  if (!trimmed) return []
  const key = `visuals:${trimmed.toLowerCase()}`

  const cached = await readCache<VisualReference[]>(key)
  if (cached && isFresh(cached)) return cached.value ?? []
  if (!isLikelyOnline()) return cached?.value ?? []

  const results: VisualReference[] = []
  const pubchemVisual = await fetchPubChemVisual(trimmed)
  if (pubchemVisual) results.push(pubchemVisual)
  results.push(...(await fetchOpenIVisuals(trimmed)))

  const capped = results.slice(0, 4)
  await writeCache(key, capped)
  return capped
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

