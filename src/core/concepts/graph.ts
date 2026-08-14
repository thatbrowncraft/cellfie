/**
 * core/concepts/graph — Concept Hub Refinement §3/§4/§5/§6/§15. A
 * Concept↔Concept edge exists ONLY if a `ConceptRelation` row with
 * `origin: 'manual'` exists — the person explicitly connecting two
 * concepts. This is the actual data-layer enforcement of "Connections
 * and Mind Map show only what the person created": both
 * `buildKnowledgeGraph` and `buildConceptMindMap` query
 * `db.conceptRelations` and immediately discard any row that isn't
 * `origin === 'manual'`, regardless of what else might be in that
 * table. (Historical 'scientific'-origin rows, from a prior version's
 * automatic co-occurrence discovery, are also actively deleted by
 * core/concepts/service.ts's `purgeAutomaticScientificRelations` — this
 * filter is defense in depth, not the only safeguard.) This is now the
 * SINGLE source of truth for both the per-concept Mind Map
 * (`buildConceptMindMap`) and the whole-library graph
 * (`buildKnowledgeGraph`) — no separate relatedness logic lives in
 * either one.
 *
 * `buildConceptMindMap` also folds in the person's own free-text Mind
 * Map annotation nodes (`ConceptAsset` kind `'mindmap-node'` — see
 * core/concepts/assets.ts) as a third branch type. These are
 * deliberately NOT `ConceptRelation` rows — they have no edge to any
 * real Concept, so they can never be mistaken for, or migrate into, a
 * Concept-to-Concept connection.
 *
 * Phase 2 correction: same-page / same-book PDF co-occurrence and
 * shared-tag pairing used to drive automatic "related" edges here (the
 * exact "DNA and Gram staining were on the same page" failure mode the
 * brief called out). That machinery has been removed, not merely
 * hidden — `getCoOccurrenceRelated` and the SHARED_TAG/CO_OCCURRENCE
 * edge kinds no longer exist. A book's own text can still make a
 * concept relevant to another one, but only by the person adding it
 * as a connection — never by page-proximity or literature co-occurrence
 * alone. Rendering is hand-rolled SVG/flexbox in
 * modules/concepts/components, not a graph library (no new dependency).
 */

import { db, type Concept, type ConceptSource } from '../db'
import { listConceptAssets } from './assets'

export type GraphNodeKind = 'concept' | 'book'
export type GraphEdgeKind = 'MANUAL' | 'REFERENCES'

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
 * (REFERENCES edges from ConceptSource rows with a libraryItemId), and
 * concept-to-concept edges from user-created (`origin: 'manual'`)
 * ConceptRelation rows only — the same rows Related Concepts and the
 * per-concept Mind Map read. Capped to the most-referenced concepts so
 * the SVG stays readable on a library with thousands of concepts.
 */
export async function buildKnowledgeGraph(maxConcepts = 40): Promise<KnowledgeGraphData> {
  const [concepts, sources, relations, items] = await Promise.all([
    db.concepts.toArray(),
    db.conceptSources.toArray(),
    db.conceptRelations.where('origin').equals('manual').toArray(),
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
    edges.push({
      id: `rel:${r.id}`,
      source: `concept:${r.conceptAId}`,
      target: `concept:${r.conceptBId}`,
      kind: 'MANUAL'
    })
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
  /** Undefined for the root, for a user-created annotation node, and — no longer possible — for anything scientific. Present ('manual') only on a concept-to-concept branch. */
  edgeOrigin?: 'manual'
  /** True for the person's own free-text Mind Map annotation nodes (ConceptAsset kind 'mindmap-node') — rendered distinctly, never confused with a real linked Concept. */
  isAnnotation?: boolean
  children: MindMapNode[]
}

/**
 * Builds a small (depth-2) mind map rooted at one concept, following
 * ONLY user-created (`origin: 'manual'`) `ConceptRelation` rows — the
 * exact same filtered set Related Concepts reads. Also appends the
 * person's own free-text annotation nodes (`ConceptAsset` kind
 * `'mindmap-node'`) as depth-1 leaves alongside real concept branches.
 * A concept with neither produces a root with no children; the caller
 * shows "No concept connections yet." rather than fabricating branches.
 */
export async function buildConceptMindMap(rootId: string): Promise<MindMapNode> {
  const root = await db.concepts.get(rootId)
  if (!root) return { id: rootId, label: 'Unknown concept', children: [] }

  const [allConcepts, allRelations, annotationAssets] = await Promise.all([
    db.concepts.toArray(),
    db.conceptRelations.where('origin').equals('manual').toArray(),
    listConceptAssets(rootId, 'mindmap-node')
  ])
  const byId = new Map(allConcepts.map((c) => [c.id, c]))

  const edgesByConcept = new Map<string, string[]>()
  for (const r of allRelations) {
    const add = (from: string, to: string) => {
      const list = edgesByConcept.get(from) ?? []
      list.push(to)
      edgesByConcept.set(from, list)
    }
    add(r.conceptAId, r.conceptBId)
    add(r.conceptBId, r.conceptAId)
  }

  function buildNode(conceptId: string, depth: number, visited: Set<string>, edgeOrigin?: 'manual'): MindMapNode {
    const concept = byId.get(conceptId)
    const label = concept?.name ?? 'Unknown concept'
    if (depth <= 0) return { id: conceptId, label, edgeOrigin, children: [] }

    const relatedIds = (edgesByConcept.get(conceptId) ?? []).filter((otherId) => !visited.has(otherId)).slice(0, 6)

    const nextVisited = new Set(visited)
    relatedIds.forEach((otherId) => nextVisited.add(otherId))

    const children = relatedIds.map((otherId) => buildNode(otherId, depth - 1, nextVisited, 'manual'))
    return { id: conceptId, label, edgeOrigin, children }
  }

  const node = buildNode(rootId, 2, new Set([rootId]))
  const annotationNodes: MindMapNode[] = annotationAssets.map((a) => ({
    id: `annotation:${a.id}`,
    label: a.label,
    isAnnotation: true,
    children: []
  }))
  return { ...node, children: [...node.children, ...annotationNodes] }
}

export type { Concept, ConceptSource }
