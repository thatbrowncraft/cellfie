import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MagnifyingGlass, Stethoscope } from '@phosphor-icons/react'
import { LaboratoryLayout } from '../../shared/layouts'
import { useBreakpointClass, GRID_COLS_PRESETS } from '../../shared/hooks/useMediaQuery'
import { Card, CardBody, EmptyState, Micro, SearchField, SkeletonCard } from '../../shared/components'
import { CATEGORY_LABELS } from '../../core/laboratory/registry'
import {
  labContentPath,
  loadClinicalRegistry,
  listClinicalByDiscipline,
  searchClinicalLaboratory,
  type ClinicalSearchHit
} from '../../core/laboratory/clinicalRegistry'
import type { LaboratoryContent } from '../../core/laboratory/types'

/**
 * Clinical Laboratory hub — Laboratory Clinical Expansion §11/§14.
 *
 * Kept as its own route/page/chunk (not folded into LaboratoryPage)
 * specifically so opening plain `/laboratory` never pulls the clinical
 * registry in — `loadClinicalRegistry()` below is the first and only
 * place that dynamic import fires, triggered by this page actually
 * mounting. Disciplines render as their own browsable groups rather
 * than reusing the main Explore-by-Category grid, since "Hematology",
 * "Clinical Microbiology", etc. are a different, additional axis on top
 * of the existing protocol/concept/equipment/formula categories.
 */
export function ClinicalLaboratoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<{ discipline: string; items: LaboratoryContent[] }[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listClinicalByDiscipline(), loadClinicalRegistry()]).then(([byDiscipline, snapshot]) => {
      if (cancelled) return
      setGroups(byDiscipline)
      setTotal(snapshot.all.length)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const [searchResults, setSearchResults] = useState<ClinicalSearchHit[]>([])
  useEffect(() => {
    let cancelled = false
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    searchClinicalLaboratory(query).then((hits) => {
      if (!cancelled) setSearchResults(hits)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  function setQuery(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    })
  }

  const isSearching = query.trim().length > 0
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <LaboratoryLayout
      title="Clinical Laboratory"
      sidebar={
        <button
          type="button"
          onClick={() => navigate('/laboratory')}
          className="flex items-center gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          <span>Back to Laboratory</span>
        </button>
      }
    >
      <div className="flex flex-col gap-8">
        <header>
          <div className="flex items-center gap-2">
            <Stethoscope size={24} className="text-olive" aria-hidden />
            <h1 className="font-display text-display font-semibold text-ink-primary">Clinical Laboratory</h1>
          </div>
          <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">
            Microbiology, but the patient's in the room now. {total > 0 ? `${total} clinical references, ` : ''}built on top of everything
            you already know.
          </p>
          <div className="mt-4 max-w-md">
            <SearchField placeholder="Search clinical laboratory content..." defaultValue={query} onChange={setQuery} />
          </div>
        </header>

        {isSearching ? (
          <SearchResultsGrid results={searchResults} onSelect={(id, category) => navigate(labContentPath(id, category))} />
        ) : loading ? (
          <div className={`grid gap-4 ${gridColsClass}`}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <DisciplineSection key={group.discipline} discipline={group.discipline} items={group.items} onSelect={(item) => navigate(labContentPath(item.id, item.category))} />
            ))}
          </div>
        )}
      </div>
    </LaboratoryLayout>
  )
}

function DisciplineSection({
  discipline,
  items,
  onSelect
}: {
  discipline: string
  items: LaboratoryContent[]
  onSelect: (item: LaboratoryContent) => void
}) {
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <section>
      <h2 className="font-display text-h3 font-medium text-ink-primary">{discipline}</h2>
      <Micro as="p" className="mt-0.5 mb-3">
        {items.length} {items.length === 1 ? 'entry' : 'entries'}
      </Micro>
      <div className={`grid gap-4 ${gridColsClass}`}>
        {items.map((item) => (
          <Card key={item.id} interactive onClick={() => onSelect(item)}>
            <CardBody className="flex flex-col gap-1">
              <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">{CATEGORY_LABELS[item.category]}</p>
              <p className="font-display text-h3 font-medium text-ink-primary">{item.title}</p>
              {item.difficulty && <p className="mt-1 font-ui text-caption capitalize text-ink-tertiary">{item.difficulty}</p>}
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  )
}

function SearchResultsGrid({ results, onSelect }: { results: ClinicalSearchHit[]; onSelect: (id: string, category: LaboratoryContent['category']) => void }) {
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  if (results.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6">
        <EmptyState icon={<MagnifyingGlass size={32} />} title="Nothing matches" description="No Clinical Laboratory content found for that search." />
      </div>
    )
  }
  return (
    <div className={`grid gap-4 ${gridColsClass}`}>
      {results.map((hit) => (
        <Card key={`${hit.category}-${hit.id}`} interactive onClick={() => onSelect(hit.id, hit.category)}>
          <CardBody className="flex flex-col gap-1">
            <p className="font-display text-h3 font-medium text-ink-primary">{hit.title}</p>
            <p className="font-ui text-caption text-ink-tertiary">
              {hit.subtitle}
              {hit.discipline ? ` · ${hit.discipline}` : ''}
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
