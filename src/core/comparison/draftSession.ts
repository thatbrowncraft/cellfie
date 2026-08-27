/**
 * core/comparison/draftSession — brief §20-26: "the user's in-progress
 * source search should be recoverable" after a phone call, app switch, or
 * the OS suspending/killing the PWA process.
 *
 * Important honesty note (matches the brief's own "do not pretend a
 * search occurred" standard): a truly *killed* JS process takes every
 * in-flight Promise with it — there is no way to literally resume a
 * network/library call that was destroyed mid-flight, in this or any
 * browser architecture. What this module actually provides is the next
 * best, entirely real thing: it persists the *request* (which comparison,
 * which two items, which source, which book if any) the moment a
 * whole-comparison search starts, before the result is known. If the app
 * comes back and that record is still there, the search never reached a
 * terminal state — so Cellfie offers to run the exact same request again
 * instead of silently forgetting the person had already chosen a source
 * and started searching (the actual bug reported: "I had to choose the
 * source again").
 *
 * Deliberately reuses `db.appSettings` — the same key/value table
 * `core/concepts/onlineKnowledge.ts` already uses for response caching —
 * rather than introducing a new table or a new persistence mechanism
 * (brief §21: "the state can live in the existing local persistence
 * mechanism"). Only small, structured request metadata is stored here,
 * never a result payload (brief §21: "do NOT persist huge result
 * payloads").
 */
import { db } from '../db'
import type { KnowledgeSourceMode } from './knowledgeLayer'

const KEY_PREFIX = 'comparisonSearchSession:'

export interface ComparisonSearchSession {
  comparisonId: string
  itemAName: string
  itemBName: string
  source: 'my-library' | 'online'
  mode: Extract<KnowledgeSourceMode, 'my-sources' | 'specific-source'>
  libraryItemId?: string
  startedAt: number
}

export async function savePendingComparisonSearch(session: ComparisonSearchSession): Promise<void> {
  await db.appSettings.put({ key: `${KEY_PREFIX}${session.comparisonId}`, value: session })
}

export async function clearPendingComparisonSearch(comparisonId: string): Promise<void> {
  await db.appSettings.delete(`${KEY_PREFIX}${comparisonId}`)
}

export async function getPendingComparisonSearch(comparisonId: string): Promise<ComparisonSearchSession | undefined> {
  const record = await db.appSettings.get(`${KEY_PREFIX}${comparisonId}`)
  return record?.value as ComparisonSearchSession | undefined
}
