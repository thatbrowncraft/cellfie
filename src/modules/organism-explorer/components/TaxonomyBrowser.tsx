import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { cn } from '@/shared/utils/cn'
import type { TaxonomyNode } from '@/core/organisms'

const RANK_LABELS: Record<string, string> = {
  domain: 'Domain',
  kingdom: 'Kingdom',
  phylum: 'Phylum',
  class: 'Class',
  order: 'Order',
  family: 'Family',
  genus: 'Genus'
}

function TaxonomyTreeNode({
  node,
  depth,
  activeKey,
  onSelectGroup
}: {
  node: TaxonomyNode
  depth: number
  activeKey: string | undefined
  onSelectGroup: (rank: string, value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(depth === 0)
  const navigate = useNavigate()

  if (node.rank === 'organism' && node.organism) {
    const organism = node.organism
    return (
      <button
        type="button"
        onClick={() => navigate(`/organisms/${organism.id}`)}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className="flex w-full items-center gap-2 rounded-sm py-1.5 text-left font-body text-caption italic text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
      >
        {organism.scientificName}
      </button>
    )
  }

  const nodeKey = `${node.rank}:${node.value}`
  const isActive = activeKey === nodeKey

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 16}px` }}
        className={cn('flex w-full items-center gap-1.5 rounded-sm py-1.5 pr-2', isActive && 'bg-surface-raised')}
      >
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${node.value}` : `Expand ${node.value}`}
          className="shrink-0 text-ink-tertiary hover:text-ink-primary"
        >
          <CaretRight size={12} className={cn('transition-transform duration-micro', isOpen && 'rotate-90')} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onSelectGroup(node.rank, node.value)}
          className={cn(
            'flex flex-1 items-center gap-2 text-left font-ui text-caption font-medium hover:underline',
            isActive ? 'text-olive' : 'text-ink-primary'
          )}
        >
          <span>{node.value}</span>
          <span className="font-body text-micro font-normal text-ink-tertiary">
            {RANK_LABELS[node.rank] ?? node.rank} · {node.count} organism{node.count === 1 ? '' : 's'}
          </span>
        </button>
      </div>
      {isOpen && (
        <div>
          {node.children.map((child) => (
            <TaxonomyTreeNode
              key={`${child.rank}:${child.value}`}
              node={child}
              depth={depth + 1}
              activeKey={activeKey}
              onSelectGroup={onSelectGroup}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface TaxonomyBrowserProps {
  tree: TaxonomyNode[]
  /** The currently applied taxon filter, if any, as `rank:value` — highlights the matching node. */
  activeKey?: string
  /** Fires when a group node's label (not its expand caret) is tapped — the caller applies it as the current filter. */
  onSelectGroup: (rank: string, value: string) => void
}

/**
 * Organism Explorer redesign §10 — progressive Domain→…→Genus→
 * Organism navigation generated from each organism's own classification
 * fields (see `buildOrganismTaxonomyTree`). Correctly distinguishes
 * genus from family because it never invents a label — it only ever
 * shows whatever rank/value the organism's own JSON actually states
 * (§6: Bacillus renders as a genus node, Bacillaceae as a family node,
 * because that's what each organism's `classification` says).
 */
export function TaxonomyBrowser({ tree, activeKey, onSelectGroup }: TaxonomyBrowserProps) {
  if (tree.length === 0) return null

  return (
    <div className="flex flex-col rounded-md border border-border bg-surface p-3">
      {tree.map((node) => (
        <TaxonomyTreeNode key={`${node.rank}:${node.value}`} node={node} depth={0} activeKey={activeKey} onSelectGroup={onSelectGroup} />
      ))}
    </div>
  )
}
