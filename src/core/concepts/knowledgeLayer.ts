/**
 * core/concepts/knowledgeLayer — Concept Online Knowledge Enrichment
 * brief. Mirrors `core/comparison/knowledgeLayer.ts` exactly (same
 * one-line wrapper pattern): reuses `lookupLabTopicKnowledge`, the one
 * shared "Online Knowledge" lookup already used by Comparison Studio
 * and Laboratory, rather than building a second retrieval stack or a
 * second Wikipedia client for Concepts.
 *
 * This module is deliberately NOT `core/concepts/onlineKnowledge.ts`.
 * That file is the Concept Hub's own, separately-scoped, intentionally
 * Wikipedia-free feed for the automatic Scientific Overview / Detailed
 * Study / Visuals tabs — see its own header comment for the extensive
 * reasoning behind that choice, none of which this file touches or
 * overrides. This module only backs the explicit, user-triggered
 * "Online Knowledge" enrichment dialog (ConceptOnlineKnowledgePanel),
 * exactly the same kind of on-demand, session-scoped search Comparison
 * Studio's "Enrich comparison" dialog already runs — never anything
 * that feeds the automatic Overview.
 *
 * `conceptId` only namespaces the shared multi-source pool's cache
 * (`concept:{id}`) so a lookup for "DNA" made from a Concept never
 * collides with a lookup for "DNA" made from a Laboratory topic page or
 * a Comparison Studio item — never sent anywhere, never mixed into the
 * result.
 */
import { lookupLabTopicKnowledge, type LabKnowledgeLookupOptions, type LabKnowledgeLookupResult } from '../laboratory/knowledgeLayer'

export type ConceptKnowledgeLookupResult = LabKnowledgeLookupResult
export type ConceptKnowledgeLookupOptions = Omit<LabKnowledgeLookupOptions, 'mode'>

/**
 * Looks up a Concept's name in the shared Online Knowledge pool (Europe
 * PMC + NCBI Bookshelf + PubMed + Wikipedia — see core/knowledge). Always
 * `mode: 'trusted'`: the Concept page's existing Library/tagged-context
 * workflow is a separate, unrelated feature (buildStudyOverview via
 * extraction.ts) and is not reachable through this function — Online
 * Knowledge here is strictly the external-source layer, per the brief's
 * "keep data layers separate" requirement.
 */
export async function lookupConceptTopicKnowledge(
  title: string,
  conceptId: string,
  options: ConceptKnowledgeLookupOptions = {}
): Promise<ConceptKnowledgeLookupResult> {
  return lookupLabTopicKnowledge(title, `concept:${conceptId}`, { ...options, mode: 'trusted' })
}
