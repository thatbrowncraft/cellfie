import type { CSSProperties } from 'react'
import { ALL_ELEMENTS } from '../../../core/periodic-table/registry'
import type { ElementProfile } from '../../../core/periodic-table/types'
import { ElementCell } from './ElementCell'

interface PeriodicTableGridProps {
  onSelect: (id: string) => void
  /** Element ids to keep at full opacity; every other cell dims (brief §8's family highlight). Undefined/empty = nothing dims. */
  highlightIds?: Set<string>
  compact?: boolean
}

const LANTHANIDE_ROW = 9
const ACTINIDE_ROW = 10

/**
 * Scientifically recognizable position for one element (brief §2): main
 * periods 1-7 sit in their real group column; the f-block rows are
 * pulled below the main table into two 15-wide rows starting at column
 * 3, exactly like a standard printed periodic table, rather than
 * stretching the whole grid to 32 columns.
 */
function gridPosition(e: ElementProfile): CSSProperties {
  if (e.block === 'f') {
    const seriesStart = e.period === 6 ? 57 : 89
    const row = e.period === 6 ? LANTHANIDE_ROW : ACTINIDE_ROW
    return { gridRow: row, gridColumn: 3 + (e.atomicNumber - seriesStart) }
  }
  return { gridRow: e.period, gridColumn: e.group ?? 1 }
}

/** The two placeholder cells shown in the main table where the f-block series is "parked". */
function FBlockPlaceholder({ label, row }: { label: string; row: number }) {
  return (
    <div
      style={{ gridRow: row, gridColumn: 3 }}
      className="flex h-16 w-16 items-center justify-center rounded-sm border border-dashed border-border font-ui text-micro text-ink-tertiary sm:h-[4.5rem] sm:w-[4.5rem]"
      aria-hidden
    >
      {label}
    </div>
  )
}

export function PeriodicTableGrid({ onSelect, highlightIds, compact = false }: PeriodicTableGridProps) {
  const hasHighlight = !!highlightIds && highlightIds.size > 0
  const mainElements = ALL_ELEMENTS.filter((e) => e.block !== 'f')
  const fBlockElements = ALL_ELEMENTS.filter((e) => e.block === 'f')

  return (
    <div className="overflow-x-auto pb-2" role="group" aria-label="Periodic table of the 118 elements">
      <div
        className="grid w-max gap-1"
        style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gridTemplateRows: `repeat(10, auto)` }}
      >
        {mainElements.map((e) => (
          <div key={e.id} style={gridPosition(e)}>
            <ElementCell
              element={e}
              onSelect={onSelect}
              compact={compact}
              dimmed={hasHighlight && !highlightIds!.has(e.id)}
            />
          </div>
        ))}
        <FBlockPlaceholder label="57–71" row={6} />
        <FBlockPlaceholder label="89–103" row={7} />
        {fBlockElements.map((e) => (
          <div key={e.id} style={{ ...gridPosition(e), marginTop: '0.75rem' }}>
            <ElementCell
              element={e}
              onSelect={onSelect}
              compact={compact}
              dimmed={hasHighlight && !highlightIds!.has(e.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
