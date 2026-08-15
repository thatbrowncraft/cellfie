/**
 * core/concepts/mindMapStudio — Second Refinement §Part 1. CRUD for
 * `ConceptMapNode`/`ConceptMapEdge` (see core/db's doc comments for
 * why these are separate tables from the old ConceptAsset
 * 'mindmap-node' annotation). Everything here is plain user data: a
 * label the person typed, a shape they picked, a position they
 * dragged to. Nothing is generated.
 */

import { db, type ConceptMapEdge, type ConceptMapNode, type ConceptMapNodeAccent, type ConceptMapNodeShape } from '../db'

export async function listMapNodes(conceptId: string): Promise<ConceptMapNode[]> {
  return db.conceptMapNodes.where('conceptId').equals(conceptId).toArray()
}

export async function listMapEdges(conceptId: string): Promise<ConceptMapEdge[]> {
  return db.conceptMapEdges.where('conceptId').equals(conceptId).toArray()
}

export async function addMapNode(
  conceptId: string,
  label: string,
  position: { x: number; y: number },
  shape: ConceptMapNodeShape = 'rounded',
  accent: ConceptMapNodeAccent = 'terracotta'
): Promise<ConceptMapNode | undefined> {
  const trimmed = label.trim()
  if (!trimmed) return undefined
  const now = Date.now()
  const node: ConceptMapNode = {
    id: crypto.randomUUID(),
    conceptId,
    label: trimmed,
    shape,
    accent,
    x: position.x,
    y: position.y,
    createdAt: now,
    updatedAt: now
  }
  await db.conceptMapNodes.add(node)
  return node
}

export async function updateMapNode(
  id: string,
  changes: Partial<Pick<ConceptMapNode, 'label' | 'shape' | 'accent' | 'x' | 'y'>>
): Promise<void> {
  await db.conceptMapNodes.update(id, { ...changes, updatedAt: Date.now() })
}

/** Deletes a node and cascades to every edge that touches it — an edge can never dangle on a missing endpoint. */
export async function deleteMapNode(id: string): Promise<void> {
  await db.transaction('rw', db.conceptMapNodes, db.conceptMapEdges, async () => {
    await db.conceptMapNodes.delete(id)
    const asSource = await db.conceptMapEdges.where('sourceNodeId').equals(id).toArray()
    const asTarget = await db.conceptMapEdges.where('targetNodeId').equals(id).toArray()
    await Promise.all([...asSource, ...asTarget].map((e) => db.conceptMapEdges.delete(e.id)))
  })
}

export async function addMapEdge(
  conceptId: string,
  sourceNodeId: string,
  targetNodeId: string,
  label?: string
): Promise<ConceptMapEdge | undefined> {
  if (sourceNodeId === targetNodeId) return undefined
  const edge: ConceptMapEdge = {
    id: crypto.randomUUID(),
    conceptId,
    sourceNodeId,
    targetNodeId,
    label: label?.trim() || undefined,
    createdAt: Date.now()
  }
  await db.conceptMapEdges.add(edge)
  return edge
}

export async function deleteMapEdge(id: string): Promise<void> {
  await db.conceptMapEdges.delete(id)
}

/** Every node/edge for a concept — used when deleting the concept itself, so nothing is left orphaned. */
export async function removeAllMapDataFor(conceptId: string): Promise<void> {
  await db.transaction('rw', db.conceptMapNodes, db.conceptMapEdges, async () => {
    await db.conceptMapNodes.where('conceptId').equals(conceptId).delete()
    await db.conceptMapEdges.where('conceptId').equals(conceptId).delete()
  })
}
