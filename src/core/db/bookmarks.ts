/**
 * core/db/bookmarks — write-side operations for ReaderBookmark records
 * (PDF Reader milestone). Mirrors the shape of `core/db/library.ts`:
 * mutations live here, read-side access is via `useLiveQuery` directly
 * against `db.readerBookmarks` from the reader module.
 */

import { db, type ReaderBookmark } from './index'
import { removeConceptSourcesForRecord } from '../concepts/service'

/** Saves the given page of a LibraryItem as a bookmark. */
export async function addBookmark(itemId: string, page: number): Promise<ReaderBookmark> {
  const bookmark: ReaderBookmark = {
    id: crypto.randomUUID(),
    itemId,
    page,
    createdAt: Date.now()
  }
  await db.readerBookmarks.add(bookmark)
  return bookmark
}

/** Removes a bookmark by id. Safe to call on an already-removed bookmark. */
export async function removeBookmark(id: string): Promise<void> {
  await db.readerBookmarks.delete(id)
  await removeConceptSourcesForRecord('bookmark', id)
}
