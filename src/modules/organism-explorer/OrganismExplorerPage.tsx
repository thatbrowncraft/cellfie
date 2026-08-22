import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bug } from '@phosphor-icons/react'
import { DashboardLayout } from '@/shared/layouts'
import { Button, EmptyState, SearchField } from '@/shared/components'
import {
  applyBacteriaFilters,
  applyFungiFilters,
  applyProtozoaFilters,
  applyVirusFilters,
  countActiveBacteriaFilters,
  countActiveFungiFilters,
  countActiveProtozoaFilters,
  countActiveVirusFilters,
  countByCategory,
  EMPTY_BACTERIA_FILTERS,
  EMPTY_FUNGI_FILTERS,
  EMPTY_PROTOZOA_FILTERS,
  EMPTY_VIRUS_FILTERS,
  filterByCategory,
  listOrganisms,
  listSavedOrganisms,
  looksLikeOrganismQuery,
  searchOrganisms,
  type BacteriaFilterState,
  type FungiFilterState,
  type OrganismCategory,
  type OrganismProfile,
  type ProtozoaFilterState,
  type VirusFilterState
} from '@/core/organisms'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { CategoryPills } from './components/CategoryPills'
import { BacteriaFilters, FungiFilters, ProtozoaFilters, VirusFilters } from './components/CategoryFilters'
import { KnowledgeLayerSearchPanel } from './components/KnowledgeLayerSearchPanel'
import { OrganismCard } from './components/OrganismCard'

/**
 * Organism Explorer — Sprint 4, Master Revision. A visual organism
 * library that teaches how organisms differ, not just lists them (§1):
 * a short orientation, then category tabs that swap in the filters
 * relevant to that specific group (§2-§9), a search that combines with
 * whatever filters are active (§12), and an illustrated-card grid.
 *
 * Every organism ships as a hand-authored JSON file under
 * src/content/organisms (see core/organisms/registry.ts), discovered at
 * build time via import.meta.glob, so search and filtering both work
 * fully offline — no network request is ever made here (§43/§44).
 */
export function OrganismExplorerPage() {
  const navigate = useNavigate()
  // §"refresh loses my search" fix — query text and the active category
  // tab now live in the URL (?q=...&category=...) instead of only in
  // component state, so reloading this exact page (or sharing/
  // bookmarking the URL) restores the same view instead of silently
  // resetting to the default all-organisms grid. Per-category detail
  // filters (Gram reaction, shape, etc.) intentionally stay
  // component-local for now — see the report for why.
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_CATEGORIES: (OrganismCategory | 'all')[] = ['all', 'bacteria', 'fungi', 'protozoa', 'virus', 'algae', 'other']
  const categoryParam = searchParams.get('category')
  const initialCategory: OrganismCategory | 'all' = VALID_CATEGORIES.includes(categoryParam as OrganismCategory | 'all')
    ? (categoryParam as OrganismCategory | 'all')
    : 'all'
  const initialQuery = searchParams.get('q') ?? ''

  const curatedOrganisms = useMemo(() => listOrganisms(), [])
  // Knowledge Layer Integration §14 — organisms the user has explicitly
  // saved locally appear in the same grid/search/filters as the
  // curated library, never in a second separate UI (§3). Curated always
  // wins a same-id collision (§15) — a saved copy is simply dropped
  // from this merge once the official curated version exists.
  const savedOrganisms = useLiveQuery<OrganismProfile[]>(() => listSavedOrganisms(), [], [])
  const allOrganisms = useMemo(() => {
    const curatedIds = new Set(curatedOrganisms.map((o) => o.id))
    const extra = savedOrganisms.filter((o) => !curatedIds.has(o.id))
    return [...curatedOrganisms, ...extra]
  }, [curatedOrganisms, savedOrganisms])
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState<OrganismCategory | 'all'>(initialCategory)
  const [bacteriaFilters, setBacteriaFilters] = useState<BacteriaFilterState>(EMPTY_BACTERIA_FILTERS)
  const [fungiFilters, setFungiFilters] = useState<FungiFilterState>(EMPTY_FUNGI_FILTERS)
  const [protozoaFilters, setProtozoaFilters] = useState<ProtozoaFilterState>(EMPTY_PROTOZOA_FILTERS)
  const [virusFilters, setVirusFilters] = useState<VirusFilterState>(EMPTY_VIRUS_FILTERS)
  // Bumping this remounts the (intentionally uncontrolled) SearchField,
  // which is the simplest way to clear its visible text on "Reset all"
  // without turning a shared component controlled for every other
  // screen that uses it (§13).
  const [searchResetKey, setSearchResetKey] = useState(0)

  const categoryCounts = useMemo(() => countByCategory(allOrganisms), [allOrganisms])

  const filtered = useMemo(() => {
    let list = filterByCategory(allOrganisms, category)
    if (category === 'bacteria') list = applyBacteriaFilters(list, bacteriaFilters)
    else if (category === 'fungi') list = applyFungiFilters(list, fungiFilters)
    else if (category === 'protozoa') list = applyProtozoaFilters(list, protozoaFilters)
    else if (category === 'virus') list = applyVirusFilters(list, virusFilters)
    list = searchOrganisms(list, query)
    return list
  }, [allOrganisms, category, bacteriaFilters, fungiFilters, protozoaFilters, virusFilters, query])

  const hasAnyOrganisms = allOrganisms.length > 0
  const hasActiveFilters =
    category !== 'all' ||
    query.trim().length > 0 ||
    countActiveBacteriaFilters(bacteriaFilters) > 0 ||
    countActiveFungiFilters(fungiFilters) > 0 ||
    countActiveProtozoaFilters(protozoaFilters) > 0 ||
    countActiveVirusFilters(virusFilters) > 0

  function updateQuery(next: string) {
    setQuery(next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next.trim()) params.set('q', next)
        else params.delete('q')
        return params
      },
      { replace: true }
    )
  }

  function updateCategory(next: OrganismCategory | 'all') {
    setCategory(next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next !== 'all') params.set('category', next)
        else params.delete('category')
        return params
      },
      { replace: true }
    )
  }

  function resetAll() {
    updateCategory('all')
    updateQuery('')
    setBacteriaFilters(EMPTY_BACTERIA_FILTERS)
    setFungiFilters(EMPTY_FUNGI_FILTERS)
    setProtozoaFilters(EMPTY_PROTOZOA_FILTERS)
    setVirusFilters(EMPTY_VIRUS_FILTERS)
    setSearchResetKey((k) => k + 1)
  }

  return (
    <DashboardLayout
      title="Organism Explorer"
      subtitle="Explore microorganisms through classification, morphology, laboratory identification, and high-yield distinguishing features."
    >
      {!hasAnyOrganisms ? (
        <div className="col-span-full flex flex-col items-center gap-8 rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<Bug size={32} />}
            title="No organisms added yet"
            description="Organism profiles — classification, morphology, habitat, and lab identification — will appear as illustrated cards here."
          />
        </div>
      ) : (
        <div className="col-span-full flex flex-col gap-5">
          <div className="rounded-md border border-border bg-surface p-5">
            <h2 className="mb-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">What&rsquo;s inside</h2>
            <p className="font-body text-body text-ink-secondary">
              A visual microbiology reference for learning how organisms are classified, what they look like, where
              they&rsquo;re found, and how they can be distinguished in the laboratory.
            </p>
          </div>

          <CategoryPills counts={categoryCounts} totalCount={allOrganisms.length} active={category} onChange={updateCategory} />

          {category === 'bacteria' && <BacteriaFilters filters={bacteriaFilters} onChange={setBacteriaFilters} />}
          {category === 'fungi' && <FungiFilters filters={fungiFilters} onChange={setFungiFilters} />}
          {category === 'protozoa' && <ProtozoaFilters filters={protozoaFilters} onChange={setProtozoaFilters} />}
          {category === 'virus' && <VirusFilters filters={virusFilters} onChange={setVirusFilters} />}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchField
              key={searchResetKey}
              placeholder="Search by name, genus, characteristic…"
              defaultValue={initialQuery}
              onChange={updateQuery}
              className="w-full sm:max-w-sm"
            />
            {hasActiveFilters && (
              <Button variant="secondary" size="small" onClick={resetAll}>
                Reset all
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-6">
              {query.trim().length > 0 && looksLikeOrganismQuery(query) ? (
                // Knowledge Layer Integration §2/§19 — a query that
                // looks like it could be an organism name, but matched
                // nothing locally, offers an explicit (never automatic,
                // §42) trigger to search trusted scientific sources.
                <KnowledgeLayerSearchPanel query={query} onFound={(id) => navigate(`/organisms/${id}`)} />
              ) : (
                <EmptyState
                  title="No organisms found"
                  description="Try another search or explore a different category."
                  action={
                    hasActiveFilters ? (
                      <Button variant="secondary" size="small" onClick={resetAll}>
                        Reset all
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((organism) => (
                <OrganismCard key={organism.id} organism={organism} />
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
