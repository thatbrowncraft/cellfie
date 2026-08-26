import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, SearchField } from '../../shared/components'
import {
  ALL_CURATED_COMPARISONS,
  searchCuratedComparisons,
  countCuratedComparisons
} from '../../core/comparison/registry'
import {
  COMPARISON_DIFFICULTY_LABELS,
  COMPARISON_DOMAIN_LABELS,
  COMPARISON_FREQUENCY_LABELS,
  type ComparisonDifficulty,
  type ComparisonDomain,
  type ComparisonFrequency
} from '../../core/comparison/types'
import { getComparisonTagline } from '../../core/comparison/microcopy'
import { ComparisonCard } from './components/ComparisonCard'

type DiscoveryFilter = 'all' | ComparisonDomain
type DifficultyFilter = 'all' | ComparisonDifficulty
type FrequencyFilter = 'all' | ComparisonFrequency

/**
 * The full curated comparison catalog (brief §26/§27) — everything the
 * landing page used to render inline now lives here instead, reached via
 * "Explore all comparisons →". Landing stays a calm studio; this page is
 * the actual index/browse experience, with the same search + domain/
 * difficulty/frequency filters the old landing page had.
 *
 * Reads optional `?domain=` / `?difficulty=` query params as the
 * starting filter — this is how the landing page's "Explore by level"
 * and "Explore by domain" chip rows deep-link here already pre-filtered,
 * without this page needing to know anything about where the link came
 * from.
 *
 * Deliberately still a plain filtered list rather than a virtualized one
 * (brief §26 "pagination/virtualized list if necessary") — 55 curated
 * comparisons render instantly; this only becomes worth adding once the
 * curated set grows enough to matter, and can be dropped in here without
 * touching anything else in the module.
 */
export function ExploreComparisonsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<DiscoveryFilter>((searchParams.get('domain') as DiscoveryFilter) ?? 'all')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>(
    (searchParams.get('difficulty') as DifficultyFilter) ?? 'all'
  )
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all')

  const domainOptions = useMemo(() => {
    const domainsInUse = new Set(ALL_CURATED_COMPARISONS.map((c) => c.domain))
    return [
      { value: 'all', label: 'All domains' },
      ...Array.from(domainsInUse).map((d) => ({ value: d, label: COMPARISON_DOMAIN_LABELS[d] }))
    ]
  }, [])

  const difficultyOptions = useMemo(() => {
    const difficultiesInUse = new Set(ALL_CURATED_COMPARISONS.map((c) => c.difficulty))
    return [
      { value: 'all', label: 'All difficulties' },
      ...Array.from(difficultiesInUse).map((d) => ({ value: d, label: COMPARISON_DIFFICULTY_LABELS[d] }))
    ]
  }, [])

  const frequencyOptions = useMemo(() => {
    const frequenciesInUse = new Set(ALL_CURATED_COMPARISONS.map((c) => c.frequency))
    return [
      { value: 'all', label: 'All frequencies' },
      ...Array.from(frequenciesInUse).map((f) => ({ value: f, label: COMPARISON_FREQUENCY_LABELS[f] }))
    ]
  }, [])

  const results = useMemo(() => {
    const base = query.trim()
      ? searchCuratedComparisons(query)
      : ALL_CURATED_COMPARISONS.map((c) => ({
          id: c.id,
          domain: c.domain,
          title: `${c.itemA.name} vs ${c.itemB.name}`,
          subtitle: undefined,
          difficulty: c.difficulty,
          frequency: c.frequency
        }))
    return base
      .filter((hit) => domainFilter === 'all' || hit.domain === domainFilter)
      .filter((hit) => difficultyFilter === 'all' || hit.difficulty === difficultyFilter)
      .filter((hit) => frequencyFilter === 'all' || hit.frequency === frequencyFilter)
  }, [query, domainFilter, difficultyFilter, frequencyFilter])

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-6 flex items-start gap-3">
        <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate('/comparison')}>
          Studio
        </Button>
      </header>

      <div className="mb-6">
        <h1 className="font-display text-h1 font-semibold text-ink-primary">Explore all comparisons</h1>
        <p className="mt-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          {countCuratedComparisons()} curated comparisons
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField placeholder="Search comparisons, e.g. ELISA vs PCR…" onChange={setQuery} className="flex-1" />
        <Dropdown
          label="Domain"
          options={domainOptions}
          value={domainFilter}
          onChange={(v) => setDomainFilter(v as DiscoveryFilter)}
          className="sm:w-56"
        />
        <Dropdown
          label="Difficulty"
          options={difficultyOptions}
          value={difficultyFilter}
          onChange={(v) => setDifficultyFilter(v as DifficultyFilter)}
          className="sm:w-56"
        />
        <Dropdown
          label="Frequency"
          options={frequencyOptions}
          value={frequencyFilter}
          onChange={(v) => setFrequencyFilter(v as FrequencyFilter)}
          className="sm:w-56"
        />
      </div>

      {results.length === 0 ? (
        <EmptyState title="Nothing matches" description="Try a different search term or domain, or start a custom comparison." />
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((hit) => {
            const tagline = getComparisonTagline(hit.id)
            const [itemAName, itemBName] = hit.title.split(' vs ')
            return (
              <div key={hit.id}>
                <ComparisonCard
                  itemAName={itemAName}
                  itemBName={itemBName ?? ''}
                  domain={hit.domain}
                  difficulty={hit.difficulty as ComparisonDifficulty}
                  frequency={hit.frequency as ComparisonFrequency}
                  onClick={() => navigate(`/comparison/${hit.id}`)}
                />
                {tagline && <p className="mt-1 px-1 font-body text-micro italic text-ink-tertiary">{tagline}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
