/**
 * core/laboratory/savedItems — "Saved Lab Items".
 *
 * A dedicated, permanent Laboratory workspace — deliberately NOT the
 * same thing as Dashboard's "recent activity" (see recentlyViewed.ts,
 * which stays a small bounded id list). This module is the only writer
 * of `db.savedLabItems`; every read path in the UI goes through the
 * functions here rather than touching the table directly, so the
 * dedupe/validation rules below can't be bypassed.
 *
 * Three source types, matching the Laboratory Knowledge Layer's three
 * information layers (LabSourcesPanel / knowledgeLayer.ts):
 *   - 'cellfie-reference' — a curated Laboratory content id. Only the id
 *     + category are stored; the JSON itself is always re-read live
 *     from the registry via `getLabContentById` (core/laboratory/registry.ts),
 *     so a saved row never goes stale relative to the curated content it
 *     points at.
 *   - 'my-library' — a retrieved excerpt from the user's own imported
 *     books (LibrarySourceExcerpt shape from core/organisms/types).
 *   - 'online-knowledge' — a retrieved excerpt from an external trusted
 *     source (SourcedExcerpt-shaped). Never relabeled as curated Cellfie
 *     content, and always keeps its source name/URL alongside the text
 *     so the user can tell exactly where it came from later.
 *
 * This is intentionally the *only* new Dexie table this feature
 * introduces (brief: "do not create another library/database") — no
 * parallel storage mechanism, no localStorage, nothing outside the
 * existing `core/db` Dexie instance.
 */
import { db, type SavedLabItemRecord, type SavedLabItemSourceType } from '../db'
import type { LaboratoryCategory } from './types'
import type { LibrarySourceExcerpt } from '../organisms/types'

export type { SavedLabItemRecord, SavedLabItemSourceType }

/** All saved Laboratory items, most recently saved first. */
export async function listSavedLabItems(): Promise<SavedLabItemRecord[]> {
  return db.savedLabItems.orderBy('savedAt').reverse().toArray()
}

/** Cheap existence check for "is this curated item already saved" — drives the Save/Saved toggle on LaboratoryDetailPage without loading the whole list. */
export async function isCellfieReferenceSaved(labContentId: string): Promise<boolean> {
  const existing = await db.savedLabItems.where('labContentId').equals(labContentId).first()
  return Boolean(existing)
}

/** Saves a curated Cellfie Laboratory item by reference only (id + category) — never duplicates the JSON content itself. Idempotent: saving an already-saved item is a no-op rather than creating a duplicate row. */
export async function saveCellfieReference(item: { id: string; category: LaboratoryCategory; title: string }): Promise<void> {
  const existing = await db.savedLabItems.where('labContentId').equals(item.id).first()
  if (existing) return
  const record: SavedLabItemRecord = {
    id: crypto.randomUUID(),
    sourceType: 'cellfie-reference',
    title: item.title,
    savedAt: Date.now(),
    labContentId: item.id,
    labCategory: item.category
  }
  await db.savedLabItems.add(record)
}

/** Saves a "My Library" excerpt retrieved via the Laboratory Knowledge Layer. Dedupes on the exact same book + page + text already being saved for this topic, so re-saving the same search result twice doesn't create clutter. */
export async function saveMyLibraryExcerpt(title: string, excerpt: LibrarySourceExcerpt): Promise<void> {
  const candidates = await db.savedLabItems.where('libraryItemId').equals(excerpt.libraryItemId).toArray()
  const isDuplicate = candidates.some(
    (c) => c.sourceType === 'my-library' && c.title === title && c.page === excerpt.page && c.excerpt === excerpt.text
  )
  if (isDuplicate) return
  const record: SavedLabItemRecord = {
    id: crypto.randomUUID(),
    sourceType: 'my-library',
    title,
    savedAt: Date.now(),
    libraryItemId: excerpt.libraryItemId,
    bookTitle: excerpt.bookTitle,
    author: excerpt.author,
    page: excerpt.page,
    excerpt: excerpt.text
  }
  await db.savedLabItems.add(record)
}

export interface OnlineKnowledgeExcerptInput {
  sourceName: string
  sourceUrl: string
  text: string
  isAbstract?: boolean
}

/** Saves an "Online Knowledge" excerpt retrieved via the Laboratory Knowledge Layer. Dedupes on the same source URL + text already being saved for this topic. */
export async function saveOnlineKnowledgeExcerpt(title: string, excerpt: OnlineKnowledgeExcerptInput): Promise<void> {
  const all = await listSavedLabItems()
  const isDuplicate = all.some(
    (c) => c.sourceType === 'online-knowledge' && c.title === title && c.sourceUrl === excerpt.sourceUrl && c.excerpt === excerpt.text
  )
  if (isDuplicate) return
  const record: SavedLabItemRecord = {
    id: crypto.randomUUID(),
    sourceType: 'online-knowledge',
    title,
    savedAt: Date.now(),
    sourceName: excerpt.sourceName,
    sourceUrl: excerpt.sourceUrl,
    excerpt: excerpt.text,
    isAbstract: excerpt.isAbstract
  }
  await db.savedLabItems.add(record)
}

/** Removes any saved Laboratory item — curated, library, or online — by its own row id. Only ever affects `savedLabItems`; never touches the curated registry or the user's Library items. */
export async function removeSavedLabItem(id: string): Promise<void> {
  await db.savedLabItems.delete(id)
}
