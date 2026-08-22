import { useEffect, useMemo, useState } from 'react'
import { db, type OrganismImage } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { readFile } from '@/core/file-storage'

export interface OrganismImageWithUrl {
  image: OrganismImage
  /** A blob: object URL for this image, once loaded — undefined while loading or on read failure. */
  url: string | undefined
}

interface OrganismImagesResult {
  /** All of this organism's images with their live blob URLs, primary first. */
  images: OrganismImageWithUrl[]
  /** Convenience accessor for the primary image's row. */
  primaryImage: OrganismImage | undefined
  /** Convenience accessor for the primary image's blob URL — what the large illustration frame should show. */
  primaryImageUrl: string | undefined
  /** Every image after the primary — what renders as small thumbnails (§21). */
  thumbnails: OrganismImageWithUrl[]
}

/** A stable key per image's underlying bytes, regardless of which store they live in — used to dedupe/track object URLs. */
function storageKey(image: OrganismImage): string {
  return image.storageType === 'indexeddb' ? `indexeddb:${image.blobId ?? image.id}` : `opfs:${image.filePath ?? image.id}`
}

/** Reads an image's bytes back out of whichever store `storageType` says it's in. Throws on any read failure — callers treat that as "no URL for this image". */
async function readImageBlob(image: OrganismImage): Promise<Blob> {
  if (image.storageType === 'indexeddb') {
    if (!image.blobId) throw new Error('OrganismImage marked indexeddb but has no blobId')
    const row = await db.organismImageBlobs.get(image.blobId)
    if (!row) throw new Error('Missing organismImageBlobs row')
    return row.blob
  }
  if (!image.filePath) throw new Error('OrganismImage marked opfs but has no filePath')
  return readFile(image.filePath)
}

/**
 * Organism Library / Illustration System continuation §19-§27, extended
 * by the Image Import Bug Fix — the multi-image successor to the old
 * single-custom-image hook. Resolves every image the user has uploaded
 * for this organism (§21: multiple images, one primary), transparently
 * handling both storage paths a given image might be in (OPFS, or the
 * IndexedDB fallback — see `core/organisms/customImages.ts`); nothing
 * downstream of this hook needs to know or care which one a particular
 * image used. `useLiveQuery` on the Dexie read means adding, removing,
 * or re-choosing a primary image immediately updates every place
 * rendering this organism (the detail page, its card in the grid) with
 * no manual refetch plumbing.
 */
export function useOrganismImages(organismId: string): OrganismImagesResult {
  const rows = useLiveQuery(
    () => db.organismImages.where('organismId').equals(organismId).toArray(),
    [organismId],
    [] as OrganismImage[]
  )

  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
        return a.createdAt - b.createdAt
      }),
    [rows]
  )

  const keysKey = ordered.map(storageKey).join('|')
  const [urlsByKey, setUrlsByKey] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []

    Promise.all(
      ordered.map(async (img) => {
        try {
          const blob = await readImageBlob(img)
          const url = URL.createObjectURL(blob)
          createdUrls.push(url)
          return [storageKey(img), url] as const
        } catch {
          return [storageKey(img), undefined] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [key, url] of pairs) {
        if (url) next[key] = url
      }
      setUrlsByKey(next)
    })

    return () => {
      cancelled = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keysKey is the intentional dependency; `ordered` is a new array every render.
  }, [keysKey])

  const images: OrganismImageWithUrl[] = ordered.map((image) => ({ image, url: urlsByKey[storageKey(image)] }))
  const primary = images.find((i) => i.image.isPrimary)
  const thumbnails = images.filter((i) => !i.image.isPrimary)

  return {
    images,
    primaryImage: primary?.image,
    primaryImageUrl: primary?.url,
    thumbnails
  }
}
