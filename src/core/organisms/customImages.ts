/**
 * core/organisms/customImages — Sprint 4 Master Revision §20-§28,
 * extended by the Organism Library / Illustration System continuation
 * §19-§27, extended again by the Image Import Bug Fix.
 *
 * A user's own local image(s) for an organism profile — microscope
 * photos, colony photos, stain images, personal diagrams. Mirrors
 * `core/concepts/assets.ts`: binary bytes go to local device storage,
 * Dexie's `organismImages` row only ever holds a logical pointer.
 * Nothing here ever leaves the device — no third-party image host, no
 * network upload (see `persistImageBytes` below).
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
 * Image Import Bug Fix — root cause of the deployed "We couldn't save
 * that image on this device right now" failure on a plain, valid JPG:
 * OPFS was the ONLY storage path `addOrganismImage` had. On any device/
 * browser where `navigator.storage.getDirectory()` is unavailable, or
 * where it's present but the actual `createWritable()`/`write()` call
 * fails, the old implementation had nowhere else to put the bytes and
 * returned `{ ok: false, reason: 'storage-error' }` — which is exactly
 * the message that was seen, for a completely valid image file; nothing
 * about the JPG itself was ever the problem.
 *
 * The fix (`persistImageBytes` below) keeps OPFS as the preferred store
 * — it's still the right place for large binary files, and the existing
 * Library module keeps using it unchanged — but now falls back to a
 * Blob stored in IndexedDB (the new `organismImageBlobs` Dexie table)
 * whenever OPFS isn't available or its write throws. The caller (and
 * the rest of the UI) never has to know or care which path a given
 * image actually took; `useOrganismImages` resolves either one back to
 * the same kind of blob: object URL.
 */

import { db, type OrganismImage, type OrganismImageStorageType } from '../db'
import { deleteFile, isOpfsAvailable, writeFile } from '../file-storage'

const CUSTOM_IMAGE_DIR = 'organism-images'

/**
 * Curated list used only for the file picker's `accept` attribute, so
 * the OS/browser file dialog shows a sensible, recognizable filter.
 * Actual validation (`isAcceptableImageType` below) is intentionally
 * broader — any `image/*` MIME type the browser can decode is accepted,
 * not just this list.
 */
export const ACCEPTED_CUSTOM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const

/** §25 — a sensible local-storage-safety ceiling; chosen to comfortably fit a phone photo while keeping IndexedDB/OPFS usage predictable. */
export const MAX_CUSTOM_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

/** Image Import Bug Fix §6 — a user may add at most this many local images per organism, independent of and on top of any curated illustration. */
export const MAX_CUSTOM_IMAGES_PER_ORGANISM = 3

export type CustomImageRejectionReason = 'unsupported-type' | 'too-large' | 'empty-file' | 'unreadable' | 'storage-error' | 'limit-reached'

export interface CustomImageResult {
  ok: boolean
  image?: OrganismImage
  reason?: CustomImageRejectionReason
}

/** Human-readable copy for each rejection reason, for the upload UI to show directly. */
export const customImageRejectionMessages: Record<CustomImageRejectionReason, string> = {
  'unsupported-type': 'That file type isn\u2019t supported. Use a JPG, PNG, WEBP, or SVG image.',
  'too-large': `Image is larger than ${Math.round(MAX_CUSTOM_IMAGE_BYTES / (1024 * 1024))} MB.`,
  'empty-file': 'That file looks empty or unreadable. Please try a different image.',
  unreadable: 'That image couldn\u2019t be read. It may be corrupted \u2014 please try a different file.',
  'storage-error': 'We couldn\u2019t save this image on the device. Check available browser storage and try again.',
  'limit-reached': `You\u2019ve reached the limit of ${MAX_CUSTOM_IMAGES_PER_ORGANISM} images for this organism. Remove one before adding another.`
}

/**
 * Broader than `ACCEPTED_CUSTOM_IMAGE_TYPES` on purpose (§6 of the bug
 * fix brief: "allow common browser-supported image formats... where the
 * browser can safely decode additional image/* formats, support them
 * too"). Anything that isn't even an `image/*` MIME type is rejected
 * outright; anything that is gets a real decode check below (SVG
 * excepted — see `addOrganismImage`) rather than being trusted on MIME
 * type alone.
 */
function isAcceptableImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
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

type PersistedImage =
  | { storageType: 'opfs'; filePath: string }
  | { storageType: 'indexeddb'; blobId: string }
  | { storageType: 'error' }

/**
 * Tries OPFS first (preferred — see module doc), falls back to an
 * IndexedDB Blob row whenever OPFS is unavailable on this device/
 * browser or its write fails for any reason (quota, permissions, a
 * browser that reports support but doesn't actually implement
 * `createWritable`). Only reports `'error'` if BOTH paths fail, which
 * is the one case `addOrganismImage` surfaces as `storage-error`.
 */
async function persistImageBytes(fileName: string, file: File): Promise<PersistedImage> {
  if (isOpfsAvailable()) {
    try {
      const filePath = await writeFile(CUSTOM_IMAGE_DIR, fileName, file)
      return { storageType: 'opfs', filePath }
    } catch {
      // OPFS exists but the write itself failed — fall through to the
      // IndexedDB fallback below instead of failing the whole upload.
    }
  }

  try {
    const blobId = crypto.randomUUID()
    await db.organismImageBlobs.put({ id: blobId, blob: file, createdAt: Date.now() })
    return { storageType: 'indexeddb', blobId }
  } catch {
    return { storageType: 'error' }
  }
}

async function deletePersistedImage(image: Pick<OrganismImage, 'storageType' | 'filePath' | 'blobId'>): Promise<void> {
  if (image.storageType === 'indexeddb') {
    if (image.blobId) await db.organismImageBlobs.delete(image.blobId).catch(() => undefined)
    return
  }
  if (image.filePath) await deleteFile(image.filePath).catch(() => undefined)
}

/**
 * Validates and stores a new user-uploaded image for an organism.
 * Never touches organism JSON content (§23) and never uploads anywhere
 * but this device's local storage (§13/§22). The first image ever added
 * for an organism becomes its primary image automatically (§21);
 * subsequent uploads are added as additional (non-primary) images.
 *
 * Every path through this function settles to a terminal
 * `CustomImageResult` — never a rejected promise — so the caller's
 * "Saving…" state always resolves (the original bug this module fixed).
 */
export async function addOrganismImage(organismId: string, file: File): Promise<CustomImageResult> {
  if (file.size === 0) return { ok: false, reason: 'empty-file' }
  if (file.size > MAX_CUSTOM_IMAGE_BYTES) return { ok: false, reason: 'too-large' }
  if (!isAcceptableImageType(file.type)) {
    return { ok: false, reason: 'unsupported-type' }
  }

  // §6 — checked up front, before the decode check and any storage write,
  // so hitting the cap never costs a wasted createImageBitmap call or a
  // byte written to OPFS/IndexedDB that would just have to be cleaned up.
  const currentCount = await db.organismImages.where('organismId').equals(organismId).count()
  if (currentCount >= MAX_CUSTOM_IMAGES_PER_ORGANISM) {
    return { ok: false, reason: 'limit-reached' }
  }

  if (file.type !== 'image/svg+xml') {
    // Cheap, safe validation that the browser can actually decode this as
    // an image before it's persisted — createImageBitmap decodes without
    // ever inserting anything into the DOM (§26). Only a real decode
    // failure is reported as 'unreadable'/corrupted (§19) — everything
    // else (storage, size, type) has its own distinct reason.
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
    } catch {
      return { ok: false, reason: 'unreadable' }
    }
  }

  const fileName = `${crypto.randomUUID()}-${file.name}`
  const persisted = await persistImageBytes(fileName, file)
  if (persisted.storageType === 'error') {
    return { ok: false, reason: 'storage-error' }
  }

  const existingCount = await db.organismImages.where('organismId').equals(organismId).count()
  const now = Date.now()
  const storageType: OrganismImageStorageType = persisted.storageType
  const record: OrganismImage = {
    id: crypto.randomUUID(),
    organismId,
    storageType,
    filePath: persisted.storageType === 'opfs' ? persisted.filePath : undefined,
    blobId: persisted.storageType === 'indexeddb' ? persisted.blobId : undefined,
    mimeType: file.type,
    fileName: file.name,
    isPrimary: existingCount === 0,
    createdAt: now,
    updatedAt: now
  }

  try {
    await db.organismImages.put(record)
  } catch {
    // Dexie write failed after the bytes were already persisted — clean
    // up the now-orphaned file/blob rather than leaving it unreferenced
    // forever.
    await deletePersistedImage(record)
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
 * §27 — removes one image and its underlying stored bytes (OPFS file or
 * IndexedDB blob, whichever `storageType` says it is). If the removed
 * image was primary and other images remain, the oldest remaining image
 * automatically becomes the new primary so the illustration frame never
 * ends up with a primary-less organism that still has images. Idempotent
 * — safe to call with an id that doesn't exist. Never leaves an orphaned
 * file/blob behind.
 */
export async function removeOrganismImage(organismId: string, imageId: string): Promise<void> {
  const existing = await db.organismImages.get(imageId)
  if (!existing || existing.organismId !== organismId) return
  await deletePersistedImage(existing)
  await db.organismImages.delete(imageId)

  if (existing.isPrimary) {
    const remaining = await listOrganismImages(organismId)
    const nextPrimary = remaining[0]
    if (nextPrimary) {
      await db.organismImages.update(nextPrimary.id, { isPrimary: true, updatedAt: Date.now() })
    }
  }
}
