/**
 * core/comparison/userComparisons — Saved Comparisons, My Comparisons,
 * Favorites, and the curated "User Editable Layer" (brief §12/§13/§14).
 *
 * The only writer of `db.savedComparisons`; every UI read path goes
 * through the functions here, mirroring `core/laboratory/savedItems.ts`'s
 * discipline exactly.
 *
 * Two source types:
 *  - 'curated' — a thin overlay row referencing a curated comparison by
 *    id (`curatedComparisonId`). The curated JSON is always re-read live
 *    from `core/comparison/registry.ts`; this row only carries what the
 *    user *changed*: added/edited aspects, hidden aspects, notes,
 *    favorite/needsReview flags. The shipped JSON is never mutated
 *    (brief §13).
 *  - 'custom' — a fully user-authored comparison with no curated
 *    counterpart (brief §12B).
 *
 * `resolveSavedComparison` is the one place that merges a curated
 * comparison with its overlay into the single `Comparison` shape the
 * workspace UI renders — callers never have to reason about the split
 * themselves.
 */
import { db, type SavedComparisonRecord, type SavedComparisonSourceType, type SavedComparisonAspectRecord } from '../db'
import { getCuratedComparisonById } from './registry'
import type { Comparison, ComparisonAspect, ComparisonDomain, ComparisonDifficulty, ComparisonFrequency, ComparisonItemRef } from './types'

export type { SavedComparisonRecord, SavedComparisonSourceType }

function titleFor(itemA: { name: string }, itemB: { name: string }): string {
  return `${itemA.name} vs ${itemB.name}`
}

/** All saved/authored comparisons, most recently updated first. */
export async function listSavedComparisons(): Promise<SavedComparisonRecord[]> {
  return db.savedComparisons.orderBy('updatedAt').reverse().toArray()
}

export async function listFavoriteComparisons(): Promise<SavedComparisonRecord[]> {
  const all = await listSavedComparisons()
  return all.filter((c) => c.favorite)
}

export async function getSavedComparisonRecord(id: string): Promise<SavedComparisonRecord | undefined> {
  return db.savedComparisons.get(id)
}

/** Cheap existence check for "is this curated comparison already saved" — drives a Save/Saved toggle without loading the whole list. */
export async function findOverlayForCurated(curatedComparisonId: string): Promise<SavedComparisonRecord | undefined> {
  return db.savedComparisons.where('curatedComparisonId').equals(curatedComparisonId).first()
}

/** Saves (bookmarks) a curated comparison as-is, with no edits yet. Idempotent — saving an already-saved curated comparison just returns the existing row rather than duplicating it. */
export async function saveCuratedComparison(curatedComparisonId: string): Promise<SavedComparisonRecord> {
  const existing = await findOverlayForCurated(curatedComparisonId)
  if (existing) return existing
  const curated = getCuratedComparisonById(curatedComparisonId)
  const now = Date.now()
  const record: SavedComparisonRecord = {
    id: crypto.randomUUID(),
    sourceType: 'curated',
    title: curated ? titleFor(curated.itemA, curated.itemB) : curatedComparisonId,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    curatedComparisonId
  }
  await db.savedComparisons.add(record)
  return record
}

export interface CustomComparisonInput {
  domain: ComparisonDomain
  difficulty: ComparisonDifficulty
  frequency: ComparisonFrequency
  itemA: ComparisonItemRef
  itemB: ComparisonItemRef
  aspects: ComparisonAspect[]
}

/** Creates a brand-new custom comparison (brief §12B) and saves it locally. */
export async function createCustomComparison(input: CustomComparisonInput): Promise<SavedComparisonRecord> {
  const now = Date.now()
  const record: SavedComparisonRecord = {
    id: crypto.randomUUID(),
    sourceType: 'custom',
    title: titleFor(input.itemA, input.itemB),
    createdAt: now,
    updatedAt: now,
    favorite: false,
    domain: input.domain,
    difficulty: input.difficulty,
    frequency: input.frequency,
    itemA: input.itemA,
    itemB: input.itemB,
    aspects: input.aspects as SavedComparisonAspectRecord[]
  }
  await db.savedComparisons.add(record)
  return record
}

/** Duplicates any saved comparison (curated overlay or custom) into a new independent custom comparison the user can freely diverge from (brief §14 "Duplicate"). Duplicating a curated overlay first resolves it to a full comparison so the copy stands alone even if the original curated content later changes. */
export async function duplicateSavedComparison(id: string): Promise<SavedComparisonRecord | undefined> {
  const resolved = await resolveComparisonByRouteId(id)
  if (!resolved) return undefined
  return createCustomComparison({
    domain: resolved.domain,
    difficulty: resolved.difficulty,
    frequency: resolved.frequency,
    itemA: { ...resolved.itemA, name: `${resolved.itemA.name} (copy)` },
    itemB: resolved.itemB,
    aspects: resolved.aspects
  })
}

/** Toggles favorite on a saved comparison by its own row id. */
export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await db.savedComparisons.update(id, { favorite, updatedAt: Date.now() })
}

/**
 * Toggles favorite by *route* id (curated content id or custom saved
 * id) — the convenience entry point the workspace UI calls, since it
 * only ever knows the route id. For a curated comparison with no
 * overlay yet, this transparently creates one first (favoriting is
 * itself a save action, same as Laboratory's Save/Saved toggle).
 */
export async function toggleFavoriteByRouteId(routeId: string, favorite: boolean): Promise<void> {
  const curated = getCuratedComparisonById(routeId)
  if (curated) {
    const overlay = await saveCuratedComparison(routeId)
    await setFavorite(overlay.id, favorite)
    return
  }
  await setFavorite(routeId, favorite)
}

/** Whether a route id currently has a local saved row — for curated comparisons this reflects the overlay's existence; custom comparisons are saved by definition. */
export async function isComparisonSavedByRouteId(routeId: string): Promise<boolean> {
  if (getCuratedComparisonById(routeId)) {
    return Boolean(await findOverlayForCurated(routeId))
  }
  const record = await db.savedComparisons.get(routeId)
  return record?.sourceType === 'custom'
}

/** Current favorite state by route id, without needing the caller to know curated-vs-custom. */
export async function isFavoriteByRouteId(routeId: string): Promise<boolean> {
  if (getCuratedComparisonById(routeId)) {
    const overlay = await findOverlayForCurated(routeId)
    return Boolean(overlay?.favorite)
  }
  const record = await db.savedComparisons.get(routeId)
  return Boolean(record?.favorite)
}

export async function setNeedsReview(id: string, needsReview: boolean): Promise<void> {
  await db.savedComparisons.update(id, { needsReview, updatedAt: Date.now() })
}

export async function setNotes(id: string, notes: string): Promise<void> {
  await db.savedComparisons.update(id, { notes, updatedAt: Date.now() })
}

/** Replaces a custom comparison's aspects (add/remove/reorder/edit all funnel through this — brief §20). No-op if the record is a curated overlay; use `upsertAspectOverride`/`hideAspect` for those instead. */
export async function updateCustomAspects(id: string, aspects: ComparisonAspect[]): Promise<void> {
  const record = await db.savedComparisons.get(id)
  if (!record || record.sourceType !== 'custom') return
  await db.savedComparisons.update(id, { aspects: aspects as SavedComparisonAspectRecord[], updatedAt: Date.now() })
}

export async function renameCustomItems(id: string, itemA: ComparisonItemRef, itemB: ComparisonItemRef): Promise<void> {
  const record = await db.savedComparisons.get(id)
  if (!record || record.sourceType !== 'custom') return
  await db.savedComparisons.update(id, { itemA, itemB, title: titleFor(itemA, itemB), updatedAt: Date.now() })
}

/** Adds or edits one aspect on a curated comparison's user layer, without touching the shipped JSON (brief §13). Ensures the overlay row exists first. */
export async function upsertAspectOverride(curatedComparisonId: string, aspect: ComparisonAspect): Promise<void> {
  const overlay = await saveCuratedComparison(curatedComparisonId)
  const existing = overlay.aspectOverrides ?? []
  const next = [...existing.filter((a) => a.id !== aspect.id), aspect as SavedComparisonAspectRecord]
  await db.savedComparisons.update(overlay.id, { aspectOverrides: next, updatedAt: Date.now() })
}

/** Hides a curated aspect from the user's view of a comparison, without altering the shipped JSON (brief §20 "remove an aspect"). */
export async function hideCuratedAspect(curatedComparisonId: string, aspectId: string): Promise<void> {
  const overlay = await saveCuratedComparison(curatedComparisonId)
  const existing = overlay.removedAspectIds ?? []
  if (existing.includes(aspectId)) return
  await db.savedComparisons.update(overlay.id, { removedAspectIds: [...existing, aspectId], updatedAt: Date.now() })
}

export async function restoreCuratedAspect(curatedComparisonId: string, aspectId: string): Promise<void> {
  const overlay = await findOverlayForCurated(curatedComparisonId)
  if (!overlay) return
  await db.savedComparisons.update(overlay.id, {
    removedAspectIds: (overlay.removedAspectIds ?? []).filter((a) => a !== aspectId),
    updatedAt: Date.now()
  })
}

/** Deletes any saved comparison. For a curated one, this only removes the local overlay — the curated comparison itself remains browsable/re-saveable from the registry (brief §14 "Delete" removes the user's saved copy, not Cellfie's curated content). */
export async function deleteSavedComparison(id: string): Promise<void> {
  await db.savedComparisons.delete(id)
}

/** Merges a curated comparison with its (possibly absent) local overlay into the single `Comparison` shape the workspace renders — the curated id is always kept as `Comparison.id`, so routing/inline "Compare with…"/recent-history all key on one stable id regardless of whether the user has ever saved or edited it. */
export function mergeCuratedWithOverlay(curated: Comparison, overlay: SavedComparisonRecord | undefined): Comparison & { notes?: string; savedRecordId?: string } {
  if (!overlay) return curated
  const removedIds = new Set(overlay.removedAspectIds ?? [])
  const overrideById = new Map((overlay.aspectOverrides ?? []).map((a) => [a.id, a]))
  const baseAspects = curated.aspects.filter((a) => !removedIds.has(a.id)).map((a) => overrideById.get(a.id) ?? a)
  const extraAspects = (overlay.aspectOverrides ?? []).filter((a) => !curated.aspects.some((ca) => ca.id === a.id))
  return {
    ...curated,
    aspects: [...baseAspects, ...extraAspects],
    notes: overlay.notes,
    savedRecordId: overlay.id
  }
}

function resolveCustomRecord(record: SavedComparisonRecord): (Comparison & { savedRecordId?: string }) | undefined {
  if (!record.itemA || !record.itemB || !record.aspects) return undefined
  return {
    id: record.id,
    domain: (record.domain as ComparisonDomain) ?? 'custom',
    difficulty: (record.difficulty as ComparisonDifficulty) ?? 'intermediate',
    frequency: (record.frequency as ComparisonFrequency) ?? 'common',
    audience: ['student', 'lab-learner', 'researcher'],
    tags: [],
    itemA: record.itemA,
    itemB: record.itemB,
    aspects: record.aspects,
    savedRecordId: record.id
  }
}

/**
 * Resolves a route id into a full `Comparison`. A route id is either a
 * curated content id (`core/comparison/registry.ts`) or a custom saved
 * comparison's own row id — never an overlay row's id, so this is the
 * one canonical lookup every page (workspace, inline "Compare with…",
 * recent history) can rely on. Returns undefined if nothing matches
 * (brief §31 "handle gracefully instead of crashing").
 */
export async function resolveComparisonByRouteId(routeId: string): Promise<(Comparison & { notes?: string; savedRecordId?: string }) | undefined> {
  const curated = getCuratedComparisonById(routeId)
  if (curated) {
    const overlay = await findOverlayForCurated(routeId)
    return mergeCuratedWithOverlay(curated, overlay)
  }
  const record = await db.savedComparisons.get(routeId)
  if (record?.sourceType === 'custom') return resolveCustomRecord(record)
  return undefined
}
