import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Scales } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, SearchField, Tabs } from '../../shared/components'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { db, type SavedComparisonRecord } from '../../core/db'
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
import { getCuratedComparisonById } from '../../core/comparison/registry'
import { ComparisonCard } from './components/ComparisonCard'

type DiscoveryFilter = 'all' | ComparisonDomain
type SavedTab = 'saved' | 'favorites' | 'custom'

/**
 * Comparison Studio landing page (brief §14/§22/§23).
 *
 * Saved Comparisons / Favorites / My Comparisons live here, inside the
 * module — Dashboard only ever shows a 4-item "Recently Visited"
 * preview (`core/comparison/recentlyViewed.ts`), never the full
 * collection (brief §14/§16).
 *
 * Discovery search covers curated content only, matching brief §8's
 * "first: search Cellfie's curated structured content" — My Library and
 * Online Knowledge are per-aspect enrichment inside a comparison's
 * workspace (`ComparisonSourcesPanel`), not a second global search box
 * here (brief §34: no duplicate search system).
 */
export function ComparisonStudioPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<DiscoveryFilter>('all')
  const [savedTab, setSavedTab] = useState<SavedTab>('saved')

  const savedRecords = useLiveQuery<SavedComparisonRecord[]>(
    () => db.savedComparisons.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  )

  const domainOptions = useMemo(() => {
    const domainsInUse = new Set(ALL_CURATED_COMPARISONS.map((c) => c.domain))
    return [
      { value: 'all', label: 'All domains' },
      ...Array.from(domainsInUse).map((d) => ({ value: d, label: COMPARISON_DOMAIN_LABELS[d] }))
    ]
  }, [])

  const discoveryResults = useMemo(() => {
    const base = query.trim() ? searchCuratedComparisons(query) : ALL_CURATED_COMPARISONS.map((c) => ({
      id: c.id,
      domain: c.domain,
      title: `${c.itemA.name} vs ${c.itemB.name}`,
      subtitle: undefined,
      difficulty: c.difficulty,
      frequency: c.frequency
    }))
    return domainFilter === 'all' ? base : base.filter((hit) => hit.domain === domainFilter)
  }, [query, domainFilter])

  const favorites = savedRecords.filter((r) => r.favorite)
  const custom = savedRecords.filter((r) => r.sourceType === 'custom')

  function openCurated(id: string) {
    navigate(`/comparison/${id}`)
  }

  function openSaved(record: SavedComparisonRecord) {
    const routeId = record.sourceType === 'curated' ? record.curatedComparisonId! : record.id
    navigate(`/comparison/${routeId}`)
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display font-semibold text-ink-primary">Comparison Studio</h1>
          <p className="mt-2 max-w-2xl font-body text-body-lg text-ink-secondary">
            Put two things side by side and see exactly where they agree, where they diverge, and which difference actually matters.
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => navigate('/comparison/new')}>
          New comparison
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Saved / Favorites / My Comparisons */}
        <section>
          <Tabs
            activeId={savedTab}
            onChange={(id) => setSavedTab(id as SavedTab)}
            tabs={[
              { id: 'saved', label: `Saved (${savedRecords.length})`, content: <SavedList records={savedRecords} onOpen={openSaved} onNew={() => navigate('/comparison/new')} emptyKind="saved" /> },
              { id: 'favorites', label: `Favorites (${favorites.length})`, content: <SavedList records={favorites} onOpen={openSaved} onNew={() => navigate('/comparison/new')} emptyKind="favorites" /> },
              { id: 'custom', label: `My Comparisons (${custom.length})`, content: <SavedList records={custom} onOpen={openSaved} onNew={() => navigate('/comparison/new')} emptyKind="custom" /> }
            ]}
          />
        </section>

        {/* Discover curated comparisons */}
        <section>
          <p className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Discover · {countCuratedComparisons()} curated comparisons
          </p>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchField placeholder="Search comparisons, e.g. ELISA vs PCR…" onChange={setQuery} className="flex-1" />
            <Dropdown
              label="Domain"
              options={domainOptions}
              value={domainFilter}
              onChange={(v) => setDomainFilter(v as DiscoveryFilter)}
              className="sm:w-56"
            />
          </div>

          {discoveryResults.length === 0 ? (
            <EmptyState title="Nothing matches" description="Try a different search term or domain, or start a custom comparison." />
          ) : (
            <div className="flex flex-col gap-3">
              {discoveryResults.map((hit) => {
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
                      onClick={() => openCurated(hit.id)}
                    />
                    {tagline && <p className="mt-1 px-1 font-body text-micro italic text-ink-tertiary">{tagline}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SavedList({
  records,
  onOpen,
  onNew,
  emptyKind
}: {
  records: SavedComparisonRecord[]
  onOpen: (record: SavedComparisonRecord) => void
  onNew: () => void
  emptyKind: SavedTab
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<Scales size={28} />}
        title={emptyKind === 'saved' ? 'Nothing saved yet' : emptyKind === 'favorites' ? 'No favorites yet' : 'No custom comparisons yet'}
        description={
          emptyKind === 'custom'
            ? "Build a comparison from scratch \u2014 even for things that aren't in Cellfie's curated database yet."
            : 'Save a curated comparison from Discover, or star one to find it here faster.'
        }
        action={
          emptyKind === 'custom' ? (
            <Button size="small" onClick={onNew}>
              New comparison
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => {
        const curated = record.sourceType === 'curated' && record.curatedComparisonId ? getCuratedComparisonById(record.curatedComparisonId) : undefined
        const domain = record.sourceType === 'custom' ? (record.domain as ComparisonDomain) ?? 'custom' : curated?.domain ?? 'custom'
        return (
          <ComparisonCard
            key={record.id}
            itemAName={record.sourceType === 'custom' ? record.itemA?.name ?? '?' : record.title.split(' vs ')[0]}
            itemBName={record.sourceType === 'custom' ? record.itemB?.name ?? '?' : record.title.split(' vs ').slice(1).join(' vs ')}
            domain={domain}
            difficulty={curated?.difficulty}
            frequency={curated?.frequency}
            favorite={record.favorite}
            sourceType={record.sourceType}
            onClick={() => onOpen(record)}
          />
        )
      })}
    </div>
  )
}
