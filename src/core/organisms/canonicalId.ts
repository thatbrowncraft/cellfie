/**
 * core/organisms/canonicalId — Knowledge Layer Integration §16.
 *
 * The same scientific name must always resolve to the same internal id,
 * whether it arrives as a curated JSON file's `id` field, a live
 * Knowledge Layer lookup, or a user re-searching the same organism
 * later. This is what lets §15 work at all — a curated profile added
 * later under the same slug automatically takes priority over a saved
 * dynamic one, because they collide on this id rather than getting two
 * different random ones.
 *
 * Deliberately simple and deterministic — no AI, no fuzzy matching.
 */
export function canonicalOrganismId(scientificName: string): string {
  return scientificName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical author/strain notes, e.g. "(Zopf) Vuillemin"
    .replace(/[.,;:'"]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
