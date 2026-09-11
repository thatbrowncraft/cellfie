/**
 * core/world-explorer/globeStylePreference — persists the user's chosen
 * Globe Style across sessions the same way `core/concepts/
 * contextPreference.ts` persists context selection: one row in the
 * already-existing `appSettings` key/value Dexie table. No schema
 * change, no new Dexie version, no new state-management library —
 * exactly the "smallest appropriate local preference implementation"
 * the brief (§5) asks for when one isn't already obviously in place.
 */
import { db } from '../db'
import { DEFAULT_GLOBE_STYLE, isGlobeStyleId, type GlobeStyleId } from './globeStyle'

const GLOBE_STYLE_PREFERENCE_KEY = 'worldExplorerGlobeStyle:v1'

/** Reads the last-saved Globe Style, falling back to the default on first run or on any storage error — a preference read should never block the globe from rendering. */
export async function getSavedGlobeStyle(): Promise<GlobeStyleId> {
  try {
    const record = await db.appSettings.get(GLOBE_STYLE_PREFERENCE_KEY)
    return isGlobeStyleId(record?.value) ? record.value : DEFAULT_GLOBE_STYLE
  } catch {
    return DEFAULT_GLOBE_STYLE
  }
}

export async function saveGlobeStyle(style: GlobeStyleId): Promise<void> {
  try {
    await db.appSettings.put({ key: GLOBE_STYLE_PREFERENCE_KEY, value: style })
  } catch {
    // Non-fatal — the chosen style still applies for the rest of this session.
  }
}
