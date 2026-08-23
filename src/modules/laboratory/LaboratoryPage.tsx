import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calculator, Flask, Ruler } from '@phosphor-icons/react'
import { LaboratoryLayout } from '../../shared/layouts'
import { Card, CardBody, EmptyState, SearchField, Micro } from '../../shared/components'
import { cn } from '../../shared/utils/cn'
import {
  CATEGORY_LABELS,
  countByCategory,
  listByCategory,
  searchLaboratory
} from '../../core/laboratory/registry'
import { CALCULATORS } from '../../core/laboratory/calculators'
import { getCalculatorTagline, getItemTagline, LAB_HUB_TAGLINE, CALCULATOR_HUB_TAGLINE, UNIT_CONVERTER_TAGLINE } from '../../core/laboratory/microcopy'
import type { LaboratoryCategory } from '../../core/laboratory/types'

type SectionId = LaboratoryCategory | 'calculators' | 'unit-converter'

const SECTION_ORDER: SectionId[] = ['protocol', 'concept', 'media', 'biochemical-test', 'biosafety', 'equipment', 'formula', 'calculators', 'unit-converter']

function sectionLabel(id: SectionId): string {
  if (id === 'calculators') return 'Calculators'
  if (id === 'unit-converter') return 'Unit Converter'
  return CATEGORY_LABELS[id]
}

const SECTION_TAGLINE: Record<LaboratoryCategory, string> = {
  protocol: 'Step-by-step, because "just wing it" is not a valid SOP.',
  concept: 'The vocabulary that keeps you from getting cooked in viva.',
  media: "Agar's version of a five-star meal, made to spec.",
  'biochemical-test': 'Tiny color changes with big identification energy.',
  biosafety: "The chapter where 'it's probably fine' is banned.",
  equipment: 'The squad that does the actual heavy lifting.',
  formula: 'Equations that owe you nothing but the truth.'
}

/**
 * Laboratory Hub — Tier 1 Foundation (Implementation Brief §4, §20).
 * A persistent section index beside a searchable content grid, matching
 * the existing Cellfie unified-section layout pattern (LaboratoryLayout,
 * shared with the module's original shell). Every card here links to a
 * detail page at `/laboratory/:category/:id`, a calculator page at
 * `/laboratory/calculators/:id`, or the unit converter at
 * `/laboratory/unit-converter`.
 */
export function LaboratoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = (searchParams.get('section') as SectionId | null) ?? 'protocol'
  const query = searchParams.get('q') ?? ''

  const counts = useMemo(() => countByCategory(), [])

  function setSection(section: SectionId) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', section)
      next.delete('q')
      return next
    })
  }

  function setQuery(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    })
  }

  const searchHits = useMemo(() => (query.trim() ? searchLaboratory(query) : []), [query])

  const sectionItems = useMemo(() => {
    if (activeSection === 'calculators' || activeSection === 'unit-converter') return []
    return listByCategory(activeSection)
  }, [activeSection])

  const isSearching = query.trim().length > 0

  return (
    <LaboratoryLayout
      title="Sections"
      sidebar={SECTION_ORDER.map((section) => {
        const count = section === 'calculators' ? CALCULATORS.length : section === 'unit-converter' ? undefined : counts[section]
        return (
          <button
            key={section}
            type="button"
            onClick={() => setSection(section)}
            className={cn(
              'flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui transition-colors',
              activeSection === section && !isSearching
                ? 'bg-surface-raised font-medium text-ink-primary'
                : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
            )}
          >
            <span>{sectionLabel(section)}</span>
            {count !== undefined && <span className="font-ui text-micro text-ink-tertiary">{count}</span>}
          </button>
        )
      })}
    >
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="font-display text-h1 font-semibold text-ink-primary">Laboratory</h1>
          <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{LAB_HUB_TAGLINE}</p>
        </header>

        <SearchField
          placeholder="Search protocols, media, tests, formulas, equipment…"
          defaultValue={query}
          onChange={setQuery}
          className="max-w-lg"
        />

        {isSearching ? (
          <SearchResultsGrid query={query} results={searchHits} onSelect={(id, category) => navigate(`/laboratory/${category}/${id}`)} />
        ) : activeSection === 'calculators' ? (
          <CalculatorGrid onSelect={(id) => navigate(`/laboratory/calculators/${id}`)} />
        ) : activeSection === 'unit-converter' ? (
          <UnitConverterCard onOpen={() => navigate('/laboratory/unit-converter')} />
        ) : (
          <ContentGrid category={activeSection} onSelect={(id) => navigate(`/laboratory/${activeSection}/${id}`)} />
        )}

        {!isSearching && activeSection !== 'calculators' && activeSection !== 'unit-converter' && sectionItems.length === 0 && (
          <div className="rounded-md border border-border bg-surface p-6">
            <EmptyState
              icon={<Flask size={32} />}
              title="Nothing here yet"
              description="This section's Tier 1 content is still being added — check back soon, or browse another section."
            />
          </div>
        )}
      </div>
    </LaboratoryLayout>
  )
}

function ContentGrid({ category, onSelect }: { category: LaboratoryCategory; onSelect: (id: string) => void }) {
  const items = listByCategory(category)
  if (items.length === 0) return null
  return (
    <div>
      <Micro as="p" className="mb-3">
        {SECTION_TAGLINE[category]}
      </Micro>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} interactive onClick={() => onSelect(item.id)}>
            <CardBody className="flex flex-col gap-1">
              <p className="font-display text-h3 font-medium text-ink-primary">{item.title}</p>
              {item.subcategory && <p className="font-ui text-caption text-ink-tertiary">{item.subcategory}</p>}
              <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{getItemTagline(item.id, category)}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CalculatorGrid({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div>
      <Micro as="p" className="mb-3">
        {CALCULATOR_HUB_TAGLINE}
      </Micro>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((calc) => (
          <Card key={calc.id} interactive onClick={() => onSelect(calc.id)}>
            <CardBody className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-olive" aria-hidden />
                <p className="font-display text-h3 font-medium text-ink-primary">{calc.title}</p>
              </div>
              <p className="font-body text-caption text-ink-secondary">{calc.shortDescription}</p>
              <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{getCalculatorTagline(calc.id)}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

function UnitConverterCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Card interactive onClick={onOpen} className="max-w-md">
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Ruler size={20} className="text-olive" aria-hidden />
          <p className="font-display text-h3 font-medium text-ink-primary">Unit Converter</p>
        </div>
        <p className="font-body text-caption text-ink-secondary">
          Mass, volume, length, temperature, concentration, molarity, pressure, time, and centrifugation units.
        </p>
        <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{UNIT_CONVERTER_TAGLINE}</p>
      </CardBody>
    </Card>
  )
}

function SearchResultsGrid({
  query,
  results,
  onSelect
}: {
  query: string
  results: ReturnType<typeof searchLaboratory>
  onSelect: (id: string, category: LaboratoryCategory) => void
}) {
  if (results.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6">
        <EmptyState title="Nothing matches" description={`No Laboratory content found for "${query}".`} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((hit) => (
        <Card key={`${hit.category}-${hit.id}`} interactive onClick={() => onSelect(hit.id, hit.category)}>
          <CardBody className="flex flex-col gap-1">
            <p className="font-display text-h3 font-medium text-ink-primary">{hit.title}</p>
            <p className="font-ui text-caption text-ink-tertiary">{hit.subtitle}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
