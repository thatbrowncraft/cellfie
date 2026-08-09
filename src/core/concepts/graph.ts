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
export type GraphEdgeKind = 'RELATED_TO' | 'REFERENCES' | 'SHARED_TAG'

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

  const allConcepts = await db.concepts.toArray()
  const byId = new Map(allConcepts.map((c) => [c.id, c]))

  async function relatedIdsWithSharedTags(conceptId: string): Promise<string[]> {
    const explicit = await getRelatedConceptIds(conceptId)
    const concept = byId.get(conceptId)
    const sharedTag = concept
      ? allConcepts.filter((c) => c.id !== conceptId && c.tags.some((t) => concept.tags.includes(t))).map((c) => c.id)
      : []
    return Array.from(new Set([...explicit, ...sharedTag]))
  }

  async function buildNode(conceptId: string, depth: number, visited: Set<string>): Promise<MindMapNode> {
    const concept = byId.get(conceptId)
    const label = concept?.name ?? 'Unknown concept'
    if (depth <= 0) return { id: conceptId, label, children: [] }
    const relatedIds = (await relatedIdsWithSharedTags(conceptId)).filter((id) => !visited.has(id))
    const nextVisited = new Set(visited)
    relatedIds.forEach((id) => nextVisited.add(id))
    const children = await Promise.all(relatedIds.slice(0, 6).map((id) => buildNode(id, depth - 1, nextVisited)))
    return { id: conceptId, label, children }
  }

  return buildNode(rootId, 2, new Set([rootId]))
}

export type { Concept, ConceptSource }
