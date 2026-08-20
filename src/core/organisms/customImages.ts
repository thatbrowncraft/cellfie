/**
 * core/organisms/customImages — Sprint 4 Master Revision §20-§28.
 *
 * A user's own local replacement image for an organism profile — their
 * microscope photo, colony photo, stain image, or personal diagram.
 * Mirrors `core/concepts/assets.ts` exactly: binary bytes go to OPFS via
 * the existing `core/file-storage` wrapper (same pattern LibraryItem's
 * PDFs already use), Dexie only ever holds the logical pointer. Nothing
 * new is introduced at the storage layer — no third-party image host,
 * no second local-storage system, no new dependency.
 *
 * §23 — deliberately lives entirely outside `src/content/organisms/`.
 * A custom image can never be written into an organism JSON file, so it
 * can never end up committed to the repository.
 */

import { db, type OrganismCustomImage } from '../db'
import { deleteFile, writeFile } from '../file-storage'

const CUSTOM_IMAGE_DIR = 'organism-images'

/** §25 — accepted MIME types for a custom organism image. */
export const ACCEPTED_CUSTOM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const

/** §25 — a sensible local-storage-safety ceiling; chosen to comfortably fit a phone photo while keeping IndexedDB/OPFS usage predictable. */
export const MAX_CUSTOM_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

export type CustomImageRejectionReason = 'unsupported-type' | 'too-large' | 'empty-file' | 'unreadable'

export interface CustomImageResult {
  ok: boolean
  image?: OrganismCustomImage
  reason?: CustomImageRejectionReason
}

/** Human-readable copy for each rejection reason, for the upload UI to show directly. */
export const customImageRejectionMessages: Record<CustomImageRejectionReason, string> = {
  'unsupported-type': 'That file type isn\u2019t supported. Use a JPG, PNG, WEBP, or SVG image.',
  'too-large': `That image is too large. Please use a file under ${Math.round(MAX_CUSTOM_IMAGE_BYTES / (1024 * 1024))} MB.`,
  'empty-file': 'That file looks empty or unreadable. Please try a different image.',
  unreadable: 'That image couldn\u2019t be read. It may be corrupted \u2014 please try a different file.'
}

/** The current custom image record for an organism, if the user has uploaded one. Read-side is otherwise done directly against `db.organismCustomImages` via `useLiveQuery` from the module, matching the rest of core/db's read/write split. */
export async function getCustomImage(organismId: string): Promise<OrganismCustomImage | undefined> {
  return db.organismCustomImages.get(organismId)
}

/**
 * Validates and stores a user-uploaded image, replacing any previous
 * custom image for this organism. Never touches organism JSON content
 * (§23) and never uploads anywhere but this device's local OPFS/
 * IndexedDB (§22).
 */
export async function setCustomImage(organismId: string, file: File): Promise<CustomImageResult> {
  if (file.size === 0) return { ok: false, reason: 'empty-file' }
  if (file.size > MAX_CUSTOM_IMAGE_BYTES) return { ok: false, reason: 'too-large' }
  if (!ACCEPTED_CUSTOM_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_CUSTOM_IMAGE_TYPES)[number])) {
    return { ok: false, reason: 'unsupported-type' }
  }

  let decodable = true
  if (file.type !== 'image/svg+xml') {
    // Cheap, safe validation that the browser can actually decode this as
    // an image before it's persisted — createImageBitmap decodes without
    // ever inserting anything into the DOM (§26).
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      decodable = false
    }
  }
  if (!decodable) return { ok: false, reason: 'unreadable' }

  // Replace-in-place: remove the previous file (if any) before writing
  // the new one, so a re-upload never leaves an orphaned OPFS blob.
  const existing = await db.organismCustomImages.get(organismId)
  if (existing) {
    await deleteFile(existing.filePath)
  }

  const fileName = `${crypto.randomUUID()}-${file.name}`
  const filePath = await writeFile(CUSTOM_IMAGE_DIR, fileName, file)
  const now = Date.now()
  const record: OrganismCustomImage = {
    organismId,
    filePath,
    mimeType: file.type,
    fileName: file.name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  await db.organismCustomImages.put(record)
  return { ok: true, image: record }
}

/** §27 — removes only the local custom image and its OPFS file; the built-in Cellfie SVG (or placeholder) is what naturally shows again once this row is gone. Idempotent — safe to call when no custom image exists. */
export async function removeCustomImage(organismId: string): Promise<void> {
  const existing = await db.organismCustomImages.get(organismId)
  if (!existing) return
  await deleteFile(existing.filePath)
  await db.organismCustomImages.delete(organismId)
}
