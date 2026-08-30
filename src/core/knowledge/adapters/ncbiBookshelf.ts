/**
 * core/knowledge/adapters/ncbiBookshelf — NCBI Bookshelf, queried through
 * NCBI E-utilities (esearch + esummary against `db=books`), the exact
 * same public, key-free interface `./pubmed.ts` already uses against
 * `db=pubmed` (docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/ for
 * E-utilities generally; Bookshelf is simply another Entrez database on
 * the same service — checked for this brief in 2026). No key, no
 * account, no billing surface — identical guarantee to every other
 * adapter in this module.
 *
 * WHY THIS ADAPTER REPLACES CROSSREF: Crossref is a scholarly-metadata
 * registry — it reliably returns a DOI, a title, and little else, which
 * meant Comparison Studio's "Online Knowledge" enrichment often surfaced
 * a bare paper title with no explanatory content behind it (Knowledge
 * Layer brief, "Replace Crossref" §1-§3). NCBI Bookshelf indexes
 * full biomedical/life-science books, textbooks, and reference works —
 * a chapter or section title from it ("Catalysis by Enzymes", "Enzyme
 * Structure and Function") is itself close to the educational framing
 * Cellfie's enrichment panels need, and it sits squarely in Cellfie's
 * actual scientific scope (microbiology, biochemistry, genetics,
 * molecular biology). Crossref's adapter file has been deleted outright
 * — not demoted, not kept as a hidden fallback (brief §2).
 *
 * SCOPE, DELIBERATELY CONSERVATIVE (brief §11/§13/§25): this adapter
 * only calls esearch + esummary — the same two lightweight requests
 * `./pubmed.ts` makes — and never calls efetch to pull actual book/
 * chapter body text. Two reasons:
 *
 *   1. Copyright safety (brief §13): NCBI Bookshelf aggregates many
 *      publishers' books under a mix of licenses. Reliably determining
 *      "is this specific chapter's body text safe to reproduce" from
 *      the E-utilities metadata response is not something this adapter
 *      can do — the same conservative posture `../attribution.ts`
 *      already takes for Europe PMC/PubMed abstracts. Rather than build
 *      a textbook-scraping path that risks reproducing chapter content
 *      it can't verify the rights to, this adapter reports honestly:
 *      `contentAvailability: 'METADATA_ONLY'` — title, book, and a
 *      direct link to read the chapter on NCBI's own site.
 *   2. Request budget (brief §19/§25): matching PubMed's own two-request
 *      shape (one esearch, one esummary) keeps one enrichment click
 *      bounded, with no new dependency and no new request pattern to
 *      reason about alongside the existing circuit breaker.
 *
 * A METADATA_ONLY Bookshelf chapter title is still a large improvement
 * over a METADATA_ONLY Crossref paper title for this app's purpose: it
 * names a specific educational topic ("Enzymes", "Protein Structure")
 * rather than a specific paper, and `core/knowledge/rank.ts`'s own
 * subject-term matching already rewards exactly that kind of on-topic
 * title regardless of provider.
 *
 * FIELD-NAME DEFENSIVENESS: E-utilities' JSON `esummary` output for
 * `db=books` is far less commonly documented than `db=pubmed`'s. Rather
 * than assume one exact casing/shape for every field and silently drop
 * every result if that assumption is wrong, `pickString` below checks a
 * short list of plausible key spellings per field and only ever uses
 * `uid` (which every Entrez `esummary` response reliably includes) to
 * build the external URL — the NCBI Bookshelf UID is the numeric part
 * of its "NBK" accession, so `https://www.ncbi.nlm.nih.gov/books/NBK{uid}/`
 * is stable and does not depend on any of the flexibly-parsed fields.
 */
import { isSourceAvailable, reportRateLimited, reportSuccess, reportTransientFailure } from '../circuitBreaker'
import { NCBI_BOOKSHELF_ATTRIBUTION_NOTICE } from '../attribution'
import { buildContextualQuery } from '../query'
import { decodeEntities } from '../text'
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from '../types'

const SOURCE_ID = 'ncbiBookshelf'
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const TIMEOUT_MS = 8000

type EsummaryRecord = Record<string, unknown>

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

/** Checks a short list of plausible key spellings (case-insensitive) on a loosely-typed esummary record and returns the first non-empty string found. Never throws on an unexpected shape — an unmatched field is simply left undefined, same as a genuinely absent one. */
function pickString(record: EsummaryRecord, candidates: string[]): string | undefined {
  const lowerKeys = new Map(Object.keys(record).map((k) => [k.toLowerCase(), k]))
  for (const candidate of candidates) {
    const actualKey = lowerKeys.get(candidate.toLowerCase())
    if (!actualKey) continue
    const value = record[actualKey]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

export async function searchBookshelf(context: KnowledgeQueryContext, limit = 8): Promise<NormalizedKnowledgeResult[]> {
  if (!isSourceAvailable(SOURCE_ID)) return []
  const query = buildContextualQuery(context)
  if (!query) return []

  const searchData = (await fetchJsonWithTimeout(
    `${BASE}/esearch.fcgi?db=books&retmode=json&retmax=${limit}&term=${encodeURIComponent(query)}`
  )) as { esearchresult?: { idlist?: string[] } } | undefined
  const ids = searchData?.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const summaryData = (await fetchJsonWithTimeout(
    `${BASE}/esummary.fcgi?db=books&retmode=json&id=${ids.join(',')}`
  )) as { result?: Record<string, EsummaryRecord> } | undefined
  const resultMap = summaryData?.result
  if (!resultMap) return []

  reportSuccess(SOURCE_ID)
  const retrievedAt = Date.now()
  const out: NormalizedKnowledgeResult[] = []
  for (const id of ids) {
    const item = resultMap[id]
    if (!item) continue
    const normalized = normalize(id, item, retrievedAt)
    if (normalized) out.push(normalized)
  }
  return out
}

function normalize(uid: string, item: EsummaryRecord, retrievedAt: number): NormalizedKnowledgeResult | undefined {
  const rawTitle = pickString(item, ['title', 'booktitle', 'chaptertitle', 'sectiontitle'])
  if (!rawTitle) return undefined
  const title = decodeEntities(rawTitle).trim()
  if (!title) return undefined

  const rawBook = pickString(item, ['book', 'booktitle', 'series'])
  const book = rawBook && rawBook !== title ? decodeEntities(rawBook).trim() : undefined
  const publicationDate = pickString(item, ['pubdate', 'sortpubdate', 'epubdate'])

  return {
    id: `nbk:${uid}`,
    source: 'ncbiBookshelf',
    sourceLabel: 'NCBI Bookshelf',
    title,
    // Repurposes the shared `journal` field for the parent book's title
    // when it differs from the chapter/section title — there's no
    // book-specific field on `NormalizedKnowledgeResult`, and "which
    // book this chapter is from" is the closest equivalent of a journal
    // name for this provider.
    journal: book,
    publicationDate,
    // Deliberately never populated by this adapter — see this file's
    // own module docstring ("SCOPE, DELIBERATELY CONSERVATIVE") for why
    // body text is never fetched or reproduced here.
    contentAvailability: 'METADATA_ONLY',
    externalUrl: `https://www.ncbi.nlm.nih.gov/books/NBK${uid}/`,
    attributionNotice: NCBI_BOOKSHELF_ATTRIBUTION_NOTICE,
    relevanceScore: 0,
    retrievedAt
  }
}
