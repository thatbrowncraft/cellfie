import { cn } from '@/shared/utils/cn'
import { organismCategoryLabels, primaryOrganismCategories, type OrganismCategory } from '@/core/organisms'

interface CategoryPillsProps {
  counts: Partial<Record<OrganismCategory, number>>
  totalCount: number
  active: OrganismCategory | 'all'
  onChange: (category: OrganismCategory | 'all') => void
}

/**
 * Category tabs — Sprint 4 §3, Master Revision §3/§4/§41. The main
 * organism-group navigation: All, Bacteria, Fungi, Protozoa, Viruses
 * always show (even at a count of 0, per §3 — the architecture should
 * read as ready for future expansion, not as missing content), plus
 * any additional category (Algae, Other) only once it actually has at
 * least one organism. Counts are always computed live from the
 * registry by the caller (never hardcoded, §41).
 *
 * Selecting a category is what drives which filter panel shows below
 * it (§4) — this component only owns the tab row itself.
 */
export function CategoryPills({ counts, totalCount, active, onChange }: CategoryPillsProps) {
  const extraCategories = (Object.keys(organismCategoryLabels) as OrganismCategory[]).filter(
    (category) => !primaryOrganismCategories.includes(category) && (counts[category] ?? 0) > 0
  )
  const categories = [...primaryOrganismCategories, ...extraCategories]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by organism category">
      <button
        type="button"
        role="tab"
        onClick={() => onChange('all')}
        aria-selected={active === 'all'}
        className={cn(
          'shrink-0 rounded-full border px-4 py-2 font-ui text-caption font-medium transition-colors duration-micro',
          active === 'all'
            ? 'border-terracotta bg-terracotta text-canvas'
            : 'border-border-strong bg-canvas text-ink-secondary hover:bg-surface-raised'
        )}
      >
        All ({totalCount})
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          role="tab"
          onClick={() => onChange(category)}
          aria-selected={active === category}
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
