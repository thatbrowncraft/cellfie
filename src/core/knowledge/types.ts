/**
 * core/knowledge/types — the shared, provider-agnostic result shape for
 * Cellfie's Online Sources tier.
 *
 * WHY THIS EXISTS: Comparison Studio, Laboratory, and Organism Explorer's
 * "Online Knowledge" enrichment all funnel through this one module now
 * (Knowledge Layer Repair brief). Every online provider adapter
 * (`adapters/*.ts`) normalizes into `NormalizedKnowledgeResult` — nothing
 * downstream of that (dedup, ranking, caching, the UI panels) ever has
 * to know which provider a result came from, or reach into a
 * provider-specific response shape again.
 *
 * If a provider disappears or changes its API tomorrow, only its own
 * adapter file needs to change (or be disabled) — this type, the
 * dedup/rank logic, and every module that calls `searchKnowledgeEnrichment`
 * stay exactly the same.
 */

/** What Cellfie actually has for a result — never overstated in the UI. */
export type ContentAvailability = 'FULL_TEXT' | 'ABSTRACT' | 'METADATA_ONLY' | 'EXTERNAL_LINK'

export type KnowledgeSourceId = 'europepmc' | 'ncbiBookshelf' | 'pubmed'

export interface NormalizedKnowledgeResult {
  /** Stable dedup id — see core/knowledge/dedupe.ts. Preferred over an array index so "already shown/dismissed" state survives a re-ranked pool. */
  id: string
  source: KnowledgeSourceId
  /** Human-readable provenance label shown next to the result, e.g. "Europe PMC". Never blurred with another layer's label ("My Library", "Cellfie"). */
  sourceLabel: string
  title: string
  authors?: string[]
  journal?: string
  /** Best-effort ISO-ish date or bare year string — whatever the provider actually returned, never reformatted into a false precision. */
  publicationDate?: string
  /** A direct excerpt/abstract from the source, when the provider actually returned one. Never invented, never paraphrased by this app. */
  abstract?: string
  contentAvailability: ContentAvailability
  /** Only set when a legitimate open-access full-text URL was returned by the provider itself. */
  fullTextUrl?: string
  /** Always set — the canonical page to view this result on the provider's own site. */
  externalUrl: string
  doi?: string
  pmid?: string
  pmcid?: string
  license?: string
  /**
   * Compliance patch: a short, user-visible attribution/reuse notice for
   * this specific result — set by the adapter that produced it (see
   * `core/knowledge/attribution.ts`). Populated for PubMed/Bookshelf
   * results (NCBI attribution) and for Europe PMC results that carry an
   * abstract excerpt (conservative-reuse notice). `undefined` for bare
   * metadata, which needs no disclaimer.
   */
  attributionNotice?: string
  /** Populated by core/knowledge/rank.ts — 0 until ranked. */
  relevanceScore: number
  retrievedAt: number
}

/** What the caller wants information about. Both fields feed the actual query text sent to providers — never a generic single keyword when more context is available (brief §8). */
export interface KnowledgeQueryContext {
  /** The primary subject — an organism name, a lab technique, an item being compared, etc. */
  subject: string
  /** A second subject to contrast against `subject`, when the caller is comparing two things (Comparison Studio). Optional — most callers only have one subject. */
  comparedAgainst?: string
  /** The specific facet/aspect being enriched, e.g. "virulence factors", "principle", "key distinguishing feature". Optional but strongly preferred — see brief §8. */
  aspect?: string
}

export interface KnowledgeSearchOptions {
  /** Result ids already shown or dismissed this enrichment session — excluded from the next candidate returned. This is the actual "Search Again" fix: it walks forward through an already-deduped, already-ranked pool instead of re-querying the same providers with the same query and receiving the same top hit again. */
  excludeIds?: string[]
  /** Bypasses the 7-day cached candidate pool and re-queries providers from scratch. Rarely needed — excludeIds already makes "Search Again" produce a new result without hitting the network again. Only meaningful for an explicit "Refresh" action. */
  forceRefreshPool?: boolean
  /** How many candidates each provider is asked for (before dedup/ranking). Defaults to a sane per-adapter value. */
  poolSize?: number
}

export type KnowledgeSearchStatus = 'found' | 'not-found' | 'exhausted' | 'offline' | 'error'

export interface KnowledgeSearchResult {
  status: KnowledgeSearchStatus
  result?: NormalizedKnowledgeResult
  /** Size of the deduped candidate pool for this query — lets a caller distinguish "nothing at all" from "exhausted, but N results were already shown". */
  poolSize?: number
}
