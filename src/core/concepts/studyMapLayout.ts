/**
 * core/concepts/studyMapLayout — pure geometry for StudyMapView.tsx.
 *
 * Turns a `StudyMap` (nodes/edges, see studyMap.ts) into pixel
 * positions, with no DOM measurement and no external graph library
 * (none is a project dependency — see graph.ts's own header comment on
 * hand-rolled rendering). Every node gets a fixed box size by kind, so
 * a wrapping/truncated label never throws the layout off; the renderer
 * is responsible for visually clamping label text to match.
 *
 * One layout function serves both map shapes:
 *   - 'procedure' is a single chain (each node has exactly one child),
 *     so every node lands in the same column and the result is a
 *     straight vertical flow with no extra-case code needed.
 *   - 'conceptual' branches, so descendants fan out horizontally,
 *     exactly the "clear hierarchy, branching, root concept" shape the
 *     redesign asked for.
 */

import type { StudyMap, StudyMapNode, StudyMapNodeKind } from './studyMap'

export interface PositionedNode extends StudyMapNode {
  x: number
  y: number
  w: number
  h: number
  cx: number
}

export interface PositionedEdge {
  id: string
  fromId: string
  toId: string
  /** SVG path `d` attribute — a cubic bezier from the parent's bottom-center to the child's top-center. */
  d: string
}

export interface StudyMapLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const BOX: Record<StudyMapNodeKind, { w: number; h: number }> = {
  root: { w: 176, h: 52 },
  category: { w: 168, h: 56 },
  step: { w: 192, h: 56 },
  outcome: { w: 192, h: 56 },
  detail: { w: 156, h: 52 }
}

const COL_W = 184
const ROW_H = 108
const MARGIN = 28

export function computeStudyMapLayout(map: StudyMap): StudyMapLayout {
  const childrenOf = new Map<string, string[]>()
  for (const e of map.edges) {
    const list = childrenOf.get(e.from) ?? []
    list.push(e.to)
    childrenOf.set(e.from, list)
  }
  const byId = new Map(map.nodes.map((n) => [n.id, n]))

  const xSlot = new Map<string, number>()
  const depthOf = new Map<string, number>()
  let nextLeafSlot = 0

  function visit(id: string, depth: number): void {
    depthOf.set(id, depth)
    const kids = childrenOf.get(id) ?? []
    if (kids.length === 0) {
      xSlot.set(id, nextLeafSlot)
      nextLeafSlot += 1
      return
    }
    for (const k of kids) {
      if (byId.has(k)) visit(k, depth + 1)
    }
    const xs = kids.map((k) => xSlot.get(k)).filter((v): v is number => v !== undefined)
    xSlot.set(id, xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : nextLeafSlot++)
  }
  if (byId.has(map.rootId)) visit(map.rootId, 0)

  const maxDepth = Math.max(0, ...[...depthOf.values()])

  const positioned = new Map<string, PositionedNode>()
  for (const node of map.nodes) {
    const box = BOX[node.kind]
    const slot = xSlot.get(node.id) ?? 0
    const depth = depthOf.get(node.id) ?? 0
    const cx = MARGIN + slot * COL_W + COL_W / 2
    const y = MARGIN + depth * ROW_H
    positioned.set(node.id, { ...node, x: cx - box.w / 2, y, w: box.w, h: box.h, cx })
  }

  const edges: PositionedEdge[] = []
  for (const e of map.edges) {
    const from = positioned.get(e.from)
    const to = positioned.get(e.to)
    if (!from || !to) continue
    const x1 = from.cx
    const y1 = from.y + from.h
    const x2 = to.cx
    const y2 = to.y
    const midY = (y1 + y2) / 2
    edges.push({ id: e.id, fromId: e.from, toId: e.to, d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}` })
  }

  const width = MARGIN * 2 + Math.max(1, nextLeafSlot) * COL_W
  const height = MARGIN * 2 + maxDepth * ROW_H + Math.max(...Object.values(BOX).map((b) => b.h))

  return { nodes: [...positioned.values()], edges, width, height }
}
