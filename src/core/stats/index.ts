/**
 * core/stats — Sprint 2 §9, Reading Dashboard. Every number here is
 * derived from records the app already stores (LibraryItem, Highlight,
 * Note, ReaderBookmark) — no separate analytics table, per "no
 * duplicated state." The one exception is total reading time, which
 * genuinely can't be derived after the fact; that's accumulated
 * incrementally into `appSettings` by the reader itself (see
 * `core/db/reading-time.ts`) and just read back out here.
 */

import { db, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../db'
import { getTotalReadingSeconds } from '../db/reading-time'

export interface ReadingStats {
  booksInLibrary: number
  booksOpened: number
  pagesRead: number
  highlightCount: number
  noteCount: number
  bookmarkCount: number
  /** Consecutive days (including today, if there's activity today) with at least one recorded action. */
  readingStreakDays: number
  totalReadingSeconds: number
}

function toDateKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function computeStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0
  const days = new Set(timestamps.map(toDateKey))
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  // If nothing happened yet today, that's fine — a streak is still
  // "alive" as of yesterday. Only start counting from a day that has
  // activity, walking backward while consecutive days keep matching.
  if (!days.has(toDateKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (days.has(toDateKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * Pure aggregation over already-fetched records — no Dexie access. Lets
 * the Dashboard compute stats reactively from its own `useLiveQuery`
 * subscriptions (so the numbers update live as highlights/notes are
 * added) without a second, non-reactive fetch of the same tables.
 */
export function computeStatsFromRecords(
  items: LibraryItem[],
  highlights: Highlight[],
  notes: Note[],
  bookmarks: ReaderBookmark[],
  totalReadingSeconds: number
): ReadingStats {
  const booksOpened = items.filter((i) => i.lastOpenedAt).length
  const pagesRead = items.reduce((sum, i) => sum + (i.lastPageRead ?? 0), 0)

  const activityTimestamps = [
    ...items.filter((i) => i.lastOpenedAt).map((i) => i.lastOpenedAt as number),
    ...highlights.map((h) => h.createdAt),
    ...notes.map((n) => n.createdAt),
    ...bookmarks.map((b) => b.createdAt)
  ]

  return {
    booksInLibrary: items.length,
    booksOpened,
    pagesRead,
    highlightCount: highlights.length,
    noteCount: notes.length,
    bookmarkCount: bookmarks.length,
    readingStreakDays: computeStreak(activityTimestamps),
    totalReadingSeconds
  }
}

/** Convenience wrapper for one-off (non-reactive) reads, e.g. on export. */
export async function computeReadingStats(): Promise<ReadingStats> {
  const [items, highlights, notes, bookmarks, totalReadingSeconds] = await Promise.all([
    db.libraryItems.toArray(),
    db.highlights.toArray(),
    db.notes.toArray(),
    db.readerBookmarks.toArray(),
    getTotalReadingSeconds()
  ])
  return computeStatsFromRecords(items, highlights, notes, bookmarks, totalReadingSeconds)
}
