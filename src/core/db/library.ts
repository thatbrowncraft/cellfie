/**
 * core/db/library — write-side operations for LibraryItem records.
 * Read-side access is via `useLiveQuery` directly against `db.libraryItems`
 * from the module layer; this file exists so mutations that must also
 * touch OPFS (deletion) or need small invariants (touching `updatedAt`)
 * have one place to live rather than being duplicated in UI components.
 */

import { db, type DocumentType, type LibraryItem } from './index'
import { deleteFile } from '../file-storage'

export interface LibraryItemEdits {
  title: string
  author?: string
  documentType: DocumentType
  language: string
  tags: string[]
}

export async function updateLibraryItem(id: string, edits: LibraryItemEdits): Promise<void> {
  await db.libraryItems.update(id, { ...edits, updatedAt: Date.now() })
}

export async function toggleItemCollection(itemId: string, collectionId: string): Promise<void> {
  const item = await db.libraryItems.get(itemId)
  if (!item) return
  const has = item.collectionIds.includes(collectionId)
  const collectionIds = has
    ? item.collectionIds.filter((id) => id !== collectionId)
    : [...item.collectionIds, collectionId]
  await db.libraryItems.update(itemId, { collectionIds, updatedAt: Date.now() })
}

export async function markOpened(id: string): Promise<void> {
  await db.libraryItems.update(id, { lastOpenedAt: Date.now() })
}

/** Reader milestone: persists the current page as reading progress / "last opened page". */
export async function updateReadingProgress(id: string, page: number): Promise<void> {
  await db.libraryItems.update(id, { lastPageRead: page })
}

/**
 * Removes a LibraryItem's record, its OPFS-backed file/thumbnail, its
 * bookmarks, and its highlights. Idempotent. Notes that link to the item
 * are intentionally kept — a note the person wrote still stands on its
 * own even if the source PDF is later removed; only the `itemId`/`page`/
 * `highlightId` linkage becomes stale (Notebook still shows the note,
 * just without a working "open source" jump).
 *
 * Sprint 3: also removes any ConceptSource rows that pointed at this
 * book (pdf/metadata sources, plus highlight/bookmark sources — those
 * records are gone too), so a concept's Sources list never shows a
 * dangling book. The concepts themselves are untouched; only the traces
 * back to this specific book are cleared.
 */
export async function removeLibraryItem(item: LibraryItem): Promise<void> {
  await deleteFile(item.filePath)
  if (item.thumbnailPath) {
    await deleteFile(item.thumbnailPath)
  }
  await db.transaction('rw', db.libraryItems, db.readerBookmarks, db.highlights, db.conceptSources, async () => {
    await db.libraryItems.delete(item.id)
    await db.readerBookmarks.where('itemId').equals(item.id).delete()
    await db.highlights.where('itemId').equals(item.id).delete()
    await db.conceptSources.where('libraryItemId').equals(item.id).delete()
  })
}
