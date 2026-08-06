/**
 * core/db/collections — write-side operations for Collection records
 * (SDD v3 §2, "cross-cutting groupings"). Library is the first module to
 * use Collections for real; Bookmarks/Notes/etc. reuse the same table
 * later without any schema change, per the "modules never fork shared
 * entities" rule (SDD v3 §6).
 */

import { db, type Collection, type CollectionAccent } from './index'

export async function createCollection(name: string, accent: CollectionAccent): Promise<Collection> {
  const collection: Collection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    accent,
    createdAt: Date.now()
  }
  await db.collections.add(collection)
  return collection
}

/** Deletes a collection and removes its id from every item's membership list. */
export async function deleteCollection(id: string): Promise<void> {
  await db.transaction('rw', db.collections, db.libraryItems, async () => {
    const members = await db.libraryItems.where('collectionIds').equals(id).toArray()
    await Promise.all(
      members.map((item) =>
        db.libraryItems.update(item.id, {
          collectionIds: item.collectionIds.filter((cid) => cid !== id)
        })
      )
    )
    await db.collections.delete(id)
  })
}
