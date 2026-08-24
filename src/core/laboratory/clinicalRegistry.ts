/**
 * core/laboratory/clinicalRegistry — Laboratory Clinical Expansion.
 *
 * Deliberately a SEPARATE registry from `core/laboratory/registry.ts`,
 * not an extension of it, for one reason: bundle safety. The main
 * registry uses `import.meta.glob(..., { eager: true })` over
 * `src/content/laboratory/**`, and that whole module is already pulled
 * into the Laboratory route chunk (see src/app/router.tsx) every time
 * `/laboratory` is opened. Adding ~40 more curated JSON records to that
 * same eager glob would grow the *existing* Laboratory chunk on every
 * visit, including for people who never open Clinical Laboratory.
 *
 * Instead, clinical content lives under `src/content/laboratory-clinical/**`
 * (a folder name the main registry's glob patterns never match — see
 * that file's glob strings), and every category is discovered here with
 * `import.meta.glob(..., { eager: false })` (Vite's default), which
 * compiles each match to its own `() => import(...)` chunk. Nothing in
 * this file runs at module-evaluation time beyond building that map of
 * loader functions — the actual JSON is only fetched, parsed, and
 * cached the first time `loadClinicalRegistry()` (or a more targeted
 * loader below) is actually called, i.e. only once a person opens
 * Clinical Laboratory. Route-level code splitting (ClinicalLaboratoryPage
 * / ClinicalDetailPage, both lazy in router.tsx) is what actually
 * triggers that call — this module is never statically imported from
 * AppShell, Dashboard, or any other eager code path (Implementation
 * Brief §14).
 *
 * Content types are intentionally NOT a parallel schema: every clinical
 * record is a real `Protocol` / `LabConcept` / `Equipment` / `Formula`
 * from `core/laboratory/types`, using `subcategory` to carry its
 * clinical discipline label (e.g. "Hematology", "Clinical Biochemistry").
 * Cross-links into the existing 99-record Laboratory graph (e.g. a
 * clinical AST protocol linking to `media-mueller-hinton`) resolve
 * through the SAME id space — `resolveClinicalRelated` below checks the
 * clinical map first, then falls back to the main registry via a
 * dynamic import of its own, so a dangling id never silently renders
 * as nothing without at least being resolvable from one of the two
 * stores.
 */
import type { Equipment, Formula, LabConcept, LaboratoryCategory, LaboratoryContent, LaboratorySearchHit, Protocol } from './types'

type ClinicalCategory = Extract<LaboratoryCategory, 'protocol' | 'concept' | 'equipment' | 'formula'>

const CLINICAL_ID_PREFIX = 'clin-'

/** True for any id that belongs to the clinical expansion — used by callers (routing, saved items, recently-viewed) to decide which registry/route a given id belongs to without needing to load either registry first. */
export function isClinicalContentId(id: string): boolean {
  return id.startsWith(CLINICAL_ID_PREFIX)
}

// Lazy loaders — one per category folder. `eager: false` (the default)
// is explicit here specifically so a future edit doesn't accidentally
// flip this to eager and reintroduce the bundle problem this module
// exists to avoid.
const protocolLoaders = import.meta.glob<{ default: unknown }>('/src/content/laboratory-clinical/protocols/*.json', { eager: false })
const conceptLoaders = import.meta.glob<{ default: unknown }>('/src/content/laboratory-clinical/concepts/*.json', { eager: false })
const equipmentLoaders = import.meta.glob<{ default: unknown }>('/src/content/laboratory-clinical/equipment/*.json', { eager: false })
const formulaLoaders = import.meta.glob<{ default: unknown }>('/src/content/laboratory-clinical/formulas/*.json', { eager: false })

async function resolveCategory<T extends LaboratoryContent>(
  loaders: Record<string, () => Promise<{ default: unknown }>>,
  category: ClinicalCategory
): Promise<T[]> {
  const modules = await Promise.all(Object.entries(loaders).map(([path, load]) => load().then((mod) => [path, mod] as const)))
  const items: T[] = []
  for (const [path, mod] of modules) {
    const data = mod.default as Partial<LaboratoryContent> | undefined
    if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !data.id || typeof data.title !== 'string' || !data.title) {
      // eslint-disable-next-line no-console
      console.warn(`[laboratory-clinical] Skipping malformed ${category} content file: ${path}`)
      continue
    }
    if (data.category !== category) {
      // eslint-disable-next-line no-console
      console.warn(`[laboratory-clinical] Skipping ${path}: category field "${String(data.category)}" does not match folder category "${category}"`)
      continue
    }
    items.push(data as T)
  }
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

export interface ClinicalRegistrySnapshot {
  protocols: Protocol[]
  concepts: LabConcept[]
  equipment: Equipment[]
  formulas: Formula[]
  all: LaboratoryContent[]
  byId: Map<string, LaboratoryContent>
}

let cached: ClinicalRegistrySnapshot | undefined
let inflight: Promise<ClinicalRegistrySnapshot> | undefined

/** Loads (and caches, module-lifetime) every clinical content file. Safe to call from multiple places at once — concurrent callers share one in-flight load rather than triggering duplicate fetches. */
export async function loadClinicalRegistry(): Promise<ClinicalRegistrySnapshot> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = (async () => {
    const [protocols, concepts, equipment, formulas] = await Promise.all([
      resolveCategory<Protocol>(protocolLoaders, 'protocol'),
      resolveCategory<LabConcept>(conceptLoaders, 'concept'),
      resolveCategory<Equipment>(equipmentLoaders, 'equipment'),
      resolveCategory<Formula>(formulaLoaders, 'formula')
    ])
    const all: LaboratoryContent[] = [...protocols, ...concepts, ...equipment, ...formulas]
    const byId = new Map(all.map((c) => [c.id, c]))
    const snapshot: ClinicalRegistrySnapshot = { protocols, concepts, equipment, formulas, all, byId }
    cached = snapshot
    return snapshot
  })()

  try {
    return await inflight
  } finally {
    inflight = undefined
  }
}

export const CLINICAL_CATEGORY_LABELS: Record<ClinicalCategory, string> = {
  protocol: 'Clinical Protocols',
  concept: 'Clinical Concepts',
  equipment: 'Clinical Equipment',
  formula: 'Clinical Formulas'
}

/** Every distinct clinical discipline (subcategory) present, in a fixed, sensible reading order rather than alphabetical — beginners-first disciplines lead. */
const DISCIPLINE_ORDER = [
  'Pre-Analytical Laboratory',
  'Clinical Microbiology',
  'Hematology',
  'Clinical Biochemistry',
  'Immunology & Serology',
  'Immunohematology / Blood Bank',
  'Urinalysis',
  'Parasitology',
  'Histopathology',
  'Cytology',
  'Molecular Diagnostics',
  'Quality Control / Quality Assurance',
  'Clinical Laboratory Equipment'
]

export function disciplineSortIndex(discipline: string | undefined): number {
  if (!discipline) return DISCIPLINE_ORDER.length
  const idx = DISCIPLINE_ORDER.indexOf(discipline)
  return idx === -1 ? DISCIPLINE_ORDER.length : idx
}

export async function listClinicalByDiscipline(): Promise<{ discipline: string; items: LaboratoryContent[] }[]> {
  const { all } = await loadClinicalRegistry()
  const map = new Map<string, LaboratoryContent[]>()
  for (const item of all) {
    const key = item.subcategory ?? 'Other'
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return Array.from(map.entries())
    .map(([discipline, items]) => ({ discipline, items: items.sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => disciplineSortIndex(a.discipline) - disciplineSortIndex(b.discipline))
}

export async function getClinicalContentById(id: string): Promise<LaboratoryContent | undefined> {
  const { byId } = await loadClinicalRegistry()
  return byId.get(id)
}

/**
 * Resolves related-content ids for a clinical item. Clinical records
 * cross-link both into their own registry (other `clin-*` ids) and into
 * the existing 99-record Laboratory graph (e.g. `media-mueller-hinton`)
 * — so this checks the clinical map first, then falls back to a dynamic
 * import of the main registry for anything not found there, matching
 * `resolveRelated` in `core/laboratory/registry.ts` but never statically
 * importing that module (same bundle-safety rule as this file's header).
 */
export async function resolveClinicalRelated(ids: string[] | undefined): Promise<LaboratoryContent[]> {
  if (!ids || ids.length === 0) return []
  const { byId } = await loadClinicalRegistry()
  const found: LaboratoryContent[] = []
  const remaining: string[] = []
  for (const id of ids) {
    const hit = byId.get(id)
    if (hit) found.push(hit)
    else remaining.push(id)
  }
  if (remaining.length > 0) {
    const { getLabContentById } = await import('./registry')
    for (const id of remaining) {
      const hit = getLabContentById(id)
      if (hit) found.push(hit)
    }
  }
  return found
}

export interface ClinicalSearchHit extends LaboratorySearchHit {
  discipline?: string
}

function buildHaystack(item: LaboratoryContent): string {
  const parts: (string | undefined)[] = [item.title, item.subcategory, item.category, ...(item.searchKeywords ?? [])]
  if (item.category === 'concept') parts.push(item.summary)
  if (item.category === 'formula') parts.push(item.expression, item.domain)
  if (item.category === 'protocol') parts.push(item.purpose)
  return parts.filter(Boolean).join(' ').toLowerCase()
}

/** Local substring search over clinical content only. Global Universal Search (core/search) calls this via its own dynamic import, exactly the same pattern it already uses for the main Laboratory registry's `searchLaboratory` — see that file's header comment. */
export async function searchClinicalLaboratory(query: string): Promise<ClinicalSearchHit[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const { all } = await loadClinicalRegistry()
  return all
    .filter((c) => buildHaystack(c).includes(q))
    .map((c) => ({ id: c.id, category: c.category, title: c.title, subtitle: CLINICAL_CATEGORY_LABELS[c.category as ClinicalCategory], discipline: c.subcategory }))
}

export async function countClinicalRecords(): Promise<number> {
  const { all } = await loadClinicalRegistry()
  return all.length
}

/** Shared navigation helper: clinical ids (`clin-*`) route under `/laboratory/clinical/...`, everything else keeps the existing `/laboratory/...` path. Used by every place that turns a resolved `LaboratoryContent` item into a link (RelatedContentList, search results, saved items, etc.) so clinical cross-links never 404 against the main-registry-only route. */
export function labContentPath(id: string, category: LaboratoryCategory): string {
  return isClinicalContentId(id) ? `/laboratory/clinical/${category}/${id}` : `/laboratory/${category}/${id}`
}
