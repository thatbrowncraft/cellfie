/**
 * core/db/reading-time — the one Reading Dashboard stat (Sprint 2 §9,
 * "Time spent reading (optional)") that can't be derived after the fact
 * from other tables, so it's accumulated incrementally instead. Reuses
 * the existing `appSettings` key-value table rather than introducing a
 * new one just for a single number.
 */

import { db } from './index'

const KEY = 'totalReadingSeconds'

export async function getTotalReadingSeconds(): Promise<number> {
  const record = await db.appSettings.get(KEY)
  return typeof record?.value === 'number' ? record.value : 0
}

/** Adds `seconds` (clamped to sane bounds) to the running total. Called by the reader on an interval while a book is open. */
export async function addReadingSeconds(seconds: number): Promise<void> {
  if (seconds <= 0 || !Number.isFinite(seconds)) return
  const current = await getTotalReadingSeconds()
  await db.appSettings.put({ key: KEY, value: current + seconds })
}
