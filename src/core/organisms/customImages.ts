/**
 * core/organisms/customImages — Sprint 4 Master Revision §20-§28,
 * extended by the Organism Library / Illustration System continuation
 * §19-§27.
 *
 * A user's own local image(s) for an organism profile — microscope
 * photos, colony photos, stain images, personal diagrams. Mirrors
 * `core/concepts/assets.ts`: binary bytes go to OPFS via the existing
 * `core/file-storage` wrapper, Dexie only ever holds the logical
 * pointer. Nothing new at the storage layer — no third-party image
 * host, no second local-storage system, no new dependency.
 *
 * §21 — an organism can have MULTIPLE images. Exactly one is primary
 * (the large illustration-frame image); the rest are thumbnails. The
 * first image ever added for an organism becomes primary automatically;
 * after that, the user chooses via `setPrimaryOrganismImage`.
 *
 * §23 — deliberately lives entirely outside `src/content/organisms/`.
 * A custom image can never be written into an organism JSON file, so it
 * can never end up committed to the repository.
 *
 * §22 (bug fix) — every OPFS operation below is wrapped so a storage
 * failure (quota, permissions, an unsupported browser) returns a
 * `{ ok: false, reason: 'storage-error' }` result instead of throwing.
 * The previous implementation let `writeFile`/`deleteFile` throw
 * straight out of `setCustomImage`; the caller (OrganismDetailPage) had
 * no catch around that call, so an unexpected storage error left
 * `isUploading` stuck `true` forever — the "Uploading…" that never
 * resolved. Every path through the functions below now always settles
 * to a terminal `CustomImageResult`, never a rejected promise.
 */

import { db, type OrganismImage } from '../db'
import { deleteFile, writeFile } from '../file-storage'

const CUSTOM_IMAGE_DIR = 'organism-images'

/** §25 — accepted MIME types for a custom organism image. */
export const ACCEPTED_CUSTOM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const

/** §25 — a sensible local-storage-safety ceiling; chosen to comfortably fit a phone photo while keeping IndexedDB/OPFS usage predictable. */
export const MAX_CUSTOM_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

export type CustomImageRejectionReason = 'unsupported-type' | 'too-large' | 'empty-file' | 'unreadable' | 'storage-error'

export interface CustomImageResult {
  ok: boolean
  image?: OrganismImage
  reason?: CustomImageRejectionReason
}

/** Human-readable copy for each rejection reason, for the upload UI to show directly. */
export const customImageRejectionMessages: Record<CustomImageRejectionReason, string> = {
  'unsupported-type': 'That file type isn\u2019t supported. Use a JPG, PNG, WEBP, or SVG image.',
  'too-large': `That image is too large. Please use a file under ${Math.round(MAX_CUSTOM_IMAGE_BYTES / (1024 * 1024))} MB.`,
  'empty-file': 'That file looks empty or unreadable. Please try a different image.',
  unreadable: 'That image couldn\u2019t be read. It may be corrupted \u2014 please try a different file.',
  'storage-error': 'We couldn\u2019t save that image on this device right now. Please try again.'
}

/** All images for an organism, primary first, then the rest oldest-first — the stable order thumbnails render in. */
export async function listOrganismImages(organismId: string): Promise<OrganismImage[]> {
  const images = await db.organismImages.where('organismId').equals(organismId).toArray()
  return images.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

/** The organism's primary (large illustration-frame) image, if any. */
export async function getPrimaryOrganismImage(organismId: string): Promise<OrganismImage | undefined> {
  return db.organismImages.where({ organismId, isPrimary: true }).first()
}

/**
 * Validates and stores a new user-uploaded image for an organism.
 * Never touches organism JSON content (§23) and never uploads anywhere
 * but this device's local OPFS/IndexedDB (§22). The first image ever
 * added for an organism becomes its primary image automatically (§21);
 * subsequent uploads are added as additional (non-primary) images.
 */
export async function addOrganismImage(organismId: string, file: File): Promise<CustomImageResult> {
  if (file.size === 0) return { ok: false, reason: 'empty-file' }
  if (file.size > MAX_CUSTOM_IMAGE_BYTES) return { ok: false, reason: 'too-large' }
  if (!ACCEPTED_CUSTOM_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_CUSTOM_IMAGE_TYPES)[number])) {
    return { ok: false, reason: 'unsupported-type' }
  }

  if (file.type !== 'image/svg+xml') {
    // Cheap, safe validation that the browser can actually decode this as
    // an image before it's persisted — createImageBitmap decodes without
    // ever inserting anything into the DOM (§26).
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      return { ok: false, reason: 'unreadable' }
    }
  }

  let filePath: string
  try {
    const fileName = `${crypto.randomUUID()}-${file.name}`
    filePath = await writeFile(CUSTOM_IMAGE_DIR, fileName, file)
  } catch {
    // OPFS write failed (quota, permissions, unsupported browser) — report
    // it as a normal, terminal rejection rather than letting the error
    // escape uncaught (see module doc: this is the root fix for the
    // "Uploading…" that never resolved).
    return { ok: false, reason: 'storage-error' }
  }

  const existingCount = await db.organismImages.where('organismId').equals(organismId).count()
  const now = Date.now()
  const record: OrganismImage = {
    id: crypto.randomUUID(),
    organismId,
    filePath,
    mimeType: file.type,
    fileName: file.name,
    isPrimary: existingCount === 0,
    createdAt: now,
    updatedAt: now
  }

  try {
    await db.organismImages.put(record)
  } catch {
    // Dexie write failed after the OPFS write already succeeded — clean up
    // the now-orphaned blob rather than leaving it unreferenced forever.
    await deleteFile(filePath).catch(() => undefined)
    return { ok: false, reason: 'storage-error' }
  }

  return { ok: true, image: record }
}

/**
 * Makes an existing image the organism's primary (large illustration-
 * frame) image; the image that was previously primary becomes a
 * thumbnail. No-op if `imageId` doesn't belong to `organismId` or is
 * already primary.
 */
export async function setPrimaryOrganismImage(organismId: string, imageId: string): Promise<void> {
  const images = await db.organismImages.where('organismId').equals(organismId).toArray()
  const target = images.find((img) => img.id === imageId)
  if (!target || target.isPrimary) return
  const now = Date.now()
  await db.organismImages.bulkPut(
    images.map((img) => ({ ...img, isPrimary: img.id === imageId, updatedAt: img.id === imageId ? now : img.updatedAt }))
  )
}

/**
 * §27 — removes one image and its OPFS file. If the removed image was
 * primary and other images remain, the oldest remaining image
 * automatically becomes the new primary so the illustration frame never
 * ends up with a primary-less organism that still has images. Idempotent
 * — safe to call with an id that doesn't exist.
 */
export async function removeOrganismImage(organismId: string, imageId: string): Promise<void> {
  const existing = await db.organismImages.get(imageId)
  if (!existing || existing.organismId !== organismId) return
  await deleteFile(existing.filePath).catch(() => undefined)
  await db.organismImages.delete(imageId)

  if (existing.isPrimary) {
    const remaining = await listOrganismImages(organismId)
    const nextPrimary = remaining[0]
    if (nextPrimary) {
      await db.organismImages.update(nextPrimary.id, { isPrimary: true, updatedAt: Date.now() })
    }
  }
}
