/**
 * core/concepts/mindMapStudio — Second Refinement §Part 1. CRUD for
 * `ConceptMapNode`/`ConceptMapEdge` (see core/db's doc comments for
 * why these are separate tables from the old ConceptAsset
 * 'mindmap-node' annotation). Everything here is plain user data: a
 * label the person typed, a shape they picked, a position they
 * dragged to, and — since Third Refinement §17 — an optional
 * description they wrote. Nothing is generated.
 *
 * Third Refinement §16/§21 also adds a tiny bit of per-concept UI
 * state: whether this concept's map has been explicitly "Saved" (and
 * should therefore reopen in View Mode rather than Edit Mode). This
 * reuses the existing generic `appSettings` key/value table rather
 * than adding a new Dexie table for a single boolean.
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
  accent: ConceptMapNodeAccent = 'terracotta',
  description?: string
): Promise<ConceptMapNode | undefined> {
  const trimmed = label.trim()
  if (!trimmed) return undefined
  const now = Date.now()
  const node: ConceptMapNode = {
    id: crypto.randomUUID(),
    conceptId,
    label: trimmed,
    description: description?.trim() || undefined,
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
  changes: Partial<Pick<ConceptMapNode, 'label' | 'shape' | 'accent' | 'x' | 'y' | 'description'>>
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

function mapSavedKey(conceptId: string): string {
  return `mindmap-saved:${conceptId}`
}

/**
 * Third Refinement §16/§21 — "BUILD → SAVE → STUDY". A map starts in
 * Edit Mode (default `false`, including for every map that existed
 * before this feature shipped — nothing about a pre-existing map's
 * behavior changes until the person explicitly presses Save Map for
 * the first time). Once saved, reopening the concept shows View Mode
 * until "Edit Map" is pressed again.
 */
export async function isMapSaved(conceptId: string): Promise<boolean> {
  const record = await db.appSettings.get(mapSavedKey(conceptId))
  return record?.value === true
}

export async function setMapSaved(conceptId: string, saved: boolean): Promise<void> {
  await db.appSettings.put({ key: mapSavedKey(conceptId), value: saved })
}
