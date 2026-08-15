import { cn } from '../utils/cn'

export interface ComparisonRow {
  aspect: string
  valueA: string
  valueB: string
  /** Marks a row where the two values differ meaningfully — shown as a dot, not full-row color. */
  differs?: boolean
}

interface ComparisonTableProps {
  itemA: string
  itemB: string
  rows: ComparisonRow[]
  className?: string
}

/**
 * Comparison Table — Design System §10.11.
 * Real <table> semantics (never div-based faux-tables, per §13). Differing
 * values marked with a small dot rather than full-row color-coding.
 */
export function ComparisonTable({ itemA, itemB, rows, className }: ComparisonTableProps) {
  return (
    // Third Refinement §13: the page must never overflow horizontally,
    // but the table itself is allowed to — `overflow-x-auto` here (not
    // `overflow-hidden`, which would silently clip long scientific
    // content on narrow screens) plus a floor width on the table so
    // columns never get squashed unreadably thin; the person swipes the
    // table sideways on mobile instead of losing content.
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="bg-surface-raised">
            <th scope="col" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-secondary">
              Aspect
            </th>
            <th scope="col" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
              {itemA}
            </th>
            <th scope="col" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
              {itemB}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.aspect}
              className={cn('border-t border-border hover:bg-surface-raised', i % 2 === 1 && 'bg-surface')}
            >
              <th scope="row" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-secondary">
                {row.aspect}
              </th>
              <td className="px-4 py-3 font-body text-body text-ink-primary">
                <span className="inline-flex items-center gap-2">
                  {row.differs && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" aria-hidden />}
                  {row.valueA}
                </span>
              </td>
              <td className="px-4 py-3 font-body text-body text-ink-primary">
                <span className="inline-flex items-center gap-2">
                  {row.differs && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" aria-hidden />}
                  {row.valueB}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
