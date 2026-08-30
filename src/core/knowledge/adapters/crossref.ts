/**
 * core/knowledge/adapters/crossref — Crossref public REST API
 * (api.crossref.org), no key/account required (docs:
 * https://api.crossref.org/swagger-ui/index.html, checked for this
 * brief in 2026). Crossref is a scholarly-metadata registry, not a
 * full-text or biomedical-specific source: it reliably gives DOI,
 * title, authors, journal, publication date, and licensing links, and
 * only OCCASIONALLY has a deposited abstract. This adapter reports
 * `contentAvailability` honestly per-item instead of ever implying full
 * text is available (brief §12).
 *
 * Crossref documents a "polite pool" (better, more consistent service)
 * for requests that identify a contact — via a `User-Agent` string, not
 * a credential of any kind. This adapter does not add one: doing so
 * would mean baking a specific person/project's contact details into a
 * public repository's frontend bundle, which is exactly the kind of
 * "personal" dependency §22 (fork safety) asks to avoid. Every fork —
 * including the original — gets the same anonymous public pool. If this
 * ever becomes a real throughput problem, a `mailto` param pointing at
 * a project-level (not personal) address would be the right follow-up,
 * not a key.
 *
 * Crossref's own rate limits are a concrete example of why this module
 * treats provider limits as moving targets rather than facts to code
 * against: as of a July 2026 policy change, Crossref started rate-
 * limiting differently by request type and by contact email, tightening
 * the anonymous public pool's allowance for search/list-style requests
 * (which is what this adapter sends) well below what older
 * documentation describes. This adapter was not changed in response —
 * it never assumed a specific number to begin with; it just reacts to
 * whatever Crossref's response actually says on a given request (429 →
 * circuit-breaker cooldown, per `../circuitBreaker`), so a further
 * tightening (or loosening) requires no code change here either.
 *
 * No account, no key, no billing surface — same guarantee as the
 * Europe PMC adapter.
 *
 * COMPLIANCE PATCH (final correction): same reasoning as
 * `europepmc.ts` — a Crossref `abstract`, on the rare item that has one
 * deposited, is the publisher's own text, not Crossref's, and Crossref
 * itself says most of its reusable-metadata guarantee covers metadata,
 * not abstracts. This adapter checks the item's own `license` URL (via
 * `resolveAbstractPresentation`, see `../attribution`) and only shows
 * abstract text when that license is one this app recognizes as
 * clearly permitting reuse; otherwise the text is withheld and a
 * notice points to the source instead. Metadata (title, authors,
 * journal, date, DOI, license link) stays untouched and freely usable.
 */
import { isSourceAvailable, reportRateLimited, reportSuccess, reportTransientFailure } from '../circuitBreaker'
import { resolveAbstractPresentation } from '../attribution'
import { buildContextualQuery } from '../query'
import { stripTags } from '../text'
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from '../types'

const SOURCE_ID = 'crossref'
const BASE = 'https://api.crossref.org/works'
const TIMEOUT_MS = 8000

interface CrossrefItem {
  DOI?: string
  title?: string[]
  author?: { given?: string; family?: string }[]
  'container-title'?: string[]
  issued?: { 'date-parts'?: number[][] }
  abstract?: string
  URL?: string
  license?: { URL?: string }[]
}

export async function searchCrossref(context: KnowledgeQueryContext, limit = 10): Promise<NormalizedKnowledgeResult[]> {
  if (!isSourceAvailable(SOURCE_ID)) return []
  const query = buildContextualQuery(context)
  if (!query) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = `${BASE}?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,container-title,issued,abstract,URL,license`
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      reportRateLimited(SOURCE_ID)
      return []
    }
    if (!res.ok) {
      reportTransientFailure(SOURCE_ID)
      return []
    }
    const data = (await res.json()) as { message?: { items?: CrossrefItem[] } }
    reportSuccess(SOURCE_ID)
    const items = data?.message?.items ?? []
    const retrievedAt = Date.now()
    const out: NormalizedKnowledgeResult[] = []
    for (const item of items) {
      const normalized = normalize(item, retrievedAt)
      if (normalized) out.push(normalized)
    }
    return out
  } catch {
    reportTransientFailure(SOURCE_ID)
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function normalize(item: CrossrefItem, retrievedAt: number): NormalizedKnowledgeResult | undefined {
  const title = item.title?.[0]?.trim()
  if (!title || !item.DOI) return undefined

  const doi = item.DOI.toLowerCase()
  const rawAbstract = item.abstract ? stripTags(item.abstract) : undefined
  const licenseUrl = item.license?.[0]?.URL
  const presentation = resolveAbstractPresentation(rawAbstract, licenseUrl)
  const abstract = presentation.text
  const dateParts = item.issued?.['date-parts']?.[0]
  const publicationDate = dateParts?.length ? dateParts.join('-') : undefined
  const authors = item.author
    ?.map((a) => [a.given, a.family].filter(Boolean).join(' '))
    .filter(Boolean)

  return {
    id: `doi:${doi}`,
    source: 'crossref',
    sourceLabel: 'Crossref',
    title,
    authors: authors && authors.length ? authors : undefined,
    journal: item['container-title']?.[0],
    publicationDate,
    abstract,
    // Crossref is a metadata registry first — never claim more than what's actually deposited.
    contentAvailability: abstract ? 'ABSTRACT' : 'METADATA_ONLY',
    externalUrl: item.URL ?? `https://doi.org/${doi}`,
    doi,
    license: licenseUrl,
    attributionNotice: presentation.notice,
    relevanceScore: 0,
    retrievedAt
  }
}
