/**
 * core/organisms/savedOrganisms — Knowledge Layer Integration §12-§14,
 * §37. "Save to My Organisms": persists a Knowledge Layer profile to
 * this device's local Dexie database only. Never writes to
 * `src/content/organisms/*.json`, never touches the GitHub repository,
 * never leaves the browser (§12).
 */
import { db, type SavedOrganismRecord } from '../db'
import type { OrganismProfile } from './types'

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
