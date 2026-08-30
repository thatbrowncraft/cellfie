/**
 * core/knowledge/dedupe — collapses the same publication reported by
 * several providers (Europe PMC, Crossref, PubMed can all return the
 * same paper) into ONE normalized result, per brief §10.
 *
 * Identifier strength, strongest first: DOI, then PMID, then PMCID,
 * then a normalized-title+year fallback for the rare item with no
 * identifier at all. Complementary fields are merged — e.g. Crossref's
 * DOI/license alongside Europe PMC's abstract — rather than one
 * provider's record simply winning outright.
 */
import { normalizeTitleForDedupe } from './text'
import type { ContentAvailability, NormalizedKnowledgeResult } from './types'

const AVAILABILITY_RANK: Record<ContentAvailability, number> = {
  FULL_TEXT: 3,
  ABSTRACT: 2,
  METADATA_ONLY: 1,
  EXTERNAL_LINK: 0
}

function strongKey(r: NormalizedKnowledgeResult): string {
  if (r.doi) return `doi:${r.doi.toLowerCase()}`
  if (r.pmid) return `pmid:${r.pmid}`
  if (r.pmcid) return `pmcid:${r.pmcid.toLowerCase()}`
  const year = (r.publicationDate ?? '').slice(0, 4)
  return `title:${normalizeTitleForDedupe(r.title)}:${year}`
}

function mergeInto(base: NormalizedKnowledgeResult, extra: NormalizedKnowledgeResult): NormalizedKnowledgeResult {
  const preferExtraContent = AVAILABILITY_RANK[extra.contentAvailability] > AVAILABILITY_RANK[base.contentAvailability]
  return {
    ...base,
    // Prefer whichever record actually has the richer content type for
    // the fields that describe that content, but never drop identifiers
    // either record already has.
    abstract: base.abstract ?? extra.abstract,
    contentAvailability: preferExtraContent ? extra.contentAvailability : base.contentAvailability,
    sourceLabel: preferExtraContent ? extra.sourceLabel : base.sourceLabel,
    source: preferExtraContent ? extra.source : base.source,
    externalUrl: preferExtraContent ? extra.externalUrl : base.externalUrl,
    fullTextUrl: base.fullTextUrl ?? extra.fullTextUrl,
    doi: base.doi ?? extra.doi,
    pmid: base.pmid ?? extra.pmid,
    pmcid: base.pmcid ?? extra.pmcid,
    license: base.license ?? extra.license,
    // Follows whichever record's source/sourceLabel/externalUrl won above —
    // the attribution notice must describe the content actually being kept,
    // not a stale notice from the record that lost.
    attributionNotice: preferExtraContent ? extra.attributionNotice ?? base.attributionNotice : base.attributionNotice ?? extra.attributionNotice,
    journal: base.journal ?? extra.journal,
    authors: base.authors ?? extra.authors,
    publicationDate: base.publicationDate ?? extra.publicationDate
  }
}

export function dedupeResults(results: NormalizedKnowledgeResult[]): NormalizedKnowledgeResult[] {
  const byKey = new Map<string, NormalizedKnowledgeResult>()
  for (const r of results) {
    const key = strongKey(r)
    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeInto(existing, r) : r)
  }
  return [...byKey.values()]
}
