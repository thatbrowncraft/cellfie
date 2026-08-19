import { cn } from '@/shared/utils/cn'
import { organismCategoryLabels, type OrganismCategory } from '@/core/organisms'

interface CategoryPillsProps {
  counts: Partial<Record<OrganismCategory, number>>
  totalCount: number
  active: OrganismCategory | 'all'
  onChange: (category: OrganismCategory | 'all') => void
}

/**
 * Category Pills — Sprint 4 §2. A single horizontally-scrollable row of
 * primary categories, kept deliberately lighter-weight than the
 * Library's CollectionsShelf card treatment so the first screen of the
 * Explorer stays clean on mobile (§21). Only categories that actually
 * have at least one organism are shown, aside from "All".
 */
export function CategoryPills({ counts, totalCount, active, onChange }: CategoryPillsProps) {
  const availableCategories = (Object.keys(organismCategoryLabels) as OrganismCategory[]).filter(
    (category) => (counts[category] ?? 0) > 0
  )

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by organism category">
      <button
        type="button"
        onClick={() => onChange('all')}
        aria-pressed={active === 'all'}
        className={cn(
          'shrink-0 rounded-full border px-4 py-2 font-ui text-caption font-medium transition-colors duration-micro',
          active === 'all'
            ? 'border-terracotta bg-terracotta text-canvas'
            : 'border-border-strong bg-canvas text-ink-secondary hover:bg-surface-raised'
        )}
      >
        All ({totalCount})
      </button>
      {availableCategories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          aria-pressed={active === category}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 font-ui text-caption font-medium transition-colors duration-micro',
            active === category
              ? 'border-terracotta bg-terracotta text-canvas'
              : 'border-border-strong bg-canvas text-ink-secondary hover:bg-surface-raised'
          )}
        >
          {organismCategoryLabels[category]} ({counts[category] ?? 0})
        </button>
      ))}
    </div>
  )
}
