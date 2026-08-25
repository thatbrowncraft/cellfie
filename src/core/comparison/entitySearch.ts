/**
 * core/comparison/entitySearch — finds real Cellfie entities (organisms
 * and Laboratory content) to use as Item A / Item B when building a
 * comparison (brief §12A/§17/§18).
 *
 * Deliberately reuses `searchOrganisms`/`listOrganisms` and
 * `searchLaboratory`/`getLabContentById` rather than building a parallel
 * entity index — this module is just a thin adapter that maps both
 * result shapes into one `ComparisonItemRef`-shaped hit, so the Item
 * Picker component doesn't need to know about two different registries.
 *
 * Bundle-size discipline (brief §25/§26): `core/organisms/registry.ts`
 * and `core/laboratory/registry.ts` are exactly the two content stores
 * `src/app/router.tsx`'s own top comment calls out as "the heaviest
 * content/logic" in the app (~936 KB + ~700 KB of glob-loaded JSON) —
 * the reason Organism Explorer and Laboratory got their own route-level
 * chunks in the first place. This file sits inside the Comparison
 * Studio lazy boundary (via `ItemPicker.tsx`), so importing either
 * registry *statically* here would drag both of them into the
 * Comparison Studio chunk just to power an item-name search box,
 * undoing that split for anyone who opens "New Comparison." Both
 * lookups are therefore behind a dynamic `import()`, exactly like
 * `core/search/index.ts` already does for the same two registries —
 * the content only loads the moment someone actually searches, and
 * lands in the same shared chunk Organism Explorer/Laboratory/Universal
 * Search already use (cached after first load, from any entry point).
 *
 * This file itself is imported only from within the Comparison Studio
 * lazy boundary (or dynamically, for the inline "Compare with…" entry
 * point on Laboratory/Organism detail pages), never statically from
 * those modules themselves — see `LaboratoryDetailPage.tsx` /
 * `OrganismDetailPage.tsx`, which only build a URL string and never
 * import from `core/comparison` at all.
 */
import type { ComparisonDomain, ComparisonItemRef } from './types'
import type { OrganismCategory } from '../organisms/types'
import type { LaboratoryCategory } from '../laboratory/types'

export interface EntitySearchHit {
  item: ComparisonItemRef
  /** Best-guess domain if this entity becomes Item A/B of a new comparison — the user can still change it. */
  suggestedDomain: ComparisonDomain
}

const ORGANISM_CATEGORY_DOMAIN: Record<OrganismCategory, ComparisonDomain> = {
  bacteria: 'bacteriology',
  virus: 'virology',
  fungi: 'mycology',
  protozoa: 'parasitology',
  algae: 'organism',
  other: 'organism'
}

const LAB_CATEGORY_DOMAIN: Record<LaboratoryCategory, ComparisonDomain> = {
  protocol: 'laboratory-technique',
  concept: 'scientific-concept',
  media: 'culture-media',
  'biochemical-test': 'diagnostics',
  biosafety: 'biosafety',
  equipment: 'laboratory-equipment',
  formula: 'scientific-concept'
}

/** Searches both organisms and Laboratory content for a free-text query, returning a unified, capped list. Empty query returns no results — this is a search-on-demand picker, not a full entity browser. Async because both registries are dynamically imported (see file header) rather than statically bundled. */
export async function searchComparableEntities(query: string, limit = 12): Promise<EntitySearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const [{ listOrganisms, searchOrganisms }, { searchLaboratory }] = await Promise.all([
    import('../organisms/registry'),
    import('../laboratory/registry')
  ])

  const organismHits = searchOrganisms(listOrganisms(), q)
    .slice(0, limit)
    .map((o): EntitySearchHit => ({
      item: { name: o.commonName ?? o.scientificName, subtitle: o.commonName ? o.scientificName : undefined, refKind: 'organism', refId: o.id },
      suggestedDomain: ORGANISM_CATEGORY_DOMAIN[o.category] ?? 'organism'
    }))

  const labHits = searchLaboratory(q)
    .slice(0, limit)
    .map((hit): EntitySearchHit => ({
      item: { name: hit.title, subtitle: hit.subtitle, refKind: 'laboratory', refId: hit.id, labCategory: hit.category },
      suggestedDomain: LAB_CATEGORY_DOMAIN[hit.category] ?? 'laboratory-technique'
    }))

  return [...organismHits, ...labHits].slice(0, limit)
}

/** Resolves a `ComparisonItemRef` back to a live display name/subtitle if it points at curated content — used to keep an inline-launched comparison's Item A accurate even if the underlying entity's title changed since a comparison referencing it was saved. Returns undefined for custom items (no ref) or a dangling ref (brief §31). Async for the same dynamic-import reason as `searchComparableEntities`. */
export async function resolveEntityRef(ref: ComparisonItemRef): Promise<ComparisonItemRef | undefined> {
  if (ref.refKind === 'organism' && ref.refId) {
    const { getOrganismById } = await import('../organisms/registry')
    const organism = getOrganismById(ref.refId)
    if (!organism) return undefined
    return { name: organism.commonName ?? organism.scientificName, subtitle: organism.commonName ? organism.scientificName : undefined, refKind: 'organism', refId: organism.id }
  }
  if (ref.refKind === 'laboratory' && ref.refId) {
    const { getLabContentById } = await import('../laboratory/registry')
    const content = getLabContentById(ref.refId)
    if (!content) return undefined
    return { name: content.title, refKind: 'laboratory', refId: content.id, labCategory: content.category }
  }
  return ref
}
