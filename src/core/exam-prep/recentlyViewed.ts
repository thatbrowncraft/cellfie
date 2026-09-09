/**
 * core/exam-prep/recentlyViewed — Dashboard "Exam Prep" preview support.
 *
 * Deliberately the exact same pattern as
 * `core/periodic-table/recentlyViewed.ts` (and, before that,
 * `core/laboratory/recentlyViewed.ts` / `core/organisms/recentlyViewed.ts`):
 * a small ordered list of `{ id, viewedAt }` entries in the existing
 * generic `appSettings` key/value table — no schema/version bump needed,
 * no new Dexie table, no parallel tracking system.
 *
 * Tracking granularity matches the subject level (mirrors Organism/Element
 * "profile" tracking) — the same unit `subjects.ts`/`registry.ts` already
 * treat as an Exam Prep "destination". A subject id is recorded both when
 * its subject page opens (`ExamPrepSubjectPage`) and when any of its
 * topics open (`ExamPrepTopicPage`): opening "Constitution of India" and
 * opening a topic inside it both just move the *same* "Constitution of
 * India" entry to the front rather than creating a separate entry per
 * topic — so repeated visits update the existing recent item instead of
 * accumulating unbounded duplicates, exactly like every other Dashboard
 * recent-activity list.
 *
 * This is Dashboard's "recent activity" signal only — it is never a
 * saved/bookmarked list, just a bounded, auto-trimmed view history.
 */
import { db } from '../db'

const RECENTLY_VIEWED_KEY = 'examPrep:recentlyViewed:v1'

/** Keep a small bounded history — Dashboard only ever shows a handful, but a little headroom avoids losing entries if one referenced subject were ever removed from the registry. */
const MAX_STORED = 12

interface RecentlyViewedExamSubjectEntry {
  id: string
  viewedAt: number
}

async function readEntries(): Promise<RecentlyViewedExamSubjectEntry[]> {
  const record = await db.appSettings.get(RECENTLY_VIEWED_KEY)
  const value = record?.value
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is RecentlyViewedExamSubjectEntry =>
      Boolean(e) && typeof e === 'object' && typeof (e as RecentlyViewedExamSubjectEntry).id === 'string'
  )
}

/** Records that an Exam Prep subject (its subject page, or any topic inside it) was just opened. Moves it to the front if already present; trims the list to MAX_STORED. Fire-and-forget — never blocks rendering the page. */
export async function recordExamSubjectViewed(subjectId: string): Promise<void> {
  if (!subjectId) return
  const existing = await readEntries()
  const withoutThisOne = existing.filter((e) => e.id !== subjectId)
  const next = [{ id: subjectId, viewedAt: Date.now() }, ...withoutThisOne].slice(0, MAX_STORED)
  await db.appSettings.put({ key: RECENTLY_VIEWED_KEY, value: next })
}

/** Most-recently-opened Exam Prep subject ids, most recent first. Resolving these to full subject objects is the caller's job — see Dashboard's dynamic import, matching the Organism/Lab/Periodic Table recently-viewed pattern exactly. */
export async function getRecentlyViewedExamSubjectIds(limit: number): Promise<string[]> {
  const entries = await readEntries()
  return entries
    .slice()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, limit)
    .map((e) => e.id)
}
