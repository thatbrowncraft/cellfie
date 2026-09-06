/**
 * core/periodic-table/recentlyViewed — Dashboard "Periodic Table"
 * preview support.
 *
 * Deliberately the exact same pattern as
 * `core/laboratory/recentlyViewed.ts` and `core/organisms/recentlyViewed.ts`:
 * a small ordered list of `{ id, viewedAt }` entries in the existing
 * generic `appSettings` key/value table — no schema/version bump
 * needed, no new Dexie table.
 *
 * Only one content type exists here (elements), so unlike Laboratory's
 * version there's no `category` field to carry alongside each id.
 *
 * This is Dashboard's "recent activity" signal only — it is never a
 * saved/bookmarked list, just a bounded, auto-trimmed view history.
 */
import { db } from '../db'

const RECENTLY_VIEWED_KEY = 'periodicTable:recentlyViewed:v1'

/** Keep a small bounded history — Dashboard only ever shows a handful, but a little headroom avoids losing entries if one referenced id were ever removed from the registry. */
const MAX_STORED = 12

interface RecentlyViewedElementEntry {
  id: string
  viewedAt: number
}

async function readEntries(): Promise<RecentlyViewedElementEntry[]> {
  const record = await db.appSettings.get(RECENTLY_VIEWED_KEY)
  const value = record?.value
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is RecentlyViewedElementEntry =>
      Boolean(e) && typeof e === 'object' && typeof (e as RecentlyViewedElementEntry).id === 'string'
  )
}

/** Records that an element profile was just opened. Moves it to the front if already present; trims the list to MAX_STORED. Fire-and-forget — never blocks rendering the detail page. */
export async function recordElementViewed(id: string): Promise<void> {
  if (!id) return
  const existing = await readEntries()
  const withoutThisOne = existing.filter((e) => e.id !== id)
  const next = [{ id, viewedAt: Date.now() }, ...withoutThisOne].slice(0, MAX_STORED)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Most-recently-opened element ids, most recent first. Resolving these to full profiles is the caller's job — see Dashboard's dynamic registry import, matching the Organism/Lab recently-viewed pattern exactly. */
export async function getRecentlyViewedElementIds(limit: number): Promise<string[]> {
  const entries = await readEntries()
  return entries
    .slice()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, limit)
    .map((e) => e.id)
}
