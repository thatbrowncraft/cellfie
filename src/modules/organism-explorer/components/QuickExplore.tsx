import type { QuickExploreShortcut } from '@/core/organisms'
import { cn } from '@/shared/utils/cn'

interface QuickExploreProps {
  shortcuts: QuickExploreShortcut[]
  onSelect: (id: string) => void
}

/**
 * Organism Explorer redesign §19 — data-driven shortcuts below the
 * major category cards. `shortcuts` has already been filtered to only
 * ones with at least one match (see `getQuickExploreShortcuts`), so
 * every chip here is guaranteed clickable and non-empty.
 */
export function QuickExplore({ shortcuts, onSelect }: QuickExploreProps) {
  if (shortcuts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Quick explore</h3>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.id}
            type="button"
            onClick={() => onSelect(shortcut.id)}
            className={cn(
              'rounded-full border border-border-strong bg-canvas px-3.5 py-1.5 font-ui text-caption font-medium text-ink-secondary transition-colors duration-micro hover:bg-surface-raised'
            )}
          >
            {shortcut.label} ({shortcut.count})
          </button>
        ))}
      </div>
    </div>
  )
}
