import type { KnowledgeQueryContext } from './types'

/**
 * ARCHITECTURE FIX (knowledge-source repair brief §12-14): this used to
 * be the ONE query-string builder, and it literally concatenated
 * `subject vs comparedAgainst aspect` — e.g. "Enzymes vs Proteins key
 * distinguishing feature" — and every adapter sent that exact string to
 * its provider. None of Europe PMC/PubMed/NCBI Bookshelf are semantic
 * search engines; they're literal term-matching literature/reference
 * indexes, and "vs" plus an abstract-noun aspect phrase ("key
 * distinguishing feature") is not how any real paper or book chapter is
 * actually titled or worded. That literal-query mismatch was a second,
 * independent cause of the reported bug: even where a genuinely good
 * educational source exists in principle, a query shaped like a natural-
 * language question about a COMPARISON returns nothing or returns
 * whatever incidentally shares one of those words (brief §11's "lipid
 * kinases and phosphatases" result) rather than the general definitional
 * material Comparison Studio actually wants.
 *
 * `buildProviderQuery` is what every adapter now sends to its provider:
 * `subject` + `aspect` only. `comparedAgainst` is deliberately dropped
 * from the literal query string — brief §13: "the comparison relationship
 * should primarily influence ranking and result interpretation", not be
 * something a search engine is expected to parse out of a "vs" phrase.
 * `comparedAgainst` still fully participates in ranking (see
 * `rank.ts#scoreOne`), it just never becomes literal query text.
 *
 *   { subject: 'Escherichia coli', aspect: 'virulence' }
 *     → "Escherichia coli virulence"
 *
 *   { subject: 'Enzymes', comparedAgainst: 'Proteins', aspect: 'key distinguishing feature' }
 *     → "Enzymes key distinguishing feature"  (comparedAgainst dropped)
 *
 *   { subject: 'Gram staining', aspect: 'principle' }
 *     → "Gram staining principle"
 *
 * All three current adapters (Europe PMC, NCBI Bookshelf, PubMed) are
 * the same kind of literal-term index, so they share this one builder —
 * brief §14's "provider-specific query construction" is honored by
 * keeping this call inside each adapter file (so a future adapter for a
 * genuinely different kind of provider, e.g. one that DOES benefit from
 * an explicit comparison phrase, can build its own query independently)
 * rather than by maintaining three near-identical variants today for
 * providers that don't actually need different treatment yet.
 */
export function buildProviderQuery(context: KnowledgeQueryContext): string {
  const parts = [context.subject.trim()]
  if (context.aspect?.trim()) parts.push(context.aspect.trim())
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Full contextual string INCLUDING the comparison relationship —
 * display/debug use only (e.g. a "searching for…" label). Never pass
 * this to a provider adapter; see `buildProviderQuery` above for why.
 */
export function buildContextualQuery(context: KnowledgeQueryContext): string {
  const parts = [context.subject.trim()]
  if (context.comparedAgainst?.trim()) parts.push('vs', context.comparedAgainst.trim())
  if (context.aspect?.trim()) parts.push(context.aspect.trim())
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/** Namespaces the on-device candidate-pool cache by the full context (subject + comparedAgainst + aspect) — never sent anywhere, just keeps "Enzymes / key distinguishing feature" and "Enzymes / mechanism" from sharing a cache entry. */
export function cacheKeyForContext(context: KnowledgeQueryContext): string {
  return `${context.subject}|${context.comparedAgainst ?? ''}|${context.aspect ?? ''}`.toLowerCase().trim()
}
