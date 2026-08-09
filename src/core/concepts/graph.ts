/**
 * core/concepts/graph — Sprint 3 §11/§13. Builds plain node/edge data
 * from stored records only: a Concept↔Concept edge exists only if a
 * ConceptRelation row exists (manual) or both concepts share a tag/
 * source (derived, but still from real stored data — never "X appears
 * near Y"). Rendering is hand-rolled SVG in modules/concepts/components,
 * not a graph library (no new dependency, per the brief).
 */

import { db, type Concept, type ConceptSource } from '../db'
import { getRelatedConceptIds } from './service'

export type GraphNodeKind = 'concept' | 'book'
export type GraphEdgeKind = 'RELATED_TO' | 'REFERENCES' | 'SHARED_TAG' | 'CO_OCCURRENCE'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  /** For concept nodes: how many sources link to it — drives node size. */
  weight: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: GraphEdgeKind
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Key for a (book, page) pair — the unit of evidence §5A/§6 relationships are built from. */
function pageKey(libraryItemId: string, pageNumber: number): string {
  return `${libraryItemId}:${pageNumber}`
}

export interface CoOccurrenceMatch {
  concept: Concept
  /** Every (book, page) both concepts have a ConceptSource on — the traceable "why" behind the relationship (§6). */
  sharedPages: { libraryItemId: string; pageNumber: number }[]
}

/**
 * Sprint 3 Correction §5A/§5B/§6 — concepts related by *actual shared
 * source evidence*: at least one ConceptSource pointing at the exact
 * same book+page as this concept. Deliberately never inferred from
 * "somewhere in the same book" alone (§5C/§6's PCR/DNA-in-a-700-page-book
 * caution) — page-level, not book-level, co-occurrence. `allSources` can
 * be passed in by callers that already loaded the whole table (e.g. the
 * whole-library graph) to avoid a redundant read.
 */
export async function getCoOccurrenceRelated(conceptId: string, allSources?: ConceptSource[]): Promise<CoOccurrenceMatch[]> {
  const sources = allSources ?? (await db.conceptSources.toArray())
  const mine = sources.filter((s) => s.conceptId === conceptId && s.libraryItemId && s.pageNumber != null)
  if (mine.length === 0) return []
  const myKeys = new Set(mine.map((s) => pageKey(s.libraryItemId as string, s.pageNumber as number)))

  const sharedByOther = new Map<string, { libraryItemId: string; pageNumber: number }[]>()
  for (const s of sources) {
    if (s.conceptId === conceptId || !s.libraryItemId || s.pageNumber == null) continue
    if (!myKeys.has(pageKey(s.libraryItemId, s.pageNumber))) continue
    const list = sharedByOther.get(s.conceptId) ?? []
    if (!list.some((p) => p.libraryItemId === s.libraryItemId && p.pageNumber === s.pageNumber)) {
      list.push({ libraryItemId: s.libraryItemId, pageNumber: s.pageNumber })
    }
    sharedByOther.set(s.conceptId, list)
  }
  if (sharedByOther.size === 0) return []

  const otherConcepts = await db.concepts.bulkGet(Array.from(sharedByOther.keys()))
  const results: CoOccurrenceMatch[] = []
  otherConcepts.forEach((concept) => {
    if (!concept) return
    const pages = sharedByOther.get(concept.id)
    if (pages) results.push({ concept, sharedPages: pages })
  })
  return results.sort((a, b) => b.sharedPages.length - a.sharedPages.length)
}

/**
 * Whole-library graph: concept nodes plus the books that reference them
 * (REFERENCES edges from ConceptSource rows with a libraryItemId),
 * concept-to-concept RELATED_TO edges from explicit ConceptRelation rows,
 * and SHARED_TAG edges between concepts that share at least one tag.
 * Capped to the most-referenced concepts so the SVG stays readable on a
 * library with thousands of concepts (§21 performance).
 */
export async function buildKnowledgeGraph(maxConcepts = 40): Promise<KnowledgeGraphData> {
  const [concepts, sources, relations, items] = await Promise.all([
    db.concepts.toArray(),
    db.conceptSources.toArray(),
    db.conceptRelations.toArray(),
    db.libraryItems.toArray()
  ])

  const sourceCountByConcept = new Map<string, number>()
  for (const s of sources) sourceCountByConcept.set(s.conceptId, (sourceCountByConcept.get(s.conceptId) ?? 0) + 1)

  const topConcepts = [...concepts]
    .sort((a, b) => (sourceCountByConcept.get(b.id) ?? 0) - (sourceCountByConcept.get(a.id) ?? 0))
    .slice(0, maxConcepts)
  const topConceptIds = new Set(topConcepts.map((c) => c.id))
  const itemsById = new Map(items.map((i) => [i.id, i]))

  const nodes: GraphNode[] = topConcepts.map((c) => ({
    id: `concept:${c.id}`,
    kind: 'concept',
    label: c.name,
    weight: sourceCountByConcept.get(c.id) ?? 0
  }))

  const edges: GraphEdge[] = []
  const bookNodeIds = new Set<string>()

  for (const s of sources) {
    if (!topConceptIds.has(s.conceptId) || !s.libraryItemId) continue
    const item = itemsById.get(s.libraryItemId)
    if (!item) continue
    const bookNodeId = `book:${item.id}`
    if (!bookNodeIds.has(bookNodeId)) {
      bookNodeIds.add(bookNodeId)
      nodes.push({ id: bookNodeId, kind: 'book', label: item.title, weight: 0 })
    }
    edges.push({ id: `ref:${s.id}`, source: bookNodeId, target: `concept:${s.conceptId}`, kind: 'REFERENCES' })
  }

  for (const r of relations) {
    if (!topConceptIds.has(r.conceptAId) || !topConceptIds.has(r.conceptBId)) continue
    edges.push({ id: `rel:${r.id}`, source: `concept:${r.conceptAId}`, target: `concept:${r.conceptBId}`, kind: 'RELATED_TO' })
  }

  for (let i = 0; i < topConcepts.length; i += 1) {
    for (let j = i + 1; j < topConcepts.length; j += 1) {
      const a = topConcepts[i]
      const b = topConcepts[j]
      const shared = a.tags.some((t) => b.tags.includes(t))
      if (shared) edges.push({ id: `tag:${a.id}:${b.id}`, source: `concept:${a.id}`, target: `concept:${b.id}`, kind: 'SHARED_TAG' })
    }
  }

  // Sprint 3 Correction §5A/§8 — page-level co-occurrence edges, computed
  // once across the whole top-concept set (rather than per-concept) so
  // this stays a single pass over `sources`.
  const byPage = new Map<string, Set<string>>()
  for (const s of sources) {
    if (!topConceptIds.has(s.conceptId) || !s.libraryItemId || s.pageNumber == null) continue
    const key = `${s.libraryItemId}:${s.pageNumber}`
    const set = byPage.get(key) ?? new Set<string>()
    set.add(s.conceptId)
    byPage.set(key, set)
  }
  const coOccurrenceCount = new Map<string, number>()
  for (const conceptIds of byPage.values()) {
    const ids = Array.from(conceptIds)
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = [ids[i], ids[j]].sort().join('::')
        coOccurrenceCount.set(key, (coOccurrenceCount.get(key) ?? 0) + 1)
      }
    }
  }
  coOccurrenceCount.forEach((_count, key) => {
    const [a, b] = key.split('::')
    edges.push({ id: `cooc:${key}`, source: `concept:${a}`, target: `concept:${b}`, kind: 'CO_OCCURRENCE' })
  })

  // Deduplicate REFERENCES edges (many sources can point book→concept).
  const seen = new Set<string>()
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.kind}:${e.source}:${e.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { nodes, edges: dedupedEdges }
}

export interface MindMapNode {
  id: string
  label: string
  children: MindMapNode[]
}

/**
 * Builds a small (depth-2) mind map rooted at one concept, following only
 * stored ConceptRelation edges — manual relations plus shared-tag
 * relations, matching the graph's edge sources. A concept with no
 * relations produces a root with no children; callers show an empty
 * state rather than fabricating branches (§13).
 */
export async function buildConceptMindMap(rootId: string): Promise<MindMapNode> {
  const root = await db.concepts.get(rootId)
  if (!root) return { id: rootId, label: 'Unknown concept', children: [] }

  const [allConcepts, allSources] = await Promise.all([db.concepts.toArray(), db.conceptSources.toArray()])
  const byId = new Map(allConcepts.map((c) => [c.id, c]))

  // Priority order: explicit manual relations, then page-level source
  // co-occurrence (§5A/§8 — this is what makes a book's own text able to
  // branch the mind map without any manual relating), then shared tags.
  async function relatedIds(conceptId: string): Promise<string[]> {
    const explicit = await getRelatedConceptIds(conceptId)
    const coOccurrence = (await getCoOccurrenceRelated(conceptId, allSources)).map((m) => m.concept.id)
    const concept = byId.get(conceptId)
    const sharedTag = concept
      ? allConcepts.filter((c) => c.id !== conceptId && c.tags.some((t) => concept.tags.includes(t))).map((c) => c.id)
      : []
    return Array.from(new Set([...explicit, ...coOccurrence, ...sharedTag]))
  }

  async function buildNode(conceptId: string, depth: number, visited: Set<string>): Promise<MindMapNode> {
    const concept = byId.get(conceptId)
    const label = concept?.name ?? 'Unknown concept'
    if (depth <= 0) return { id: conceptId, label, children: [] }
    const ids = (await relatedIds(conceptId)).filter((id) => !visited.has(id))
    const nextVisited = new Set(visited)
    ids.forEach((id) => nextVisited.add(id))
    const children = await Promise.all(ids.slice(0, 6).map((id) => buildNode(id, depth - 1, nextVisited)))
    return { id: conceptId, label, children }
  }

  return buildNode(rootId, 2, new Set([rootId]))
}

export type { Concept, ConceptSource }
