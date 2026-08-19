/**
 * core/organisms/recentlyViewed — Dashboard "Saved organisms" support.
 *
 * The Organism Explorer/Detail pages have no persisted "opened" or
 * "favorited" concept of their own — organisms are static, bundled
 * content (see registry.ts), not user records. To surface "recently
 * opened organisms" on the Dashboard without inventing a parallel
 * database, this reuses the existing generic `appSettings` key/value
 * table — the exact same pattern already used by
 * core/db/reading-time.ts and core/concepts/contextPreference.ts. No
 * schema/version bump is needed: `appSettings` has existed since v1.
 *
 * Only a small ordered list of organism IDs + timestamps is stored
 * here. The organism's actual data is always re-read live from the
 * registry via getOrganismById — this file never duplicates or
 * caches organism content itself.
 */
import { db } from '../db'

const RECENTLY_VIEWED_KEY = 'organisms:recentlyViewed:v1'

/** Keep a small bounded history — the Dashboard only ever shows 4, but a little headroom avoids losing entries if one referenced organism was removed from the registry. */
const MAX_STORED = 12

interface RecentlyViewedEntry {
  id: string
  viewedAt: number
}

async function readEntries(): Promise<RecentlyViewedEntry[]> {
  const record = await db.appSettings.get(RECENTLY_VIEWED_KEY)
  const value = record?.value
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is RecentlyViewedEntry =>
      Boolean(e) && typeof e === 'object' && typeof (e as RecentlyViewedEntry).id === 'string'
  )
}

/** Records that an organism was just opened. Moves it to the front if already present; trims the list to MAX_STORED. Fire-and-forget from the caller's point of view — never blocks rendering the organism page. */
export async function recordOrganismViewed(organismId: string): Promise<void> {
  if (!organismId) return
  const existing = await readEntries()
  const withoutThisOne = existing.filter((e) => e.id !== organismId)
  const next = [{ id: organismId, viewedAt: Date.now() }, ...withoutThisOne].slice(0, MAX_STORED)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Most-recently-opened organism IDs, most recent first. Resolving these to full profiles (and dropping any that no longer exist) is the caller's job — see getRecentlyViewedOrganisms below. */
export async function getRecentlyViewedOrganismIds(limit: number): Promise<string[]> {
  const entries = await readEntries()
  return entries
    .slice()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, limit)
    .map((e) => e.id)
}
