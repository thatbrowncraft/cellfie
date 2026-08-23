/**
 * core/laboratory/knowledgeLayer — Laboratory 2.0 brief §16-21.
 *
 * Deliberately thin, mirroring `core/organisms/knowledgeLayer.ts`
 * exactly: every real retrieval primitive already exists elsewhere in
 * the app, so this module is just Laboratory-shaped wiring on top of it,
 * not a second retrieval stack (brief §29-30, "do not build a second
 * Library" / "do not build a second Online Knowledge engine").
 *
 *   - "My Library" mode reuses `lookupInAllLibrarySources` /
 *     `lookupInSpecificLibrarySource` from `core/organisms/librarySources`
 *     (which itself wraps `core/concepts/librarySearch` +
 *     `core/concepts/documentText`) — genuinely generic term search over
 *     the user's own imported books, nothing organism-specific about it.
 *   - "Online Knowledge" mode reuses `fetchOnlineSummary` and
 *     `fetchMeshClassification` from `core/concepts/onlineKnowledge` —
 *     the same PubMed/Wikipedia-tier summary and NCBI MeSH scope-note
 *     lookups the Concept Hub and Organism Explorer already use.
 *
 * Three-layer separation (brief §16-21) is enforced by construction:
 * a lookup only ever reads ONE mode per call — 'my-library' never falls
 * back to 'online' silently, and neither ever mixes into the curated
 * Cellfie JSON that the caller already has from the registry. The
 * caller (LaboratoryDetailPage) is responsible for labeling each layer
 * distinctly in the UI and for triggering lookups only on explicit user
 * action, never automatically on page load (same "no silent trusted-
 * source supplementation" rule the organism Knowledge Layer follows).
 *
 * HONEST SCOPE: a lab topic search term is usually a technique/media/
 * test/equipment/formula name (e.g. "Gram staining", "MacConkey Agar"),
 * not an organism binomial — `fetchOnlineSummary` and
 * `fetchMeshClassification` are general-purpose term lookups, so they
 * work the same way here as they do for an organism name. No fabricated
 * excerpt, no invented URL, no source mislabeling: every returned field
 * traces to a real call into the existing modules above.
 */
import { db } from '../db'
import { fetchMeshClassification, fetchOnlineSummary, isLikelyOnline, type MeshClassification, type OnlineSummary } from '../concepts/onlineKnowledge'
import { lookupInAllLibrarySources, lookupInSpecificLibrarySource } from '../organisms/librarySources'
import type { KnowledgeSourceMode, LibrarySourceExcerpt, OrganismSource as LabSource } from '../organisms/types'

export type { KnowledgeSourceMode, LibrarySourceExcerpt }
export type { LabSource }

const KL_CACHE_PREFIX = 'labKnowledgeLayer:v1:'
const KL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days — same horizon as onlineKnowledge.ts / organisms/knowledgeLayer.ts

export type LabKnowledgeLookupStatus = 'found' | 'not-found' | 'not-found-in-source' | 'offline' | 'error'

export interface LabKnowledgeLookupResult {
  status: LabKnowledgeLookupStatus
  searchedSourceName?: string
  generalReference?: { text: string; sourceName: string; sourceUrl: string; isAbstract?: boolean }
  meshScopeNote?: { text: string; sourceName: string; sourceUrl: string }
  libraryExcerpts?: LibrarySourceExcerpt[]
  sources: LabSource[]
  retrievedAt?: number
}

interface KLCacheEntry {
  fetchedAt: number
  result: LabKnowledgeLookupResult
}

function cacheKeyFor(labContentId: string, mode: KnowledgeSourceMode, libraryItemId?: string): string {
  if (mode === 'trusted') return `${KL_CACHE_PREFIX}${labContentId}:online`
  if (mode === 'specific-source') return `${KL_CACHE_PREFIX}${labContentId}:specific:${libraryItemId ?? 'unknown'}`
  return `${KL_CACHE_PREFIX}${labContentId}:my-sources`
}

async function readCache(key: string): Promise<KLCacheEntry | undefined> {
  const record = await db.appSettings.get(key)
  return record?.value as KLCacheEntry | undefined
}

async function writeCache(key: string, result: LabKnowledgeLookupResult): Promise<void> {
  await db.appSettings.put({ key, value: { fetchedAt: Date.now(), result } as KLCacheEntry })
}

export interface LabKnowledgeLookupOptions {
  mode: KnowledgeSourceMode
  libraryItemId?: string
  forceRefresh?: boolean
}

/**
 * Looks up a curated Laboratory topic (by its display title, e.g.
 * "Gram Staining") in either "My Library" or "Online Knowledge".
 * `labContentId` is only used to namespace the cache — never sent
 * anywhere, never mixed into the result.
 */
export async function lookupLabTopicKnowledge(
  title: string,
  labContentId: string,
  options: LabKnowledgeLookupOptions
): Promise<LabKnowledgeLookupResult> {
  const { mode, libraryItemId, forceRefresh } = options
  const cacheKey = cacheKeyFor(labContentId, mode, libraryItemId)

  const cached = await readCache(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < KL_CACHE_TTL_MS) {
    return cached.result
  }

  if (mode === 'my-sources' || mode === 'specific-source') {
    return lookupFromLibrary(title, mode, cacheKey, libraryItemId)
  }

  return lookupFromOnline(title, cacheKey, cached?.result)
}

async function lookupFromLibrary(
  title: string,
  mode: 'my-sources' | 'specific-source',
  cacheKey: string,
  libraryItemId?: string
): Promise<LabKnowledgeLookupResult> {
  if (mode === 'specific-source' && !libraryItemId) return { status: 'not-found', sources: [] }

  const result =
    mode === 'specific-source' ? await lookupInSpecificLibrarySource(title, libraryItemId as string) : await lookupInAllLibrarySources(title)

  if (result.excerpts.length === 0) {
    // Not the same as 'not-found' — this specific source (or the whole
    // library) simply doesn't cover the topic; Online Knowledge remains
    // a separate, explicit option, never an automatic fallback.
    const searchedSourceName = mode === 'specific-source' ? result.matchedBooks[0]?.title : undefined
    return { status: 'not-found-in-source', searchedSourceName, sources: [] }
  }

  const lookupResult: LabKnowledgeLookupResult = {
    status: 'found',
    libraryExcerpts: result.excerpts,
    sources: result.sources,
    retrievedAt: Date.now()
  }
  await writeCache(cacheKey, lookupResult)
  return lookupResult
}

async function lookupFromOnline(title: string, cacheKey: string, staleResult?: LabKnowledgeLookupResult): Promise<LabKnowledgeLookupResult> {
  if (!isLikelyOnline()) {
    // Stale-beats-nothing offline fallback, same rule as onlineKnowledge.ts
    // and organisms/knowledgeLayer.ts — but only ever the same layer's own
    // stale cache, never quietly substituting a different mode's result.
    return staleResult ?? { status: 'offline', sources: [] }
  }

  let summary: OnlineSummary | undefined
  let mesh: MeshClassification | undefined
  try {
    const results = await Promise.all([fetchOnlineSummary(title), fetchMeshClassification(title)])
    summary = results[0]
    mesh = results[1]
  } catch {
    // fetchOnlineSummary/fetchMeshClassification are documented to never
    // throw — this is a last-resort safety net only.
    return { status: 'error', sources: [] }
  }

  if (!summary && !mesh) {
    const emptyResult: LabKnowledgeLookupResult = { status: 'not-found', sources: [] }
    await writeCache(cacheKey, emptyResult)
    return emptyResult
  }

  const sources: LabSource[] = []
  if (summary) sources.push({ name: summary.sourceName, kind: summary.isAbstract ? 'scientific' : 'educational', url: summary.sourceUrl })
  if (mesh) sources.push({ name: mesh.sourceName, kind: 'scientific', url: mesh.sourceUrl })

  const lookupResult: LabKnowledgeLookupResult = {
    status: 'found',
    generalReference: summary ? { text: summary.extract, sourceName: summary.sourceName, sourceUrl: summary.sourceUrl, isAbstract: summary.isAbstract } : undefined,
    meshScopeNote: mesh?.scopeNote ? { text: mesh.scopeNote, sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl } : undefined,
    sources,
    retrievedAt: Date.now()
  }
  await writeCache(cacheKey, lookupResult)
  return lookupResult
}
