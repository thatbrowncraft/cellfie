/**
 * core/world-explorer/registry — same loading strategy as
 * `core/exam-prep/registry.ts`: Vite's `import.meta.glob` eagerly
 * discovers every `*.json` file under `src/content/world-explorer/countries/`
 * at build time. Adding the next country's deep profile means dropping
 * in a JSON file and flipping `hasDeepProfile: true` on its
 * `GlobeCountry` entry — no change to this file. Fully offline-first,
 * bundle-time, nothing fetched at runtime — same as every other curated
 * content set in Cellfie.
 */
import type { CountryProfile } from './types'

function isValidCountryProfile(x: unknown): x is CountryProfile {
  if (!x || typeof x !== 'object') return false
  const p = x as Partial<CountryProfile>
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.name === 'string' &&
    typeof p.genZNote === 'string' &&
    Array.isArray(p.sections) &&
    p.sections.length > 0 &&
    Boolean(p.quickRevision) &&
    Boolean(p.examFocus) &&
    Array.isArray(p.sources)
  )
}

const countryProfileModules = import.meta.glob<{ default: unknown }>(
  '/src/content/world-explorer/countries/*.json',
  { eager: true }
)

const COUNTRY_PROFILES: Map<string, CountryProfile> = (() => {
  const map = new Map<string, CountryProfile>()
  for (const [path, mod] of Object.entries(countryProfileModules)) {
    const data = mod.default
    if (!isValidCountryProfile(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[world-explorer] Skipping malformed country profile file: ${path}`)
      continue
    }
    if (map.has(data.id)) {
      // eslint-disable-next-line no-console
      console.warn(`[world-explorer] Skipping ${path}: duplicate country id "${data.id}"`)
      continue
    }
    map.set(data.id, data)
  }
  return map
})()

export function getCountryProfile(id: string): CountryProfile | undefined {
  return COUNTRY_PROFILES.get(id)
}

export function countCountryProfiles(): number {
  return COUNTRY_PROFILES.size
}
