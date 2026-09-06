import { cn } from '../../../shared/utils/cn'
import type { ElementProfile } from '../../../core/periodic-table/types'
import { categoryCellStyle, CATEGORY_STYLES } from '../categoryStyle'

interface ElementCellProps {
  element: ElementProfile
  onSelect: (id: string) => void
  /** Family/category highlight (brief §8) — dims everything else without removing it, so position stays legible. */
  dimmed?: boolean
  /** Compact mode for the mobile horizontally-scrolling table (brief §21). */
  compact?: boolean
}

/**
 * A tappable/clickable periodic-table cell. Always a real <button>, not
 * a styled <div>, so it's keyboard-focusable with a visible focus ring
 * by default (brief §23). Category is conveyed by both a colour treatment
 * AND a short text code (`AM`, `TM`, …), so classification never depends
 * on colour alone.
 */
export function ElementCell({ element, onSelect, dimmed = false, compact = false }: ElementCellProps) {
  const style = categoryCellStyle(element.elementCategory)
  const code = CATEGORY_STYLES[element.elementCategory].code

  return (
    <button
      type="button"
      onClick={() => onSelect(element.id)}
      style={style}
      aria-label={`${element.name}, symbol ${element.symbol}, atomic number ${element.atomicNumber}, ${element.elementCategoryLabel}`}
      className={cn(
        'group relative flex flex-col items-start justify-between rounded-sm border p-1 text-left transition-all duration-micro ease-standard',
        'hover:-translate-y-0.5 hover:shadow-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta',
        compact ? 'h-12 w-12' : 'h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]',
        dimmed && 'opacity-30 hover:opacity-100'
      )}
    >
      <span className="font-ui text-micro leading-none text-ink-tertiary">{element.atomicNumber}</span>
      <span className={cn('font-display font-semibold text-ink-primary', compact ? 'text-ui' : 'text-h3')}>
        {element.symbol}
      </span>
      {!compact && (
        <span className="w-full truncate font-ui text-micro leading-none text-ink-secondary">{element.name}</span>
      )}
      <span className="absolute right-0.5 top-0.5 font-ui text-[9px] leading-none text-ink-tertiary" aria-hidden>
        {code}
      </span>
    </button>
  )
}
