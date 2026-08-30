/**
 * core/knowledge/adapters/europepmc — Europe PMC (EMBL-EBI), public REST
 * API, no key/account required (docs: https://europepmc.org/RestfulWebService,
 * checked for this brief in 2026). Strong for biomedical/life-science
 * literature; frequently abstract-only, occasionally links to a real
 * open-access full text via PMC.
 *
 * This adapter returns a POOL of candidates (up to `limit`), not a
 * single "best" result — the old single-result behavior (only ever one
 * Europe PMC abstract, repeated on every "Search Again") is exactly the
 * bug this Knowledge Layer repair fixes. Ranking/selection happens once
 * centrally in rank.ts/index.ts across ALL providers, not per-adapter.
 *
 * Financial/credential safety: no API key, no account, no billing
 * surface exists for this provider — a request either succeeds,
 * fails, or is rate-limited; there is no "paid tier" code path here at
 * all, so none can accidentally be added later without a much larger,
 * obvious change to this file.
 *
 * COMPLIANCE PATCH (final correction): `abstractText` here is usually
 * the depositing publisher's own text, not something Europe PMC itself
 * owns the rights to. This adapter does NOT assume a short excerpt is
 * automatically safe to show just because it's short — `item.license`
 * (when Europe PMC reports one) is checked via
 * `resolveAbstractPresentation` (see `../attribution`), and the
 * abstract text is only ever displayed when that license is one this
 * app recognizes as clearly permitting reuse. Otherwise the text is
 * withheld entirely and a notice explains that the abstract is
 * available at the source instead. Full text was already, and remains,
 * a link to the provider's own page (`fullTextUrl`) rather than
 * fetched/reproduced content. Metadata (title, authors, journal, date,
 * identifiers) is untouched: that part is freely reusable factual data,
 * not the publisher's prose.
 */
import { isSourceAvailable, reportRateLimited, reportSuccess, reportTransientFailure } from '../circuitBreaker'
import { resolveAbstractPresentation } from '../attribution'
import { buildContextualQuery } from '../query'
import { decodeEntities } from '../text'
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from '../types'

const SOURCE_ID = 'europepmc'
const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest'
const TIMEOUT_MS = 8000

interface EuropePmcItem {
  id?: string
  title?: string
  abstractText?: string
  journalTitle?: string
  pubYear?: string
  firstPublicationDate?: string
  authorString?: string
  doi?: string
  pmid?: string
  pmcid?: string
  isOpenAccess?: string
  license?: string
}

export async function searchEuropePmc(context: KnowledgeQueryContext, limit = 10): Promise<NormalizedKnowledgeResult[]> {
  if (!isSourceAvailable(SOURCE_ID)) return []
  const query = buildContextualQuery(context)
  if (!query) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = `${BASE}/search?query=${encodeURIComponent(query)}&resultType=core&format=json&pageSize=${limit}`
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      reportRateLimited(SOURCE_ID)
      return []
    }
    if (!res.ok) {
      reportTransientFailure(SOURCE_ID)
      return []
    }
    const data = (await res.json()) as { resultList?: { result?: EuropePmcItem[] } }
    reportSuccess(SOURCE_ID)
    const items = data?.resultList?.result ?? []
    const retrievedAt = Date.now()
    const out: NormalizedKnowledgeResult[] = []
    for (const item of items) {
      const normalized = normalize(item, retrievedAt)
      if (normalized) out.push(normalized)
    }
    return out
  } catch {
    // Network failure, timeout, or CORS rejection — never thrown further.
    reportTransientFailure(SOURCE_ID)
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function normalize(item: EuropePmcItem, retrievedAt: number): NormalizedKnowledgeResult | undefined {
  const title = decodeEntities(item.title ?? '').trim()
  if (!title) return undefined

  const rawAbstract = item.abstractText ? decodeEntities(item.abstractText).trim() : undefined
  const presentation = resolveAbstractPresentation(rawAbstract, item.license)
  const abstract = presentation.text
  const doi = item.doi?.toLowerCase()
  const pmid = item.pmid
  const pmcid = item.pmcid
  const isOpenAccess = item.isOpenAccess === 'Y'

  const externalUrl = pmcid
    ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`
    : pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : `https://europepmc.org/article/MED/${item.id ?? ''}`

  return {
    id: doi ? `doi:${doi}` : pmid ? `pmid:${pmid}` : pmcid ? `pmcid:${pmcid.toLowerCase()}` : `europepmc:${item.id ?? title}`,
    source: 'europepmc',
    sourceLabel: 'Europe PMC',
    title,
    authors: item.authorString ? item.authorString.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
    journal: item.journalTitle?.trim(),
    publicationDate: item.firstPublicationDate || item.pubYear,
    abstract,
    contentAvailability: abstract ? 'ABSTRACT' : 'METADATA_ONLY',
    fullTextUrl: isOpenAccess && pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/` : undefined,
    externalUrl,
    doi,
    pmid,
    pmcid,
    license: item.license,
    attributionNotice: presentation.notice,
    relevanceScore: 0,
    retrievedAt
  }
}
