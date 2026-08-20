import { db, type OrganismCustomImage } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { useOpfsObjectUrl } from '@/modules/library/hooks/useOpfsObjectUrl'

interface OrganismImageResult {
  /** The row itself, if the user has uploaded a custom image for this organism. */
  customImage: OrganismCustomImage | undefined
  /** A live blob: object URL for the custom image, once loaded from OPFS — undefined while loading or when there's no custom image. */
  customImageUrl: string | undefined
}

/**
 * Sprint 4 Master Revision §21 — resolves a custom image the same way
 * `useOpfsObjectUrl` already does for Concept Visuals imports (reused
 * directly, not reimplemented). `useLiveQuery` means uploading or
 * removing a custom image from the detail page immediately updates any
 * other place rendering this organism (e.g. its card in the grid),
 * with no manual refetch plumbing — same reactivity model as every
 * other Dexie-backed read in Cellfie.
 *
 * Priority is resolved by the caller: `customImageUrl ?? organism.image`
 * (built-in SVG) `?? undefined` (IllustrationFrame's own placeholder).
 */
export function useOrganismCustomImage(organismId: string): OrganismImageResult {
  const customImage = useLiveQuery(
    () => db.organismCustomImages.get(organismId),
    [organismId],
    undefined as OrganismCustomImage | undefined
  )
  const customImageUrl = useOpfsObjectUrl(customImage?.filePath)
  return { customImage, customImageUrl }
}
