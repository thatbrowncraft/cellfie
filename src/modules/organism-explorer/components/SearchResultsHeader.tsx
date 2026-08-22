import type { LocalTaxonMatch } from '@/core/organisms'

interface SearchResultsHeaderProps {
  query: string
  resultCount: number
  taxonMatch: LocalTaxonMatch | undefined
}

/**
 * Organism Explorer redesign §11 — when a search exactly matches a
 * genus or family that actually exists in the library, lead with that
 * instead of an unstructured card grid: what rank matched, how many
 * organisms, and (for a genus match) the family it belongs to. Falls
 * back to a plain "Search results" heading for every other query —
 * this never guesses at a taxonomic relationship the data doesn't
 * state.
 */
export function SearchResultsHeader({ query, resultCount, taxonMatch }: SearchResultsHeaderProps) {
  if (!taxonMatch) {
    return (
      <h2 className="font-ui text-caption font-medium uppercase tracking-wide text-ink-tertiary">
        Search results for &ldquo;{query}&rdquo; ({resultCount})
      </h2>
    )
  }

  const rankLabel = taxonMatch.rank === 'genus' ? 'Genus' : 'Family'

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        Found the {taxonMatch.value} crowd
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="font-display text-h3 italic text-ink-primary">{taxonMatch.value}</h2>
        <span className="font-ui text-caption text-ink-secondary">
          {rankLabel} · {resultCount} organism{resultCount === 1 ? '' : 's'}
        </span>
      </div>
      {taxonMatch.family && (
        <p className="font-body text-caption text-ink-secondary">
          Family: <span className="font-medium text-ink-primary">{taxonMatch.family}</span>
        </p>
      )}
    </div>
  )
}
