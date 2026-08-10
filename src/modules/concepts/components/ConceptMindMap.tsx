import { useNavigate } from 'react-router-dom'
import { TreeStructure } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components'
import type { MindMapNode } from '@/core/concepts'

interface ConceptMindMapProps {
  root: MindMapNode
}

/**
 * Mind map for a single concept — Knowledge Model Correction §12/§13/§14.
 * Rewritten as a plain vertical/indented tree (flexbox, not SVG): the
 * previous wide horizontal SVG layout could produce nodes and edges
 * running far past the viewport on mobile with no clear affordance that
 * it was scrollable at all. A vertical tree wraps naturally, needs no
 * coordinate math, has no truncated labels, and scrolls the same way the
 * rest of the page does. Built purely from `buildConceptMindMap`
 * (core/concepts/graph.ts) — explicit relations and page-level
 * co-occurrence among concepts the person has actually added; no book
 * nodes, no raw source strings, no invented categories.
 */
export function ConceptMindMap({ root }: ConceptMindMapProps) {
  const navigate = useNavigate()

  if (root.children.length === 0) {
    return (
      <EmptyState
        icon={<TreeStructure size={32} />}
        title="No related concepts yet"
        description="Add a related concept, or use “Find related concepts” on the Related tab, and this mind map will branch out from here."
      />
    )
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="rounded-lg bg-terracotta px-4 py-2 font-ui text-body font-medium text-canvas">
        {root.label}
      </div>
      <div className="flex w-full flex-col gap-2 border-l-2 border-border pl-4">
        {root.children.map((child) => (
          <MindMapBranch key={child.id} node={child} onNavigate={(id) => navigate(`/concepts/${id}`)} />
        ))}
      </div>
    </div>
  )
}

function MindMapBranch({ node, onNavigate }: { node: MindMapNode; onNavigate: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className="w-fit max-w-full rounded-md border border-border bg-surface px-3 py-1.5 text-left font-ui text-caption font-medium text-ink-primary hover:bg-surface-raised"
      >
        {node.label}
      </button>
      {node.children.length > 0 && (
        <div className="flex flex-col gap-2 border-l-2 border-border pl-4">
          {node.children.map((child) => (
            <MindMapBranch key={child.id} node={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
