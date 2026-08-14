/**
 * core/concepts/assets — Concept Hub Refinement. CRUD for
 * `ConceptAsset` (see core/db/index.ts's doc comment for why this is a
 * separate table from ConceptRelation): Mind Map custom nodes/imports
 * and Visuals custom imports. Binary content (image/PDF) is written to
 * OPFS via the existing `core/file-storage` wrapper — the same
 * pattern LibraryItem's own PDF storage already uses — so nothing new
 * is introduced at the storage layer, just a new logical directory.
 */

import { db, type ConceptAsset, type ConceptAssetKind } from '../db'
import { deleteFile, writeFile } from '../file-storage'

const ASSET_FILE_DIR = 'concept-assets'
/** Only these two kinds ever carry a stored file — enforced here so a caller can't accidentally attach a blob to a 'mindmap-node' annotation. */
const IMPORT_KINDS: ConceptAssetKind[] = ['mindmap-import', 'visual-import']

export async function listConceptAssets(conceptId: string, kind?: ConceptAssetKind): Promise<ConceptAsset[]> {
  const all = await db.conceptAssets.where('conceptId').equals(conceptId).toArray()
  const filtered = kind ? all.filter((a) => a.kind === kind) : all
  return filtered.sort((a, b) => b.createdAt - a.createdAt)
}

/** Adds a free-text Mind Map annotation node — no file, no edge to any real Concept. */
export async function addMindMapNode(conceptId: string, label: string): Promise<ConceptAsset | undefined> {
  const trimmed = label.trim()
  if (!trimmed) return undefined
  const asset: ConceptAsset = {
    id: crypto.randomUUID(),
    conceptId,
    kind: 'mindmap-node',
    label: trimmed,
    createdAt: Date.now()
  }
  await db.conceptAssets.add(asset)
  return asset
}

/** Imports an image/PDF file (Mind Map diagram or Visuals reference) into OPFS and records it. `kind` must be one of IMPORT_KINDS. */
export async function importConceptAssetFile(
  conceptId: string,
  kind: 'mindmap-import' | 'visual-import',
  file: File
): Promise<ConceptAsset> {
  const fileName = `${crypto.randomUUID()}-${file.name}`
  const filePath = await writeFile(ASSET_FILE_DIR, fileName, file)
  const asset: ConceptAsset = {
    id: crypto.randomUUID(),
    conceptId,
    kind,
    label: file.name,
    filePath,
    mimeType: file.type || undefined,
    createdAt: Date.now()
  }
  await db.conceptAssets.add(asset)
  return asset
}

/** Deletes a ConceptAsset row and, if it carried one, its OPFS file. Idempotent — safe on an already-missing file (see file-storage's deleteFile). */
export async function removeConceptAsset(id: string): Promise<void> {
  const asset = await db.conceptAssets.get(id)
  if (!asset) return
  if (IMPORT_KINDS.includes(asset.kind) && asset.filePath) {
    await deleteFile(asset.filePath)
  }
  await db.conceptAssets.delete(id)
}

/** Every ConceptAsset row (of any kind) that references a given concept — used when deleting a concept, so no asset or its OPFS file is left orphaned. */
export async function removeAllConceptAssetsFor(conceptId: string): Promise<void> {
  const assets = await db.conceptAssets.where('conceptId').equals(conceptId).toArray()
  for (const asset of assets) {
    if (IMPORT_KINDS.includes(asset.kind) && asset.filePath) {
      await deleteFile(asset.filePath)
    }
  }
  await db.conceptAssets.where('conceptId').equals(conceptId).delete()
}
