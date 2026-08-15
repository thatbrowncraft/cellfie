/**
 * core/concepts/researchReadings — Learn tab, "Research & Further
 * Reading" section (Concept 2.0 architecture change §6).
 *
 * Research literature is valuable, but it is optional deeper reading,
 * not the lesson itself. This file turns the concept's Europe PMC
 * results (already relevance/generality-scored and capped at 4 by
 * `fetchEuropePmcArticles`) into short reading-list entries — title,
 * a one-line reason it's relevant, journal/year, and a source link.
 * It deliberately never surfaces the full abstract text: that's what
 * used to let a research paper stand in as a "lesson," which is
 * exactly the pattern this file exists to avoid. A student who wants
 * the full text follows the source link themselves.
 *
 * The "why it's relevant" line is built only from data already on the
 * article (title-match / journal / year) — never invented, never a
 * summary of content this file hasn't actually read.
 */

import type { EuropePmcArticle } from './onlineKnowledge'

export interface ResearchReading {
  title: string
  whyRelevant: string
  journal?: string
  pubYear?: string
  sourceName: string
  sourceUrl: string
}

function buildWhyRelevant(article: EuropePmcArticle, conceptName: string): string {
  const titleHasConcept = article.title.toLowerCase().includes(conceptName.toLowerCase())
  const base = titleHasConcept ? `Peer-reviewed article directly about ${conceptName}.` : `Peer-reviewed article discussing ${conceptName}.`
  if (article.journal && article.pubYear) return `${base} Published in ${article.journal}, ${article.pubYear}.`
  if (article.journal) return `${base} Published in ${article.journal}.`
  if (article.pubYear) return `${base} Published ${article.pubYear}.`
  return base
}

/**
 * Builds the Research & Further Reading list for a concept. Pure —
 * `europePmc` is the same array already fetched for the Learn tab, no
 * new network calls. Never invents an entry: an empty `europePmc`
 * array (nothing found, or nothing cleared the generality bar) means
 * an empty reading list, and the Learn tab shows that honestly rather
 * than filling the section with something unrelated.
 */
export function buildResearchReadings(europePmc: EuropePmcArticle[], conceptName: string): ResearchReading[] {
  return europePmc.map((article) => ({
    title: article.title,
    whyRelevant: buildWhyRelevant(article, conceptName),
    journal: article.journal,
    pubYear: article.pubYear,
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl
  }))
}
