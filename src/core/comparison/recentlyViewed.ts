/**
 * core/comparison/recentlyViewed — Dashboard "Recently Visited
 * Comparisons" support (brief §15/§16).
 *
 * Same generic `appSettings` key/value approach as
 * `core/laboratory/recentlyViewed.ts` and `core/organisms/recentlyViewed.ts`
 * — no schema/version bump needed.
 *
 * Unlike Laboratory's version, entries here store the display title
 * directly (`itemAName`/`itemBName`/`domain`) instead of just an id.
 * A comparison can be curated OR a locally-saved custom one, so
 * resolving "what registry do I look this up in" purely from an id
 * would require Dashboard to know about both `core/comparison/registry`
 * and `core/comparison/userComparisons` — denormalizing the tiny bit of
 * label text here keeps Dashboard's rendering fully synchronous and
 * registry-free, satisfying brief §16 ("Dashboard should remain
 * lightweight... do not eagerly load the entire Comparison Studio just
 * to render four recent cards").
 *
 * Opening a stale/deleted entry is handled by the workspace page itself
 * (brief §31/§15 "handle gracefully instead of crashing") — this module
 * only tracks what to show on Dashboard, not whether the target still
 * exists.
 */
import { db } from '../db'
import type { ComparisonDomain } from './types'

const RECENTLY_VIEWED_KEY = 'comparison:recentlyViewed:v1'

/** Dashboard only ever surfaces 4 (brief §15), but a little headroom means a stale/deleted entry falling off the front doesn't immediately shrink the visible list below 4. */
const MAX_STORED = 8

/** Dashboard shows at most this many — enforced here so every caller gets the same cap regardless of how many are stored. */
export const MAX_DASHBOARD_RECENT_COMPARISONS = 4

export interface RecentComparisonEntry {
  id: string
  itemAName: string
  itemBName: string
  domain: ComparisonDomain
  viewedAt: number
}

async function readEntries(): Promise<RecentComparisonEntry[]> {
  const record = await db.appSettings.get(RECENTLY_VIEWED_KEY)
  const value = record?.value
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is RecentComparisonEntry =>
      Boolean(e) &&
      typeof e === 'object' &&
      typeof (e as RecentComparisonEntry).id === 'string' &&
      typeof (e as RecentComparisonEntry).itemAName === 'string' &&
      typeof (e as RecentComparisonEntry).itemBName === 'string'
  )
}

/**
 * Records that a comparison was just opened. Moves it to the front if
 * already present (dedupe — brief "should not create a duplicate recent
 * item"), and trims to MAX_STORED. Fire-and-forget from the caller.
 */
export async function recordComparisonViewed(entry: {
  id: string
  itemAName: string
  itemBName: string
  domain: ComparisonDomain
}): Promise<void> {
  if (!entry.id) return
  const existing = await readEntries()
  const withoutThisOne = existing.filter((e) => e.id !== entry.id)
  const next = [{ ...entry, viewedAt: Date.now() }, ...withoutThisOne].slice(0, MAX_STORED)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Removes a comparison from recent history — called when a custom comparison is deleted (brief "if the comparison is deleted, its recent entry should disappear safely"). */
export async function removeFromRecentComparisons(id: string): Promise<void> {
  const existing = await readEntries()
  const next = existing.filter((e) => e.id !== id)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Most-recently-opened comparisons, most recent first, capped at `limit` (Dashboard passes MAX_DASHBOARD_RECENT_COMPARISONS). */
export async function getRecentComparisons(limit: number = MAX_DASHBOARD_RECENT_COMPARISONS): Promise<RecentComparisonEntry[]> {
  const entries = await readEntries()
  return entries
    .slice()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, limit)
}
