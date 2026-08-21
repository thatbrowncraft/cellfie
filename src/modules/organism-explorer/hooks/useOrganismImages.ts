import { useEffect, useMemo, useState } from 'react'
import { db, type OrganismImage } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { readFile } from '@/core/file-storage'

export interface OrganismImageWithUrl {
  image: OrganismImage
  /** A blob: object URL for this image, once loaded from OPFS — undefined while loading or on read failure. */
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

/**
 * Organism Library / Illustration System continuation §19-§27 — the
 * multi-image successor to the old single-custom-image hook. Resolves
 * every image the user has uploaded for this organism (§21: multiple
 * images, one primary) the same way `useOpfsObjectUrl` already does for
 * a single path, just fanned out over the whole list. `useLiveQuery`
 * on the Dexie read means adding, removing, or re-choosing a primary
 * image immediately updates every place rendering this organism (the
 * detail page, its card in the grid) with no manual refetch plumbing.
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

  const pathsKey = ordered.map((img) => img.filePath).join('|')
  const [urlsByPath, setUrlsByPath] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []

    Promise.all(
      ordered.map(async (img) => {
        try {
          const blob = await readFile(img.filePath)
          const url = URL.createObjectURL(blob)
          createdUrls.push(url)
          return [img.filePath, url] as const
        } catch {
          return [img.filePath, undefined] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [path, url] of pairs) {
        if (url) next[path] = url
      }
      setUrlsByPath(next)
    })

    return () => {
      cancelled = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathsKey is the intentional dependency; `ordered` is a new array every render.
  }, [pathsKey])

  const images: OrganismImageWithUrl[] = ordered.map((image) => ({ image, url: urlsByPath[image.filePath] }))
  const primary = images.find((i) => i.image.isPrimary)
  const thumbnails = images.filter((i) => !i.image.isPrimary)

  return {
    images,
    primaryImage: primary?.image,
    primaryImageUrl: primary?.url,
    thumbnails
  }
}
