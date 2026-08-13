import { useNavigate } from 'react-router-dom'
import { Flask, Link, TreeStructure } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components'
import type { MindMapNode } from '@/core/concepts'

interface ConceptMindMapProps {
  root: MindMapNode
}

/**
 * Mind map for a single concept — Concept 2.0 Phase 3. Plain vertical/
 * indented tree (flexbox, not SVG): wraps naturally on mobile, needs no
 * coordinate math, scrolls the same way the rest of the page does.
 * Built purely from `buildConceptMindMap` (core/concepts/graph.ts),
 * which now follows ONLY stored ConceptRelation rows — the exact same
 * table Related Concepts reads. No book nodes, no raw source strings,
 * no same-page/shared-tag inference, no invented categories. Scientific
 * (evidence-backed) and manual (user-asserted) edges are visually
 * distinguished so the tree never implies a personal connection is an
 * established scientific fact.
 */
export function ConceptMindMap({ root }: ConceptMindMapProps) {
  const navigate = useNavigate()

  if (root.children.length === 0) {
    return (
      <EmptyState
        icon={<TreeStructure size={32} />}
        title="No verified scientific connections yet"
        description="Add a connection of your own, or check “Suggested scientific concepts” on the Related tab, and this mind map will branch out from here."
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
      <div className="flex flex-wrap gap-4 font-ui text-micro text-ink-tertiary">
        <span className="flex items-center gap-1.5">
          <Flask size={12} className="text-olive" aria-hidden /> Scientific connection
        </span>
        <span className="flex items-center gap-1.5">
          <Link size={12} className="text-ink-tertiary" aria-hidden /> My connection
        </span>
      </div>
    </div>
  )
}

function MindMapBranch({ node, onNavigate }: { node: MindMapNode; onNavigate: (id: string) => void }) {
  const isScientific = node.edgeOrigin === 'scientific'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onNavigate(node.id)}
          className={`flex w-fit max-w-full items-center gap-1.5 rounded-md border px-3 py-1.5 text-left font-ui text-caption font-medium hover:bg-surface-raised ${
            isScientific ? 'border-olive/40 bg-surface text-ink-primary' : 'border-border bg-surface text-ink-primary'
          }`}
        >
          {isScientific ? (
            <Flask size={12} className="shrink-0 text-olive" aria-hidden />
          ) : (
            <Link size={12} className="shrink-0 text-ink-tertiary" aria-hidden />
          )}
          {node.label}
        </button>
        {isScientific && node.relationType && (
          <p className="pl-1 font-ui text-micro text-ink-tertiary" style={{ overflowWrap: 'anywhere' }}>
            {node.relationType}
          </p>
        )}
      </div>
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
