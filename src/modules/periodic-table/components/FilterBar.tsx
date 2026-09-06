import { cn } from '../../../shared/utils/cn'
import type { ElementCategory } from '../../../core/periodic-table/types'

export interface FilterOption {
  id: string
  label: string
  categories?: ElementCategory[]
  block?: 'block-s' | 'block-p' | 'block-d' | 'block-f'
}

export const FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'metals', label: 'Metals', categories: ['alkali-metal', 'alkaline-earth-metal', 'transition-metal', 'post-transition-metal', 'lanthanide', 'actinide'] },
  { id: 'nonmetals', label: 'Nonmetals', categories: ['nonmetal', 'halogen', 'noble-gas'] },
  { id: 'metalloids', label: 'Metalloids', categories: ['metalloid'] },
  { id: 'transition-metals', label: 'Transition Metals', categories: ['transition-metal'] },
  { id: 'halogens', label: 'Halogens', categories: ['halogen'] },
  { id: 'noble-gases', label: 'Noble Gases', categories: ['noble-gas'] },
  { id: 'lanthanides', label: 'Lanthanides', categories: ['lanthanide'] },
  { id: 'actinides', label: 'Actinides', categories: ['actinide'] },
  { id: 's-block', label: 's-block', block: 'block-s' },
  { id: 'p-block', label: 'p-block', block: 'block-p' },
  { id: 'd-block', label: 'd-block', block: 'block-d' },
  { id: 'f-block', label: 'f-block', block: 'block-f' }
]

interface FilterBarProps {
  activeId: string
  onChange: (id: string) => void
}

/**
 * Compact, horizontally-scrolling on mobile (brief §7/§21) — a fixed
 * set of ~13 chips rather than the 20+ the brief explicitly warns
 * against overwhelming someone with.
 */
export function FilterBar({ activeId, onChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter elements">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={activeId === opt.id}
          className={cn(
            'flex-shrink-0 rounded-full border px-3 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
            activeId === opt.id
              ? 'border-terracotta bg-surface-raised text-ink-primary'
              : 'border-border text-ink-secondary hover:bg-surface-raised'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
