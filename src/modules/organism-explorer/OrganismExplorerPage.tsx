import { useMemo, useState } from 'react'
import { Bug } from '@phosphor-icons/react'
import { DashboardLayout } from '@/shared/layouts'
import { Button, Dropdown, EmptyState, SearchField } from '@/shared/components'
import {
  applySecondaryFilter,
  countByCategory,
  filterByCategory,
  listOrganisms,
  searchOrganisms,
  secondaryFilterOptions,
  type OrganismCategory,
  type SecondaryFilterId
} from '@/core/organisms'
import { CategoryPills } from './components/CategoryPills'
import { OrganismCard } from './components/OrganismCard'

/**
 * Organism Explorer — Sprint 4. A visual organism library: an
 * illustrated-card grid, searchable by name/genus/species/characteristic,
 * filterable by category and (for bacteria) by Gram reaction/shape/
 * oxygen requirement. Every organism ships as a hand-authored JSON file
 * under src/content/organisms (see core/organisms/registry.ts) and is
 * bundled at build time, so search and filtering both work fully
 * offline — no network request is ever made here (§18/§19).
 */
export function OrganismExplorerPage() {
  const allOrganisms = useMemo(() => listOrganisms(), [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OrganismCategory | 'all'>('all')
  const [secondaryFilter, setSecondaryFilter] = useState<SecondaryFilterId>('all')

  const categoryCounts = useMemo(() => countByCategory(allOrganisms), [allOrganisms])

  const filtered = useMemo(() => {
    let list = filterByCategory(allOrganisms, category)
    list = applySecondaryFilter(list, secondaryFilter)
    list = searchOrganisms(list, query)
    return list
  }, [allOrganisms, category, secondaryFilter, query])

  const hasAnyOrganisms = allOrganisms.length > 0
  const hasActiveFilters = category !== 'all' || secondaryFilter !== 'all' || query.trim().length > 0

  function resetFilters() {
    setCategory('all')
    setSecondaryFilter('all')
  }

  return (
    <DashboardLayout
      title="Organism Explorer"
      subtitle="Visual profiles, classification, morphology, and lab identification at a glance."
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SearchField
              placeholder="Search by name, genus, Gram reaction, shape…"
              onChange={setQuery}
              className="w-full sm:max-w-sm"
            />
            <Dropdown
              label="Filter"
              options={secondaryFilterOptions}
              value={secondaryFilter}
              onChange={(v) => setSecondaryFilter(v as SecondaryFilterId)}
              className="w-full sm:w-52"
            />
          </div>

          <CategoryPills counts={categoryCounts} totalCount={allOrganisms.length} active={category} onChange={setCategory} />

          {filtered.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-6">
              <EmptyState
                title="No organisms match your filters."
                description="Try changing your search or filters."
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" size="small" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  ) : undefined
                }
              />
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
