import { cn } from '../../../shared/utils/cn'
import type { ComparisonAspectSource } from '../../../core/comparison/types'

/**
 * Inline per-cell provenance indicator (brief §7/§9) — deliberately
 * tiny and text-first (never color/icon alone, matching CalloutBox's
 * accessibility rule elsewhere in the design system) so a row of badges
 * never becomes visually overwhelming (brief §9: "do not make source
 * badges visually overwhelming").
 */
export function ProvenanceBadge({ source, className }: { source: ComparisonAspectSource; className?: string }) {
  const config = {
    curated: { icon: '🟢', label: 'Curated' },
    'my-library': { icon: '📘', label: source.bookTitle ? `My Library — ${source.bookTitle}` : 'My Library' },
    'online-knowledge': { icon: '⚡', label: 'Online Knowledge' },
    'user-authored': { icon: '✍️', label: 'Your note' }
  }[source.kind]

  const content = (
    <span className={cn('inline-flex items-center gap-1 font-ui text-micro text-ink-tertiary', className)}>
      <span aria-hidden>{config.icon}</span>
      {config.label}
      {source.page ? `, p. ${source.page}` : ''}
    </span>
  )

  if (source.url) {
    return (
      <a href={source.url} target="_blank" rel="noreferrer" className="hover:underline">
        {content}
      </a>
    )
  }
  return content
}

/** A subtle "Conflict detected" indicator (brief §10) — no giant citation UI, just an inspectable inline flag. */
export function ConflictBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-ui text-micro font-medium text-warning hover:bg-warning/20"
    >
      ⚠ Conflict detected
    </button>
  )
}
