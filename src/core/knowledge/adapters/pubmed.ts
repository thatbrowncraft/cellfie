/**
 * core/knowledge/adapters/pubmed — NCBI E-utilities (esearch + esummary),
 * public/key-free interface (docs: https://www.ncbi.nlm.nih.gov/books/NBK25497/,
 * checked for this brief in 2026). At the time of writing, NCBI documents
 * a courtesy rate limit of 3 requests/second without an API key; this
 * adapter never sends more than two small requests per call (one
 * esearch, one esummary) and respects the shared circuit breaker on any
 * failure, so it stays well under that without needing a personal API
 * key to raise the limit.
 *
 * That "3 requests/second" figure is a documentation snapshot, not a
 * guarantee — NCBI (like any provider) can revise it at any time, and
 * this adapter's actual behavior does not depend on it being accurate.
 * The circuit breaker (`../circuitBreaker`) reacts to whatever NCBI's
 * response really says on any given request (429 → cooldown, other
 * failure → shorter cooldown) rather than this adapter trying to predict
 * or self-throttle to a specific number. If NCBI tightens or loosens
 * this limit tomorrow, no code here needs to change.
 *
 * Metadata only (titles, journal, date, PMID) — this adapter
 * deliberately does NOT call efetch for abstracts, to keep each
 * candidate-pool refresh to exactly two lightweight requests. Europe
 * PMC already covers PubMed's own abstracts (it mirrors PubMed/PMC
 * content) — this adapter exists to diversify the pool's ranking and to
 * give the app a working path to PubMed's own listing that keeps
 * working even if Europe PMC is unavailable, not to duplicate abstract
 * fetching.
 *
 * No key, no account, no billing surface.
 *
 * COMPLIANCE PATCH: every result from this adapter carries an explicit
 * `attributionNotice` (see `../attribution`) crediting NCBI/NLM as the
 * source of this metadata — shown by every UI surface that displays a
 * PubMed result. This is attribution only, not a new capability or a
 * new request to NCBI; nothing about what this adapter fetches changed.
 * This adapter never fetches or displays PubMed abstract text at all
 * (see the "Metadata only" note above), so it makes no claim, implicit
 * or otherwise, about whether PubMed abstracts are public domain.
 */
import { isSourceAvailable, reportRateLimited, reportSuccess, reportTransientFailure } from '../circuitBreaker'
import { NCBI_ATTRIBUTION_NOTICE } from '../attribution'
import { buildContextualQuery } from '../query'
import { decodeEntities } from '../text'
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from '../types'

const SOURCE_ID = 'pubmed'
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const TIMEOUT_MS = 8000

interface EsummaryResult {
  uid?: string
  title?: string
  fulljournalname?: string
  pubdate?: string
  elocationid?: string
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
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
    reportTransientFailure(SOURCE_ID)
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

export async function searchPubmed(context: KnowledgeQueryContext, limit = 8): Promise<NormalizedKnowledgeResult[]> {
  if (!isSourceAvailable(SOURCE_ID)) return []
  const query = buildContextualQuery(context)
  if (!query) return []

  const searchData = (await fetchJsonWithTimeout(
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(query)}`
  )) as { esearchresult?: { idlist?: string[] } } | undefined
  const ids = searchData?.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const summaryData = (await fetchJsonWithTimeout(
    `${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`
  )) as { result?: Record<string, EsummaryResult> } | undefined
  const resultMap = summaryData?.result
  if (!resultMap) return []

  reportSuccess(SOURCE_ID)
  const retrievedAt = Date.now()
  const out: NormalizedKnowledgeResult[] = []
  for (const id of ids) {
    const item = resultMap[id]
    if (!item?.title) continue
    const title = decodeEntities(item.title).trim()
    if (!title) continue
    out.push({
      id: `pmid:${id}`,
      source: 'pubmed',
      sourceLabel: 'PubMed (NCBI)',
      title,
      journal: item.fulljournalname,
      publicationDate: item.pubdate,
      contentAvailability: 'METADATA_ONLY',
      externalUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      pmid: id,
      attributionNotice: NCBI_ATTRIBUTION_NOTICE,
      relevanceScore: 0,
      retrievedAt
    })
  }
  return out
}
