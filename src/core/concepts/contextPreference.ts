/**
 * core/concepts/contextPreference — Context Persistence Correction.
 *
 * `selectedContextIds` on the Concept Detail page is already the source
 * of truth for retrieval, and it's already URL-persisted (`?contexts=`,
 * same `replace: true` pattern as `tab`/`mode`) so a plain page refresh
 * or browser back/forward keeps the selection. What that alone can't
 * cover: leaving the concept via a link that doesn't carry query params
 * (e.g. the Concepts list) and opening the same concept again — the URL
 * starts bare, so the page falls back to "All contexts" even though the
 * student had deliberately narrowed to, say, Quantitative Aptitude.
 *
 * This adds one small piece of durable state on top of the existing URL
 * persistence: the last context selection the student made for THIS
 * concept, keyed by concept id in the same `appSettings` key/value table
 * every other cache/marker in this module already uses. It is read once
 * to seed the URL when a concept is opened with no `contexts` param at
 * all, and written every time the selection actually changes — it never
 * overrides an explicit selection already present in the URL.
 */
import { db } from '../db'

const CONTEXT_PREFERENCE_KEY_PREFIX = 'conceptContextPreference:v1:'

/** Normalized, sorted, deduped — matches ConceptDetailPage's own `selectedContextIds` normalization so a stored value is always directly usable. */
function normalizeContextIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean))).sort()
}

/** Returns the last-saved context selection for this concept, or `undefined` if none was ever saved (including "All contexts", which is saved as an explicit empty array so it's distinguishable from "never chosen"). */
export async function getSavedContextSelection(conceptId: string): Promise<string[] | undefined> {
  const record = await db.appSettings.get(`${CONTEXT_PREFERENCE_KEY_PREFIX}${conceptId}`)
  const value = record?.value as string[] | undefined
  return Array.isArray(value) ? normalizeContextIds(value) : undefined
}

export async function saveContextSelection(conceptId: string, contextIds: string[]): Promise<void> {
  await db.appSettings.put({
    key: `${CONTEXT_PREFERENCE_KEY_PREFIX}${conceptId}`,
    value: normalizeContextIds(contextIds)
  })
}
