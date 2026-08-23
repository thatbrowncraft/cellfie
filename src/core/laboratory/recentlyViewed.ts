/**
 * core/laboratory/recentlyViewed — Dashboard "Lab" preview support.
 *
 * Deliberately the exact same pattern as
 * `core/organisms/recentlyViewed.ts`: a small ordered list of
 * `{ id, category, viewedAt }` entries in the existing generic
 * `appSettings` key/value table — no schema/version bump needed.
 *
 * This is Dashboard's "recent activity" signal only, and is
 * intentionally NOT the Saved Lab Items collection (see
 * core/laboratory/savedItems.ts, a real dedicated table for explicit
 * "keep this" saves). Recording a view here never saves anything —
 * it's overwritten/trimmed automatically and only ever shows a bounded
 * preview on Dashboard, never the user's full history.
 *
 * Only curated Cellfie Laboratory content (things with a real
 * `/laboratory/:category/:id` route backed by the registry) is tracked
 * here — a My Library / Online Knowledge lookup isn't "opening a page"
 * in the same sense, and if the user wants to keep one of those they
 * explicitly save it instead (savedItems.ts).
 */
import { db } from '../db'
import type { LaboratoryCategory } from './types'

const RECENTLY_VIEWED_KEY = 'laboratory:recentlyViewed:v1'

/** Keep a small bounded history — Dashboard only ever shows a handful, but a little headroom avoids losing entries if one referenced item was removed from the registry. */
const MAX_STORED = 12

interface RecentlyViewedLabEntry {
  id: string
  category: LaboratoryCategory
  viewedAt: number
}

async function readEntries(): Promise<RecentlyViewedLabEntry[]> {
  const record = await db.appSettings.get(RECENTLY_VIEWED_KEY)
  const value = record?.value
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is RecentlyViewedLabEntry =>
      Boolean(e) &&
      typeof e === 'object' &&
      typeof (e as RecentlyViewedLabEntry).id === 'string' &&
      typeof (e as RecentlyViewedLabEntry).category === 'string'
  )
}

/** Records that a curated Laboratory item was just opened. Moves it to the front if already present; trims the list to MAX_STORED. Fire-and-forget from the caller's point of view — never blocks rendering the detail page. */
export async function recordLabItemViewed(id: string, category: LaboratoryCategory): Promise<void> {
  if (!id) return
  const existing = await readEntries()
  const withoutThisOne = existing.filter((e) => e.id !== id)
  const next = [{ id, category, viewedAt: Date.now() }, ...withoutThisOne].slice(0, MAX_STORED)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Most-recently-opened Laboratory content ids (with their category), most recent first. Resolving these to full content objects is the caller's job — see Dashboard's dynamic registry import, matching the Organism recently-viewed pattern exactly. */
export async function getRecentlyViewedLabIds(limit: number): Promise<{ id: string; category: LaboratoryCategory }[]> {
  const entries = await readEntries()
  return entries
    .slice()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, limit)
    .map((e) => ({ id: e.id, category: e.category }))
}
