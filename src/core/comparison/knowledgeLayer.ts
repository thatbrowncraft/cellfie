/**
 * core/comparison/knowledgeLayer — Comparison Studio §8/§11 ("Online
 * Knowledge" enrichment for a comparison aspect).
 *
 * Brief §8/§34 are explicit: reuse `lookupLabTopicKnowledge` rather than
 * building a parallel online-search system. That function is already
 * fully generic — it takes a free-text title and a cache-namespacing id,
 * with no Laboratory-specific behavior — so this module does not
 * reimplement any retrieval logic. It only:
 *
 *   1. namespaces the cache key with a `comparison:` prefix so a lookup
 *      for "ELISA" made from a comparison aspect never collides with a
 *      lookup for "ELISA" made from a Laboratory topic page, and
 *   2. gives the Comparison Studio call sites a name that matches their
 *      own vocabulary (aspect label + item name, not "lab topic").
 *
 * "My Library" mode is reached through the same
 * `lookupInAllLibrarySources` / `lookupInSpecificLibrarySource`
 * functions Laboratory and Organism Explorer already use — again, no
 * second Source Library search implementation (brief §34).
 *
 * Per brief §11, the Knowledge Layer is an enrichment/drafting
 * assistant, never an authority: results returned here are always
 * surfaced with an ⚡ Online Knowledge / 📘 My Library provenance badge
 * and require an explicit Accept before becoming part of a saved
 * comparison (see `core/comparison/userComparisons.ts`'s
 * `upsertAspectOverride`, which is the only path that persists one).
 */
import { lookupLabTopicKnowledge, type LabKnowledgeLookupOptions, type LabKnowledgeLookupResult } from '../laboratory/knowledgeLayer'
import type { KnowledgeSourceMode, LibrarySourceExcerpt } from '../organisms/types'

export type { KnowledgeSourceMode, LibrarySourceExcerpt }
export type ComparisonKnowledgeLookupResult = LabKnowledgeLookupResult
export type ComparisonKnowledgeLookupOptions = LabKnowledgeLookupOptions

/**
 * Looks up a comparison item or aspect topic (e.g. "ELISA", or "ELISA —
 * Sensitivity") in either "My Library" or "Online Knowledge". `topicId`
 * only namespaces the cache and is never sent anywhere.
 */
export async function lookupComparisonTopicKnowledge(
  title: string,
  topicId: string,
  options: ComparisonKnowledgeLookupOptions
): Promise<ComparisonKnowledgeLookupResult> {
  return lookupLabTopicKnowledge(title, `comparison:${topicId}`, options)
}
