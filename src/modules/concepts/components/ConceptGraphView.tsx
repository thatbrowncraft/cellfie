import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KnowledgeGraphData } from '@/core/concepts'
import { EmptyState } from '@/shared/components'
import { GitBranch } from '@phosphor-icons/react'

interface ConceptGraphViewProps {
  data: KnowledgeGraphData
}

const WIDTH = 720
const HEIGHT = 520
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2

const edgeColor: Record<string, string> = {
  RELATED_TO: 'var(--color-highlight-terracotta)',
  REFERENCES: 'var(--color-border-strong)',
  SHARED_TAG: 'var(--color-accent-sage)'
}

/**
 * Whole-library knowledge graph (§11/§12). Plain SVG, no graph package:
 * nodes are laid out on a circle (concepts on an inner ring, books on an
 * outer ring) since a force simulation would need a new dependency this
 * project deliberately avoids. Every edge drawn corresponds to a real
 * ConceptRelation, ConceptSource, or shared-tag pair — see
 * core/concepts/graph.ts.
 */
export function ConceptGraphView({ data }: ConceptGraphViewProps) {
  const navigate = useNavigate()

  const positions = useMemo(() => {
    const concepts = data.nodes.filter((n) => n.kind === 'concept')
    const books = data.nodes.filter((n) => n.kind === 'book')
    const map = new Map<string, { x: number; y: number }>()

    const innerRadius = Math.min(WIDTH, HEIGHT) / 2 - 140
    concepts.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(concepts.length, 1) - Math.PI / 2
      map.set(node.id, { x: CENTER_X + innerRadius * Math.cos(angle), y: CENTER_Y + innerRadius * Math.sin(angle) })
    })

    const outerRadius = Math.min(WIDTH, HEIGHT) / 2 - 40
    books.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(books.length, 1) - Math.PI / 2 + Math.PI / (books.length * 2 || 1)
      map.set(node.id, { x: CENTER_X + outerRadius * Math.cos(angle), y: CENTER_Y + outerRadius * Math.sin(angle) })
    })

    return map
  }, [data.nodes])

  if (data.nodes.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch size={32} />}
        title="Nothing to graph yet"
        description="Once concepts have sources or relationships, they'll appear here connected to the books, highlights, and notes they come from."
      />
    )
  }

  const maxWeight = Math.max(1, ...data.nodes.map((n) => n.weight))

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Concept knowledge graph">
        <g>
          {data.edges.map((edge) => {
            const from = positions.get(edge.source)
            const to = positions.get(edge.target)
            if (!from || !to) return null
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edgeColor[edge.kind] ?? 'var(--color-border)'}
                strokeWidth={edge.kind === 'REFERENCES' ? 1 : 1.5}
                strokeDasharray={edge.kind === 'SHARED_TAG' ? '3 3' : undefined}
                opacity={0.6}
              />
            )
          })}
        </g>
        <g>
          {data.nodes.map((node) => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const isConcept = node.kind === 'concept'
            const radius = isConcept ? 8 + (node.weight / maxWeight) * 10 : 5
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={isConcept ? 'cursor-pointer' : ''}
                onClick={() => isConcept && navigate(`/concepts/${node.id.replace('concept:', '')}`)}
              >
                <circle
                  r={radius}
                  fill={isConcept ? 'var(--color-highlight-terracotta)' : 'var(--color-accent-olive)'}
                  opacity={isConcept ? 0.9 : 0.7}
                />
                <text
                  x={0}
                  y={radius + 14}
                  textAnchor="middle"
                  className="font-ui"
                  style={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 font-ui text-micro text-ink-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-highlight-terracotta)' }} /> Concept
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-accent-olive)' }} /> Book
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-0.5" style={{ backgroundColor: 'var(--color-highlight-terracotta)' }} /> Related
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-0.5 border-t border-dashed" /> Shared tag
        </span>
      </div>
    </div>
  )
}
