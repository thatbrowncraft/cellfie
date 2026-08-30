import type { KnowledgeQueryContext } from './types'

/**
 * Turns a `KnowledgeQueryContext` into the actual query string sent to
 * providers (brief §8: "the Knowledge Layer must generate contextual
 * queries", not a bare keyword). Examples:
 *
 *   { subject: 'Escherichia coli', aspect: 'virulence' }
 *     → "Escherichia coli virulence"
 *
 *   { subject: 'Enzymes', comparedAgainst: 'Proteins', aspect: 'key distinguishing feature' }
 *     → "Enzymes vs Proteins key distinguishing feature"
 *
 *   { subject: 'Gram staining', aspect: 'principle' }
 *     → "Gram staining principle"
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
