import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bug, TreeStructure } from '@phosphor-icons/react'
import { DashboardLayout } from '@/shared/layouts'
import { Button, EmptyState, SearchField } from '@/shared/components'
import {
  applyBacteriaFilters,
  applyFungiFilters,
  applyProtozoaFilters,
  applyVirusFilters,
  applyQuickExploreShortcut,
  buildOrganismTaxonomyTree,
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
  getBacteriaGroups,
  getCategorySummaries,
  getQuickExploreShortcuts,
  listOrganisms,
  listSavedOrganisms,
  looksLikeOrganismQuery,
  organismCategoryLabels,
  resolveLocalTaxonMatch,
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
import { CategoryCard } from './components/CategoryCard'
import { QuickExplore } from './components/QuickExplore'
import { GroupChipRow } from './components/GroupChipRow'
import { TaxonomyBrowser } from './components/TaxonomyBrowser'
import { ExplorerBreadcrumbs, type BreadcrumbStep } from './components/ExplorerBreadcrumbs'
import { SearchResultsHeader } from './components/SearchResultsHeader'
import { OrganismExplorerBackground } from './components/OrganismExplorerBackground'

const QUICK_EXPLORE_LABELS: Record<string, string> = {
  'gram-positive': 'Gram-positive bacteria',
  'gram-negative': 'Gram-negative bacteria',
  'acid-fast': 'Acid-fast organisms',
  'yeasts-moulds': 'Yeasts & moulds',
  'clinically-important': 'Clinically important organisms',
  'exam-favorites': 'High-yield exam organisms'
}

/**
 * Organism Explorer landing page redesign. The library has grown to
 * ~79 organisms, so the old "everything at once" grid became a flat
 * database listing (redesign brief SS1/SS20 - "no flat 79-card wall").
 *
 * This page now has three views, all driven by URL params so Back/
 * Forward and bookmarking keep working exactly as before:
 *
 * 1. HUB (category=all, nothing else active) - an orientation blurb,
 *    global search, the four major-category cards with live counts,
 *    and Quick Explore shortcuts. No organism cards render here.
 * 2. CATEGORY EXPLORER (a category is selected) - breadcrumbs, that
 *    category's detail filters (unchanged - see CategoryFilters.tsx),
 *    bacteria also get clinical/taxonomic quick-group chips, a
 *    "Browse by taxonomy" tree, then the organism grid.
 * 3. SEARCH RESULTS (query non-empty, from the hub or inside a
 *    category) - same grid, but led by a header that recognizes an
 *    exact genus/family match and surfaces it before the cards.
 *
 * Every count, group, and tree node is computed live from the same
 * organism list the grid itself uses (see core/organisms/exploreGroups.ts)
 * - nothing here is hardcoded, so a new organism JSON file added later
 * updates every summary automatically without touching this file.
 */
export function OrganismExplorerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_CATEGORIES: (OrganismCategory | 'all')[] = ['all', 'bacteria', 'fungi', 'protozoa', 'virus', 'algae', 'other']
  const categoryParam = searchParams.get('category')
  const initialCategory: OrganismCategory | 'all' = VALID_CATEGORIES.includes(categoryParam as OrganismCategory | 'all')
    ? (categoryParam as OrganismCategory | 'all')
    : 'all'
  const initialQuery = searchParams.get('q') ?? ''
  const initialGroup = searchParams.get('group') ?? undefined
  const initialTaxon = searchParams.get('taxon') ?? undefined
  const initialQuick = searchParams.get('quick') ?? undefined

  const curatedOrganisms = useMemo(() => listOrganisms(), [])
  const savedOrganisms = useLiveQuery<OrganismProfile[]>(() => listSavedOrganisms(), [], [])
  const allOrganisms = useMemo(() => {
    const curatedIds = new Set(curatedOrganisms.map((o) => o.id))
    const extra = savedOrganisms.filter((o) => !curatedIds.has(o.id))
    return [...curatedOrganisms, ...extra]
  }, [curatedOrganisms, savedOrganisms])

  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState<OrganismCategory | 'all'>(initialCategory)
  const [group, setGroup] = useState<string | undefined>(initialGroup)
  const [taxon, setTaxon] = useState<string | undefined>(initialTaxon)
  const [quick, setQuick] = useState<string | undefined>(initialQuick)
  const [showTaxonomyBrowser, setShowTaxonomyBrowser] = useState(false)
  const [bacteriaFilters, setBacteriaFilters] = useState<BacteriaFilterState>(EMPTY_BACTERIA_FILTERS)
  const [fungiFilters, setFungiFilters] = useState<FungiFilterState>(EMPTY_FUNGI_FILTERS)
  const [protozoaFilters, setProtozoaFilters] = useState<ProtozoaFilterState>(EMPTY_PROTOZOA_FILTERS)
  const [virusFilters, setVirusFilters] = useState<VirusFilterState>(EMPTY_VIRUS_FILTERS)
  const [searchResetKey, setSearchResetKey] = useState(0)

  const categoryCounts = useMemo(() => countByCategory(allOrganisms), [allOrganisms])
  const categorySummaries = useMemo(() => getCategorySummaries(allOrganisms, organismCategoryLabels), [allOrganisms])
  const quickShortcuts = useMemo(() => getQuickExploreShortcuts(allOrganisms), [allOrganisms])

  const categoryScoped = useMemo(() => filterByCategory(allOrganisms, category), [allOrganisms, category])

  const bacteriaGroups = useMemo(
    () => (category === 'bacteria' ? getBacteriaGroups(categoryScoped) : []),
    [category, categoryScoped]
  )

  const taxonomyTree = useMemo(() => (category !== 'all' ? buildOrganismTaxonomyTree(categoryScoped) : []), [category, categoryScoped])

  const filtered = useMemo(() => {
    if (quick) return searchOrganisms(applyQuickExploreShortcut(allOrganisms, quick), query)

    let list = categoryScoped

    if (category === 'bacteria') {
      list = applyBacteriaFilters(list, bacteriaFilters)
      if (group) {
        const matchedGroup = bacteriaGroups.find((g) => g.id === group)
        const matchedIds = new Set((matchedGroup?.organisms ?? []).map((o) => o.id))
        list = list.filter((o) => matchedIds.has(o.id))
      }
    } else if (category === 'fungi') list = applyFungiFilters(list, fungiFilters)
    else if (category === 'protozoa') list = applyProtozoaFilters(list, protozoaFilters)
    else if (category === 'virus') list = applyVirusFilters(list, virusFilters)

    if (taxon) {
      const [rank, value] = taxon.split(':')
      list = list.filter((o) => o.classification[rank as keyof OrganismProfile['classification']] === value)
    }

    return searchOrganisms(list, query)
  }, [allOrganisms, categoryScoped, category, group, bacteriaGroups, taxon, bacteriaFilters, fungiFilters, protozoaFilters, virusFilters, query, quick])

  const taxonMatch = useMemo(() => (query.trim() ? resolveLocalTaxonMatch(query, allOrganisms) : undefined), [query, allOrganisms])

  const hasAnyOrganisms = allOrganisms.length > 0
  const hasActiveFilters =
    category !== 'all' ||
    Boolean(quick) ||
    Boolean(group) ||
    Boolean(taxon) ||
    query.trim().length > 0 ||
    countActiveBacteriaFilters(bacteriaFilters) > 0 ||
    countActiveFungiFilters(fungiFilters) > 0 ||
    countActiveProtozoaFilters(protozoaFilters) > 0 ||
    countActiveVirusFilters(virusFilters) > 0

  const isHub = category === 'all' && !quick && !group && !taxon && query.trim().length === 0

  function updateParams(next: { query?: string; category?: OrganismCategory | 'all'; group?: string; taxon?: string; quick?: string }) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        const apply = (key: string, value: string | undefined) => {
          if (value) params.set(key, value)
          else params.delete(key)
        }
        if ('query' in next) apply('q', next.query)
        if ('category' in next) apply('category', next.category === 'all' ? undefined : next.category)
        if ('group' in next) apply('group', next.group)
        if ('taxon' in next) apply('taxon', next.taxon)
        if ('quick' in next) apply('quick', next.quick)
        return params
      },
      { replace: true }
    )
  }

  function updateQuery(next: string) {
    setQuery(next)
    setQuick(undefined)
    updateParams({ query: next, quick: undefined })
  }

  function updateCategory(next: OrganismCategory | 'all') {
    setCategory(next)
    setGroup(undefined)
    setTaxon(undefined)
    setQuick(undefined)
    setShowTaxonomyBrowser(false)
    updateParams({ category: next, group: undefined, taxon: undefined, quick: undefined })
  }

  function updateGroup(next: string | undefined) {
    setGroup(next)
    setTaxon(undefined)
    updateParams({ group: next, taxon: undefined })
  }

  function selectTaxonNode(rank: string, value: string) {
    const key = `${rank}:${value}`
    const next = taxon === key ? undefined : key
    setTaxon(next)
    setGroup(undefined)
    updateParams({ taxon: next, group: undefined })
  }

  function selectQuickShortcut(id: string) {
    setQuick(id)
    setCategory('all')
    setGroup(undefined)
    setTaxon(undefined)
    updateParams({ quick: id, category: 'all', group: undefined, taxon: undefined })
  }

  function resetAll() {
    setCategory('all')
    setGroup(undefined)
    setTaxon(undefined)
    setQuick(undefined)
    setShowTaxonomyBrowser(false)
    setQuery('')
    setBacteriaFilters(EMPTY_BACTERIA_FILTERS)
    setFungiFilters(EMPTY_FUNGI_FILTERS)
    setProtozoaFilters(EMPTY_PROTOZOA_FILTERS)
    setVirusFilters(EMPTY_VIRUS_FILTERS)
    setSearchResetKey((k) => k + 1)
    updateParams({ query: '', category: 'all', group: undefined, taxon: undefined, quick: undefined })
  }

  const activeBacteriaGroup = group ? bacteriaGroups.find((g) => g.id === group) : undefined

  const breadcrumbSteps: BreadcrumbStep[] = [{ label: 'Organism Explorer', onClick: hasActiveFilters ? resetAll : undefined }]
  if (quick) {
    breadcrumbSteps.push({ label: QUICK_EXPLORE_LABELS[quick] ?? quick })
  } else {
    if (category !== 'all') {
      breadcrumbSteps.push({
        label: organismCategoryLabels[category],
        onClick: group || taxon || query.trim() ? () => updateCategory(category) : undefined
      })
    }
    if (activeBacteriaGroup) breadcrumbSteps.push({ label: activeBacteriaGroup.label })
    if (taxon) breadcrumbSteps.push({ label: taxon.split(':')[1] })
    if (query.trim()) breadcrumbSteps.push({ label: `Search: "${query.trim()}"` })
  }

  return (
    <DashboardLayout
      title="Organism Explorer"
      subtitle="Explore the microbial world through classification, morphology, laboratory identification, and high-yield distinguishing features."
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
        <div className="relative col-span-full flex flex-col gap-5 overflow-hidden">
          <OrganismExplorerBackground />

          <div className="relative z-[1] flex flex-col gap-5">
            {!isHub && <ExplorerBreadcrumbs steps={breadcrumbSteps} />}

            {isHub && (
              <div className="rounded-md border border-border bg-surface p-5">
                <h2 className="mb-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">What&rsquo;s inside</h2>
                <p className="font-body text-body text-ink-secondary">
                  Classify organisms, recognize their distinguishing features, and work out what the lab is telling
                  you — organized by major group, clinical/taxonomic groupings, and full taxonomy, rather than one
                  long list.
                </p>
              </div>
            )}

            <SearchField
              key={searchResetKey}
              placeholder="Search organisms, genera, families, morphology, or lab clues…"
              defaultValue={initialQuery}
              onChange={updateQuery}
              className="w-full sm:max-w-md"
            />

            {isHub && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {categorySummaries
                    .filter((summary) => ['bacteria', 'fungi', 'protozoa', 'virus'].includes(summary.category))
                    .map((summary) => (
                      <CategoryCard
                        key={summary.category}
                        category={summary.category}
                        label={summary.label}
                        description={summary.description}
                        memoryLine={summary.memoryLine}
                        count={summary.count}
                        onClick={() => updateCategory(summary.category)}
                      />
                    ))}
                </div>

                <QuickExplore shortcuts={quickShortcuts} onSelect={selectQuickShortcut} />
              </>
            )}

            {!isHub && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CategoryPills counts={categoryCounts} totalCount={allOrganisms.length} active={category} onChange={updateCategory} />
                  {hasActiveFilters && (
                    <Button variant="secondary" size="small" onClick={resetAll}>
                      Reset all
                    </Button>
                  )}
                </div>

                {!quick && category === 'bacteria' && (
                  <GroupChipRow
                    title="Clinical & taxonomic groups"
                    options={bacteriaGroups.map((g) => ({ id: g.id, label: g.label, count: g.organisms.length }))}
                    activeId={group}
                    onChange={updateGroup}
                  />
                )}

                {!quick && category === 'bacteria' && <BacteriaFilters filters={bacteriaFilters} onChange={setBacteriaFilters} />}
                {!quick && category === 'fungi' && <FungiFilters filters={fungiFilters} onChange={setFungiFilters} />}
                {!quick && category === 'protozoa' && <ProtozoaFilters filters={protozoaFilters} onChange={setProtozoaFilters} />}
                {!quick && category === 'virus' && <VirusFilters filters={virusFilters} onChange={setVirusFilters} />}

                {!quick && category !== 'all' && taxonomyTree.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="tertiary"
                      size="small"
                      icon={<TreeStructure size={14} />}
                      onClick={() => setShowTaxonomyBrowser((v) => !v)}
                    >
                      {showTaxonomyBrowser ? 'Hide taxonomy browser' : 'Browse by taxonomy'}
                    </Button>
                    {showTaxonomyBrowser && <TaxonomyBrowser tree={taxonomyTree} activeKey={taxon} onSelectGroup={selectTaxonNode} />}
                  </div>
                )}
              </>
            )}

            {query.trim().length > 0 && filtered.length > 0 && (
              <SearchResultsHeader query={query.trim()} resultCount={filtered.length} taxonMatch={taxonMatch} />
            )}

            {filtered.length === 0 ? (
              <div className="rounded-md border border-border bg-surface p-6">
                {query.trim().length > 0 && looksLikeOrganismQuery(query) ? (
                  <KnowledgeLayerSearchPanel query={query} onFound={(id) => navigate(`/organisms/${id}`)} />
                ) : (
                  <EmptyState
                    title="No organisms match"
                    description="Try another group, or reset your filters."
                    action={
                      hasActiveFilters ? (
                        <Button variant="secondary" size="small" onClick={resetAll}>
                          Reset filters
                        </Button>
                      ) : undefined
                    }
                  />
                )}
              </div>
            ) : (
              !isHub && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((organism) => (
                    <OrganismCard key={organism.id} organism={organism} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
