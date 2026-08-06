import { Folder, Books, Plus } from '@phosphor-icons/react'
import { CollectionCard } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import type { Collection } from '@/core/db'

interface CollectionsShelfProps {
  collections: Collection[]
  itemCounts: Record<string, number>
  activeCollectionId: string | null
  onSelect: (id: string | null) => void
  onCreateNew: () => void
}

/** Collections — Design System §10.16: horizontally-scrollable shelf, "labeled folders" metaphor. */
export function CollectionsShelf({
  collections,
  itemCounts,
  activeCollectionId,
  onSelect,
  onCreateNew
}: CollectionsShelfProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2" role="region" aria-label="Collections">
      <CollectionCard
        title="All items"
        itemCount={Object.values(itemCounts).reduce((sum, n) => sum + n, 0)}
        icon={<Books size={20} aria-hidden />}
        accent="olive"
        onClick={() => onSelect(null)}
        className={cn(activeCollectionId === null && 'ring-2 ring-terracotta')}
      />
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          title={collection.name}
          itemCount={itemCounts[collection.id] ?? 0}
          icon={<Folder size={20} aria-hidden />}
          accent={collection.accent}
          onClick={() => onSelect(collection.id)}
          className={cn(activeCollectionId === collection.id && 'ring-2 ring-terracotta')}
        />
      ))}
      <button
        onClick={onCreateNew}
        className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong p-4 text-ink-secondary transition-colors duration-standard hover:bg-surface-raised hover:text-ink-primary"
      >
        <Plus size={20} aria-hidden />
        <span className="font-ui text-ui font-medium">New collection</span>
      </button>
    </div>
  )
}
