/**
 * core/organisms/savedOrganisms — Knowledge Layer Integration §12-§14,
 * §37. "Save to My Organisms": persists a Knowledge Layer profile to
 * this device's local Dexie database only. Never writes to
 * `src/content/organisms/*.json`, never touches the GitHub repository,
 * never leaves the browser (§12).
 */
import { db, type SavedOrganismRecord } from '../db'
import type { OrganismProfile } from './types'
import { lookupOrganismOnline } from './knowledgeLayer'

/** All organisms the user has personally saved, most recently saved first. */
export async function listSavedOrganisms(): Promise<OrganismProfile[]> {
  const records = await db.savedOrganisms.orderBy('savedAt').reverse().toArray()
  return records.map((r) => r.profile as OrganismProfile)
}

export async function getSavedOrganism(organismId: string): Promise<OrganismProfile | undefined> {
  const record = await db.savedOrganisms.get(organismId)
  return record?.profile as OrganismProfile | undefined
}

/** §12/§35 — persists a Knowledge Layer profile as the user's own local copy. Stamps `sourceType: 'user-saved'` so the UI can distinguish "I looked this up" from "I kept this". Idempotent — saving the same organism again just refreshes its stored profile and bumps its save timestamp, without creating a duplicate row (organismId is the primary key). */
export async function saveOrganism(profile: OrganismProfile): Promise<void> {
  const existing = await db.savedOrganisms.get(profile.id)
  const savedProfile: OrganismProfile = { ...profile, sourceType: 'user-saved' }
  const record: SavedOrganismRecord = {
    organismId: profile.id,
    profile: savedProfile,
    savedAt: Date.now(),
    searchCount: existing?.searchCount ?? 1
  }
  await db.savedOrganisms.put(record)
}

/** §35 — removes the organism from the user's personal library only. Never affects the official curated library, which doesn't live in this table at all. */
export async function removeSavedOrganism(organismId: string): Promise<void> {
  await db.savedOrganisms.delete(organismId)
}

export async function isOrganismSaved(organismId: string): Promise<boolean> {
  return Boolean(await db.savedOrganisms.get(organismId))
}

/** §37 — a simple local counter for how often a not-yet-curated organism has been looked up, to help a future content pass decide what's worth curating officially. Never sent anywhere; safe to call even if the organism isn't saved yet (a lookup that isn't saved just doesn't get tracked, which is fine — this is a "nice to have" signal, not required infrastructure). */
export async function incrementOrganismSearchCount(organismId: string): Promise<void> {
  const existing = await db.savedOrganisms.get(organismId)
  if (!existing) return
  await db.savedOrganisms.update(organismId, { searchCount: existing.searchCount + 1 })
}

export type RefreshSavedOrganismResult = { status: 'refreshed'; profile: OrganismProfile } | { status: 'no-change' } | { status: 'failed' }
/**
 * §Phase 12 — "Refresh scientific information". Re-runs the *same*
 * source lookup (same mode, same specific book if that's what was
 * originally used — never silently switching a book-scoped save to
 * trusted sources on refresh) and, only on success, overwrites the
 * saved profile's scientific fields. On any failure (offline, network
 * error, source no longer has the info) the existing saved record is
 * left completely untouched — never deleted, never blanked (§Phase 12:
 * "never delete the user's saved profile because refresh failed").
 *
 * User-owned data — custom images (a separate table, keyed by organism
 * id, untouched by this function entirely), notes, highlights,
 * bookmarks, annotations — all live outside `OrganismProfile` and are
 * therefore automatically preserved; there is nothing in this function
 * that could touch them even accidentally (§Phase 12/§23).
 */
export async function refreshSavedOrganism(organismId: string): Promise<RefreshSavedOrganismResult> {
  const existing = await db.savedOrganisms.get(organismId)
  if (!existing) return { status: 'failed' }
  const savedProfile = existing.profile as OrganismProfile

  const result = await lookupOrganismOnline(savedProfile.scientificName, {
    mode: savedProfile.knowledgeLayer?.sourceMode ?? 'trusted',
    libraryItemId: savedProfile.knowledgeLayer?.libraryItemId,
    forceRefresh: true
  })

  if (result.status !== 'found' || !result.profile) {
    // Covers 'offline' / 'error' / 'not-found' / 'not-found-in-source' —
    // all treated the same way here: keep what the user already has.
    return { status: 'failed' }
  }

  // Re-save under the same id, re-stamped 'user-saved' by saveOrganism
  // itself — the refreshed scientific content replaces the old
  // scientific content, but nothing outside OrganismProfile is touched.
  await saveOrganism(result.profile)
  return { status: 'refreshed', profile: { ...result.profile, sourceType: 'user-saved' } }
}

/**
 * §"edit/write options at every section" — lets someone fill in or
 * correct fields Cellfie couldn't reliably retrieve (most commonly a
 * Knowledge Layer profile that came back thin or empty for a section),
 * without inventing a second content system. An edit is just a normal
 * write to the *same* `OrganismProfile` object already flowing through
 * `saveOrganism`/Dexie — no new table, no new storage format.
 *
 * Deliberately unavailable for `sourceType === 'curated-local'`:
 * curated organisms are shipped application content (a JSON file in
 * `src/content/organisms/`), not local user data, so editing one here
 * would only ever edit an in-memory copy that silently reverts the
 * moment the page reloads — worse than not offering the option at all
 * (§18/§23 — user edits belong in local storage, never mistaken for
 * shipped content). If someone finds an error in a curated profile,
 * that's a content fix to the JSON file itself, not a runtime edit.
 *
 * Works for both an already-saved organism AND a Knowledge-Layer
 * profile the user hasn't explicitly saved yet — editing an unsaved
 * lookup implicitly saves it (editing it *is* the "keep my own
 * version" action), consistent with how `refreshSavedOrganism` above
 * only ever operates on rows already in `savedOrganisms`.
 */
export async function updateOrganismProfile(profile: OrganismProfile, edits: Partial<OrganismProfile>): Promise<OrganismProfile> {
  const updated: OrganismProfile = { ...profile, ...edits, sourceType: 'user-saved' }
  await saveOrganism(updated)
  return updated
}
