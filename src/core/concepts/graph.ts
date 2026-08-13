/**
 * core/concepts/graph — Concept 2.0 Phase 3. A Concept↔Concept edge
 * exists ONLY if a `ConceptRelation` row exists — 'scientific' (real
 * evidence, discovered by `discoverScientificRelations`/
 * `fetchScientificRelationEvidence`) or 'manual' (the person explicitly
 * connected them). This is now the SINGLE source of truth for both the
 * per-concept Mind Map (`buildConceptMindMap`) and the whole-library
 * graph (`buildKnowledgeGraph`) — no separate relatedness logic lives in
 * either one.
 *
 * Phase 2 correction: same-page / same-book PDF co-occurrence and
 * shared-tag pairing used to drive automatic "related" edges here (the
 * exact "DNA and Gram staining were on the same page" failure mode the
 * brief called out). That machinery has been removed, not merely
 * hidden — `getCoOccurrenceRelated` and the SHARED_TAG/CO_OCCURRENCE
 * edge kinds no longer exist. A book's own text can still make a
 * concept relevant to another one, but only by the person adding it
 * as a connection, or by a real online scientific source backing it —
 * never by page-proximity alone. Rendering is hand-rolled SVG/flexbox
 * in modules/concepts/components, not a graph library (no new
 * dependency).
 */

import { db, type Concept, type ConceptRelationOrigin, type ConceptSource } from '../db'

export type GraphNodeKind = 'concept' | 'book'
export type GraphEdgeKind = 'SCIENTIFIC' | 'MANUAL' | 'REFERENCES'

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
 * concept-to-concept edges split into SCIENTIFIC/MANUAL by each stored
 * ConceptRelation's own `origin` — the same rows Related Concepts and
 * the per-concept Mind Map read. Capped to the most-referenced concepts
 * so the SVG stays readable on a library with thousands of concepts.
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
    edges.push({
      id: `rel:${r.id}`,
      source: `concept:${r.conceptAId}`,
      target: `concept:${r.conceptBId}`,
      kind: r.origin === 'scientific' ? 'SCIENTIFIC' : 'MANUAL'
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
  /** Origin of the relation connecting this node to its parent — undefined only for the root. */
  edgeOrigin?: ConceptRelationOrigin
  /** Present only on a scientific edge — the same relationType shown in Related Concepts, for a one-line "why" under the node. */
  relationType?: string
  children: MindMapNode[]
}

/**
 * Builds a small (depth-2) mind map rooted at one concept, following
 * ONLY stored `ConceptRelation` rows — the exact same table Related
 * Concepts reads (Phase 2's `relatedEntries`). Scientific edges are
 * ordered before manual ones at each level since they carry stronger
 * evidence. A concept with no relations at all produces a root with no
 * children; the caller shows "No verified scientific connections yet"
 * rather than fabricating branches.
 */
export async function buildConceptMindMap(rootId: string): Promise<MindMapNode> {
  const root = await db.concepts.get(rootId)
  if (!root) return { id: rootId, label: 'Unknown concept', children: [] }

  const [allConcepts, allRelations] = await Promise.all([db.concepts.toArray(), db.conceptRelations.toArray()])
  const byId = new Map(allConcepts.map((c) => [c.id, c]))

  const edgesByConcept = new Map<string, { otherId: string; origin: ConceptRelationOrigin; relationType?: string }[]>()
  for (const r of allRelations) {
    const add = (from: string, to: string) => {
      const list = edgesByConcept.get(from) ?? []
      list.push({ otherId: to, origin: r.origin, relationType: r.relationType })
      edgesByConcept.set(from, list)
    }
    add(r.conceptAId, r.conceptBId)
    add(r.conceptBId, r.conceptAId)
  }

  function buildNode(
    conceptId: string,
    depth: number,
    visited: Set<string>,
    edgeOrigin?: ConceptRelationOrigin,
    relationType?: string
  ): MindMapNode {
    const concept = byId.get(conceptId)
    const label = concept?.name ?? 'Unknown concept'
    if (depth <= 0) return { id: conceptId, label, edgeOrigin, relationType, children: [] }

    const related = (edgesByConcept.get(conceptId) ?? [])
      .filter((e) => !visited.has(e.otherId))
      .sort((a, b) => (a.origin === b.origin ? 0 : a.origin === 'scientific' ? -1 : 1))
      .slice(0, 6)

    const nextVisited = new Set(visited)
    related.forEach((e) => nextVisited.add(e.otherId))

    const children = related.map((e) => buildNode(e.otherId, depth - 1, nextVisited, e.origin, e.relationType))
    return { id: conceptId, label, edgeOrigin, relationType, children }
  }

  return buildNode(rootId, 2, new Set([rootId]))
}

export type { Concept, ConceptSource }
