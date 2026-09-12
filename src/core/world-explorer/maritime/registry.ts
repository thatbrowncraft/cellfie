/**
 * core/world-explorer/maritime/registry — same `import.meta.glob`
 * eager-discovery strategy as `core/world-explorer/registry.ts` (and
 * `core/exam-prep/registry.ts` before it). Dropping a new JSON file
 * into the right `src/content/world-explorer/maritime/<category>/`
 * folder is the entire authoring step — no change to this file, no
 * manual index to keep in sync (brief §24: keep data organized into
 * small per-entity files, not one giant JSON).
 */
import type { MaritimeCategory, MaritimeProfile, MaritimePort } from './types'

function isValidMaritimeProfile(x: unknown): x is MaritimeProfile {
  if (!x || typeof x !== 'object') return false
  const p = x as Partial<MaritimeProfile>
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.category === 'string' &&
    typeof p.name === 'string' &&
    typeof p.genZNote === 'string' &&
    Array.isArray(p.sections) &&
    p.sections.length > 0 &&
    Boolean(p.quickRevision) &&
    Boolean(p.examFocus) &&
    Array.isArray(p.sources)
  )
}

function isValidPortList(x: unknown): x is MaritimePort[] {
  return (
    Array.isArray(x) &&
    x.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof (p as MaritimePort).id === 'string' &&
        typeof (p as MaritimePort).name === 'string' &&
        typeof (p as MaritimePort).country === 'string'
    )
  )
}

const oceanModules = import.meta.glob<{ default: unknown }>('/src/content/world-explorer/maritime/oceans/*.json', {
  eager: true
})
const seaModules = import.meta.glob<{ default: unknown }>('/src/content/world-explorer/maritime/seas/*.json', {
  eager: true
})
const chokepointModules = import.meta.glob<{ default: unknown }>(
  '/src/content/world-explorer/maritime/chokepoints/*.json',
  { eager: true }
)
const routeModules = import.meta.glob<{ default: unknown }>('/src/content/world-explorer/maritime/routes/*.json', {
  eager: true
})
const ecosystemModules = import.meta.glob<{ default: unknown }>(
  '/src/content/world-explorer/maritime/ecosystems/*.json',
  { eager: true }
)
const indiaMaritimeModule = import.meta.glob<{ default: unknown }>(
  '/src/content/world-explorer/maritime/india-maritime.json',
  { eager: true }
)
const portsModule = import.meta.glob<{ default: unknown }>('/src/content/world-explorer/maritime/ports.json', {
  eager: true
})

function buildCategoryMap(modules: Record<string, { default: unknown }>, expectedCategory: MaritimeCategory) {
  const map = new Map<string, MaritimeProfile>()
  for (const [path, mod] of Object.entries(modules)) {
    const data = mod.default
    if (!isValidMaritimeProfile(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[world-explorer/maritime] Skipping malformed file: ${path}`)
      continue
    }
    if (data.category !== expectedCategory) {
      // eslint-disable-next-line no-console
      console.warn(
        `[world-explorer/maritime] ${path} is in the "${expectedCategory}" folder but declares category "${data.category}" — skipping.`
      )
      continue
    }
    if (map.has(data.id)) {
      // eslint-disable-next-line no-console
      console.warn(`[world-explorer/maritime] Skipping ${path}: duplicate id "${data.id}"`)
      continue
    }
    map.set(data.id, data)
  }
  return map
}

const OCEANS = buildCategoryMap(oceanModules, 'ocean')
const SEAS = buildCategoryMap(seaModules, 'sea')
const CHOKEPOINTS = buildCategoryMap(chokepointModules, 'chokepoint')
const ROUTES = buildCategoryMap(routeModules, 'route')
const ECOSYSTEMS = buildCategoryMap(ecosystemModules, 'ecosystem')

const CATEGORY_MAPS: Record<MaritimeCategory, Map<string, MaritimeProfile>> = {
  ocean: OCEANS,
  sea: SEAS,
  chokepoint: CHOKEPOINTS,
  route: ROUTES,
  ecosystem: ECOSYSTEMS
}

const INDIA_MARITIME_PROFILE: MaritimeProfile | null = (() => {
  const entry = Object.values(indiaMaritimeModule)[0]
  const data = entry?.default
  return isValidMaritimeProfile(data) ? data : null
})()

const PORTS: MaritimePort[] = (() => {
  const entry = Object.values(portsModule)[0]
  const data = entry?.default
  return isValidPortList(data) ? data : []
})()

export function getMaritimeProfile(category: MaritimeCategory, id: string): MaritimeProfile | undefined {
  return CATEGORY_MAPS[category].get(id)
}

export function getAllMaritimeProfiles(category: MaritimeCategory): MaritimeProfile[] {
  return Array.from(CATEGORY_MAPS[category].values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function getIndiaMaritimeProfile(): MaritimeProfile | null {
  return INDIA_MARITIME_PROFILE
}

export function getAllPorts(): MaritimePort[] {
  return PORTS
}

export function countMaritimeProfiles(): number {
  return OCEANS.size + SEAS.size + CHOKEPOINTS.size + ROUTES.size + ECOSYSTEMS.size + (INDIA_MARITIME_PROFILE ? 1 : 0)
}
