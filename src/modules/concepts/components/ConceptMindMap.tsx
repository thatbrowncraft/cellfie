import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TreeStructure } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components'
import type { MindMapNode } from '@/core/concepts'

interface ConceptMindMapProps {
  root: MindMapNode
}

interface LaidOutNode {
  node: MindMapNode
  x: number
  y: number
  depth: number
}

const LEVEL_HEIGHT = 110
const LEAF_WIDTH = 150

/** Assigns each node an x position by giving every leaf an equal horizontal slot and centering parents over their children — a simple, deterministic tidy-tree layout, no layout library needed. */
function layout(root: MindMapNode): { nodes: LaidOutNode[]; width: number } {
  const nodes: LaidOutNode[] = []
  let nextX = 0

  function place(node: MindMapNode, depth: number): number {
    if (node.children.length === 0) {
      const x = nextX * LEAF_WIDTH + LEAF_WIDTH / 2
      nextX += 1
      nodes.push({ node, x, y: depth * LEVEL_HEIGHT + 40, depth })
      return x
    }
    const childXs = node.children.map((c) => place(c, depth + 1))
    const x = childXs.reduce((a, b) => a + b, 0) / childXs.length
    nodes.push({ node, x, y: depth * LEVEL_HEIGHT + 40, depth })
    return x
  }

  place(root, 0)
  return { nodes, width: Math.max(nextX * LEAF_WIDTH, LEAF_WIDTH) }
}

/**
 * Mind map for a single concept (§13). Depth-2 tree built purely from
 * stored ConceptRelation rows and shared-tag pairs (core/concepts/graph.ts
 * `buildConceptMindMap`) — a concept with no relations renders an empty
 * state instead of fabricated branches.
 */
export function ConceptMindMap({ root }: ConceptMindMapProps) {
  const navigate = useNavigate()
  const { nodes, width } = useMemo(() => layout(root), [root])

  if (root.children.length === 0) {
    return (
      <EmptyState
        icon={<TreeStructure size={32} />}
        title="No related concepts yet"
        description="Once this concept shares a book page with another one — or you add a related concept manually — this mind map will branch out from here."
      />
    )
  }

  const height = (Math.max(...nodes.map((n) => n.depth)) + 1) * LEVEL_HEIGHT + 40
  const byId = new Map(nodes.map((n) => [n.node.id, n]))

  const edges: { from: LaidOutNode; to: LaidOutNode }[] = []
  function collectEdges(node: MindMapNode) {
    const from = byId.get(node.id)
    for (const child of node.children) {
      const to = byId.get(child.id)
      if (from && to) edges.push({ from, to })
      collectEdges(child)
    }
  }
  collectEdges(root)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={Math.max(width, 320)} height={height} role="img" aria-label={`Mind map for ${root.label}`}>
        {edges.map((e, i) => (
          <path
            key={i}
            d={`M ${e.from.x} ${e.from.y} C ${e.from.x} ${(e.from.y + e.to.y) / 2}, ${e.to.x} ${(e.from.y + e.to.y) / 2}, ${e.to.x} ${e.to.y}`}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth={1.5}
          />
        ))}
        {nodes.map((n) => {
          const isRoot = n.depth === 0
          return (
            <g
              key={n.node.id}
              transform={`translate(${n.x}, ${n.y})`}
              className="cursor-pointer"
              onClick={() => !isRoot && navigate(`/concepts/${n.node.id}`)}
            >
              <rect
                x={-LEAF_WIDTH / 2 + 8}
                y={-16}
                width={LEAF_WIDTH - 16}
                height={32}
                rx={16}
                fill={isRoot ? 'var(--color-highlight-terracotta)' : 'var(--color-bg-surface)'}
                stroke={isRoot ? 'transparent' : 'var(--color-border)'}
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-ui font-medium"
                style={{ fontSize: 11, fill: isRoot ? 'var(--color-bg-canvas)' : 'var(--color-text-primary)' }}
              >
                {n.node.label.length > 20 ? `${n.node.label.slice(0, 19)}…` : n.node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
