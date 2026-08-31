/**
 * core/knowledge/adapters/wikipedia — Wikipedia's MediaWiki Action API
 * (docs: https://www.mediawiki.org/wiki/API:Main_page,
 * https://www.mediawiki.org/wiki/API:Cross-site_requests — checked for
 * this brief in 2026), the genuinely educational source the
 * "stop patching the symptom" architecture brief asked for.
 *
 * WHY THIS EXISTS: Europe PMC/PubMed/NCBI Bookshelf are all scholarly-
 * literature indexes — good for citations, bad at general definitional
 * "what is an enzyme" content, and (Bookshelf/PubMed) metadata-only by
 * design. That meant the pool for a general comparison topic like
 * "Enzymes vs Proteins" could easily contain ZERO enrichment-usable
 * candidates after the architecture fix stopped metadata records from
 * masquerading as content — exactly the "no usable excerpt found by the
 * third Search Again" report that fix surfaced honestly instead of
 * hiding. This adapter is what actually solves that, not just reports
 * it: a real source of genuine explanatory paragraphs for exactly the
 * kind of general biology/microbiology/biochemistry topic Cellfie needs.
 *
 * FINANCIAL/CREDENTIAL SAFETY — the specific concern this brief raised
 * (repo is public, so ANY key would be exposed to every reader of it):
 *   - No API key, ever. The MediaWiki Action API's anonymous, read-only
 *     endpoints have never required one and are not moving to one —
 *     free, unmetered API access to Wikipedia's content is a core part
 *     of the Wikimedia Foundation's nonprofit mission, not a trial tier
 *     of a commercial product that could be discontinued or monetized.
 *     There is no "Wikipedia API pricing page" because there is no paid
 *     tier for this endpoint to fall through to.
 *   - No account, no OAuth, no billing surface — this file makes plain,
 *     anonymous `fetch()` calls with `origin=*`, MediaWiki's documented
 *     mechanism for unauthenticated CORS access from any static site
 *     (see API:Cross-site_requests above) — the same mechanism countless
 *     browser extensions and static sites already rely on.
 *   - Same fail-closed guarantee as every other adapter here: the
 *     circuit breaker reacts to a 429/5xx by backing off, nothing here
 *     retries in a loop, and there is no code path that could ever
 *     attach a credential or a charge to a request.
 *
 * LICENSE — Wikipedia article text is CC BY-SA 4.0 (plus GFDL), a fixed
 * platform-wide fact, not a per-item unknown the way a journal article's
 * abstract license is. That's why this adapter does NOT route through
 * `resolveAbstractPresentation`/`assessLicense` (`../attribution.ts`) —
 * those exist specifically to handle a license that varies per result
 * and is often absent or unrecognized; here it's always the same known,
 * clearly-permissive license, attributed via `WIKIPEDIA_ATTRIBUTION_NOTICE`
 * on every result this adapter returns.
 *
 * SCOPE: intro-section plain text only (`exintro`), never the full
 * article — still a genuine multi-sentence educational excerpt (not a
 * bare title), while staying conservative/non-displacive per this
 * codebase's general posture even though the license would legally
 * permit reproducing the whole article.
 *
 * TWO REQUESTS, not one: `generator=search` combined with `prop=extracts`
 * in a single call would be simpler, but the JSON response's `query.pages`
 * object is keyed by numeric page id — JavaScript engines always iterate
 * numeric-like object keys in ascending numeric order, NOT insertion
 * order, silently discarding the search engine's actual relevance
 * ranking. Splitting into `list=search` (an ARRAY, whose order is
 * reliably preserved) followed by one `prop=extracts` lookup for exactly
 * those page ids avoids that trap. This still matches `pubmed.ts`/
 * `ncbiBookshelf.ts`'s own two-lightweight-requests shape.
 */
import { isSourceAvailable, reportRateLimited, reportSuccess, reportTransientFailure } from '../circuitBreaker'
import { WIKIPEDIA_ATTRIBUTION_NOTICE, conservativeAbstractExcerpt } from '../attribution'
import { decodeEntities } from '../text'
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from '../types'

const SOURCE_ID = 'wikipedia'
const BASE = 'https://en.wikipedia.org/w/api.php'
const TIMEOUT_MS = 8000
/** Generous relative to the journal-literature adapters' 280-char cap (`../attribution.ts`) — a genuinely permissively-licensed encyclopedia intro is worth more than a token snippet, while still stopping well short of the full article (still just the intro section to begin with). */
const MAX_EXCERPT_CHARS = 700
/**
 * v1.0.0 release audit: the WMF User-Agent policy asks every client to
 * identify itself, but browser JS can't set the real `User-Agent`
 * header — `Api-User-Agent` is MediaWiki's documented substitute for
 * exactly that case (see foundation.wikimedia.org/wiki/Policy:Wikimedia_
 * Foundation_User-Agent_Policy, "browser-based applications ... are
 * encouraged to include the Api-User-Agent header"). It's safe to add
 * here: `Api-User-Agent` has been in MediaWiki core's CORS allow-list
 * (`$wgAllowedCorsHeaders`) since 1.35.11/1.38.7/1.39.4, so it won't be
 * blocked by the `origin=*` preflight this adapter already relies on.
 * Static, non-personal identifier only — no email, no secret, nothing
 * that could ever create a billing or credential surface.
 */
const API_USER_AGENT = 'Cellfie/1.0 (https://github.com/thatbrowncraft/cellfie)'

interface SearchHit {
  pageid?: number
  title?: string
}

interface ExtractPage {
  pageid?: number
  title?: string
  extract?: string
  fullurl?: string
  missing?: string
  ns?: number
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'Api-User-Agent': API_USER_AGENT } })
    if (res.status === 429) {
      reportRateLimited(SOURCE_ID)
      return undefined
    }
    if (!res.ok) {
      reportTransientFailure(SOURCE_ID)
      return undefined
    }
    return await res.json()
  } catch {
    // Network failure, timeout, or CORS rejection — never thrown further.
    reportTransientFailure(SOURCE_ID)
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

export async function searchWikipedia(context: KnowledgeQueryContext, limit = 6): Promise<NormalizedKnowledgeResult[]> {
  if (!isSourceAvailable(SOURCE_ID)) return []

  // Provider-specific query (brief §14): Wikipedia article titles are
  // concept names ("Enzyme", "Gram staining"), not full aspect phrases —
  // `aspect`/`comparedAgainst` would only dilute a title/full-text search
  // here, so this adapter searches on `subject` alone, unlike the
  // literature adapters' `buildProviderQuery` (subject + aspect).
  const query = context.subject.trim()
  if (!query) return []

  const searchUrl =
    `${BASE}?action=query&list=search&format=json&origin=*` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&srnamespace=0`
  const searchData = (await fetchJsonWithTimeout(searchUrl)) as { query?: { search?: SearchHit[] } } | undefined
  const hits = (searchData?.query?.search ?? []).filter((h): h is Required<SearchHit> => typeof h.pageid === 'number')
  if (hits.length === 0) return []

  const pageIds = hits.map((h) => h.pageid).join('|')
  const extractUrl =
    `${BASE}?action=query&format=json&origin=*&pageids=${pageIds}` +
    `&prop=extracts|info&exintro=1&explaintext=1&exsentences=10&inprop=url&redirects=1`
  const extractData = (await fetchJsonWithTimeout(extractUrl)) as { query?: { pages?: Record<string, ExtractPage> } } | undefined
  const pages = extractData?.query?.pages
  if (!pages) return []

  reportSuccess(SOURCE_ID)
  const retrievedAt = Date.now()
  const out: NormalizedKnowledgeResult[] = []
  // Iterate the ORIGINAL search-rank order (the array from list=search),
  // not `Object.keys(pages)` — see module docstring on numeric-key
  // reordering.
  for (const hit of hits) {
    const page = pages[String(hit.pageid)]
    const normalized = normalize(page, retrievedAt)
    if (normalized) out.push(normalized)
  }
  return out
}

function normalize(page: ExtractPage | undefined, retrievedAt: number): NormalizedKnowledgeResult | undefined {
  if (!page || page.missing !== undefined || page.ns !== 0) return undefined
  const title = decodeEntities(page.title ?? '').trim()
  if (!title || !page.pageid) return undefined

  const rawExtract = page.extract ? decodeEntities(page.extract).trim() : undefined
  const abstract = conservativeAbstractExcerpt(rawExtract, MAX_EXCERPT_CHARS)
  const externalUrl = page.fullurl?.trim() || `https://en.wikipedia.org/?curid=${page.pageid}`

  return {
    id: `wikipedia:${page.pageid}`,
    source: 'wikipedia',
    sourceLabel: 'Wikipedia',
    title,
    publicationDate: undefined,
    abstract,
    // A page with no extract at all (rare — e.g. a disambiguation stub)
    // is honestly METADATA_ONLY, exactly like every other adapter's
    // no-body-text case; never invented, never backfilled from the title.
    contentAvailability: abstract ? 'ABSTRACT' : 'METADATA_ONLY',
    externalUrl,
    license: 'CC BY-SA 4.0',
    attributionNotice: WIKIPEDIA_ATTRIBUTION_NOTICE,
    relevanceScore: 0,
    retrievedAt
  }
}
