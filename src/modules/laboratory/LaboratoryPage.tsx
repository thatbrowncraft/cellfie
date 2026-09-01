import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  Bug,
  Calculator,
  Flask,
  ListChecks,
  MagnifyingGlass,
  Monitor,
  Ruler,
  Scales,
  ShieldWarning,
  Sparkle,
  Stack,
  Stethoscope
} from '@phosphor-icons/react'
import { LaboratoryLayout } from '../../shared/layouts'
import { useBreakpointClass, GRID_COLS_PRESETS } from '../../shared/hooks/useMediaQuery'
import { Card, CardBody, EmptyState, SearchField, Micro } from '../../shared/components'
import { cn } from '../../shared/utils/cn'
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SHORT_LABELS,
  countByCategory,
  countByDifficulty,
  getRandomLabContent,
  listByCategory,
  listByDifficulty,
  searchLaboratory
} from '../../core/laboratory/registry'
import { CALCULATORS } from '../../core/laboratory/calculators'
import {
  DIFFICULTY_TAGLINES,
  LAB_HUB_TAGLINE,
  QUICK_DESK_TAGLINE,
  LEARN_BY_DIFFICULTY_TAGLINE,
  RANDOM_PICK_TAGLINE,
  SECTION_TAGLINES,
  getCalculatorTagline,
  getItemTagline,
  CALCULATOR_HUB_TAGLINE,
  UNIT_CONVERTER_TAGLINE
} from '../../core/laboratory/microcopy'
import type { LabDifficulty, LaboratoryCategory } from '../../core/laboratory/types'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { listSavedLabItems } from '../../core/laboratory/savedItems'
import type { SavedLabItemRecord } from '../../core/db'
import { LabSourcesPanel } from './components/LabSourcesPanel'
import { SavedLabItemsSection } from './components/SavedLabItemsSection'

type SectionId = LaboratoryCategory | 'calculators' | 'unit-converter' | 'saved'

const SECTION_ORDER: SectionId[] = [
  'protocol',
  'concept',
  'media',
  'biochemical-test',
  'biosafety',
  'equipment',
  'formula',
  'calculators',
  'unit-converter',
  'saved'
]

function sectionLabel(id: SectionId): string {
  if (id === 'calculators') return 'Calculators'
  if (id === 'unit-converter') return 'Unit Converter'
  if (id === 'saved') return 'Saved Lab Items'
  return CATEGORY_LABELS[id]
}

/** A stable, human-readable "virtual" content id for a free-text Laboratory search — lets the Knowledge Layer cache (core/laboratory/knowledgeLayer.ts) namespace My Library/Online Knowledge lookups for search terms that don't correspond to any curated content id. */
function searchContentId(query: string): string {
  return `search:${query.trim().toLowerCase().replace(/\s+/g, '-')}`
}

const SECTION_TAGLINE = SECTION_TAGLINES

interface QuickDeskItem {
  section: SectionId
  label: string
  icon: React.ReactNode
}

const QUICK_DESK_ITEMS: QuickDeskItem[] = [
  { section: 'protocol', label: 'Browse Protocols', icon: <ListChecks size={20} aria-hidden /> },
  { section: 'formula', label: 'Open Formula Hub', icon: <Scales size={20} aria-hidden /> },
  { section: 'calculators', label: 'Calculate', icon: <Calculator size={20} aria-hidden /> },
  { section: 'unit-converter', label: 'Convert Units', icon: <Ruler size={20} aria-hidden /> },
  { section: 'biochemical-test', label: 'Biochemical Tests', icon: <Bug size={20} aria-hidden /> },
  { section: 'biosafety', label: 'Check Biosafety', icon: <ShieldWarning size={20} aria-hidden /> },
  { section: 'equipment', label: 'Explore Equipment', icon: <Monitor size={20} aria-hidden /> },
  { section: 'media', label: 'Explore Media', icon: <Stack size={20} aria-hidden /> }
]

/**
 * Laboratory Hub — Laboratory 2.0 brief §2-4, §20, §24.
 *
 * The landing state (no `?section=` and no `?q=` in the URL) is now an
 * interactive hub — Hero, Quick Lab Desk, Learn by Difficulty, then
 * Explore by Category — rather than dropping straight into the
 * "protocol" section list the way Tier 1 did. Picking a section (via
 * the sidebar, a Quick Desk tile, or a difficulty card) switches into
 * the existing searchable content-grid view, which is untouched
 * (brief: "do not create a second architecture").
 */
export function LaboratoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section') as SectionId | null
  const difficultyParam = searchParams.get('difficulty') as LabDifficulty | null
  const query = searchParams.get('q') ?? ''
  const isSearching = query.trim().length > 0
  const isHub = !sectionParam && !difficultyParam && !isSearching

  const counts = useMemo(() => countByCategory(), [])
  const savedItems = useLiveQuery<SavedLabItemRecord[]>(() => listSavedLabItems(), [], [])

  function setSection(section: SectionId) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', section)
      next.delete('q')
      next.delete('difficulty')
      return next
    })
  }

  function setDifficulty(difficulty: LabDifficulty) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('difficulty', difficulty)
      next.delete('section')
      next.delete('q')
      return next
    })
  }

  function goToHub() {
    setSearchParams(new URLSearchParams())
  }

  function setQuery(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    })
  }

  function handleRandomPick() {
    const pick = getRandomLabContent()
    if (pick) navigate(`/laboratory/${pick.category}/${pick.id}`)
  }

  const searchHits = useMemo(() => (query.trim() ? searchLaboratory(query) : []), [query])
  const calculatorHits = useMemo(
    () => (query.trim() ? CALCULATORS.filter((c) => `${c.title} ${c.shortDescription}`.toLowerCase().includes(query.trim().toLowerCase())) : []),
    [query]
  )

  const sectionItems = useMemo(() => {
    if (!sectionParam || sectionParam === 'calculators' || sectionParam === 'unit-converter' || sectionParam === 'saved') return []
    return listByCategory(sectionParam)
  }, [sectionParam])

  const difficultyItems = useMemo(() => (difficultyParam ? listByDifficulty(difficultyParam) : []), [difficultyParam])

  return (
    <LaboratoryLayout
      title="Sections"
      sidebar={
        <>
          <button
            type="button"
            onClick={goToHub}
            className={cn(
              'flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui font-medium transition-colors',
              isHub ? 'bg-surface-raised text-ink-primary' : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
            )}
          >
            <span>Lab Hub</span>
          </button>
          {SECTION_ORDER.map((section) => {
            const count =
              section === 'calculators'
                ? CALCULATORS.length
                : section === 'unit-converter'
                  ? undefined
                  : section === 'saved'
                    ? savedItems.length
                    : counts[section]
            return (
              <button
                key={section}
                type="button"
                onClick={() => setSection(section)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui transition-colors',
                  sectionParam === section && !isSearching
                    ? 'bg-surface-raised font-medium text-ink-primary'
                    : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
                )}
              >
                <span>{sectionLabel(section)}</span>
                {count !== undefined && <span className="font-ui text-micro text-ink-tertiary">{count}</span>}
              </button>
            )
          })}
        </>
      }
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
          <div className="flex flex-col gap-8">
            <SearchResultsGrid
              query={query}
              results={searchHits}
              calculatorResults={calculatorHits}
              onSelect={(id, category) => navigate(`/laboratory/${category}/${id}`)}
              onSelectCalculator={(id) => navigate(`/laboratory/calculators/${id}`)}
            />
            {/*
              Brief §16: a search term with no (or even with a) curated
              JSON match should never dead-end — the same three-layer
              Knowledge Layer already used on detail pages (LabSourcesPanel)
              is available right here, keyed by a stable "virtual" content
              id so My Library/Online Knowledge results for this exact
              search term get cached the same way a curated item's would.
            */}
            {/*
              Second-pass fix (audit brief §5): without a `key`, typing a
              new search term here would reuse the SAME LabSourcesPanel
              instance (and its internal Search-Again `shownIds` state)
              across two completely different topics — e.g. dismissing a
              result while searching "PCR" would incorrectly exclude that
              id from a later "Gram staining" search in the same session.
              `searchContentId(query)` already uniquely identifies the
              topic, so it doubles as the correct remount key.
            */}
            <LabSourcesPanel key={searchContentId(query)} title={query} contentId={searchContentId(query)} />
          </div>
        ) : isHub ? (
          <LaboratoryHub
            onSetSection={setSection}
            onSetDifficulty={setDifficulty}
            onRandomPick={handleRandomPick}
            onOpenClinical={() => navigate('/laboratory/clinical')}
            savedCount={savedItems.length}
          />
        ) : difficultyParam ? (
          <DifficultyGrid difficulty={difficultyParam} items={difficultyItems} onSelect={(id, category) => navigate(`/laboratory/${category}/${id}`)} />
        ) : sectionParam === 'calculators' ? (
          <CalculatorGrid onSelect={(id) => navigate(`/laboratory/calculators/${id}`)} />
        ) : sectionParam === 'unit-converter' ? (
          <UnitConverterCard onOpen={() => navigate('/laboratory/unit-converter')} />
        ) : sectionParam === 'saved' ? (
          <SavedLabItemsSection items={savedItems} />
        ) : sectionParam ? (
          <ContentGrid category={sectionParam} onSelect={(id) => navigate(`/laboratory/${sectionParam}/${id}`)} />
        ) : null}

        {sectionParam &&
          sectionParam !== 'calculators' &&
          sectionParam !== 'unit-converter' &&
          sectionParam !== 'saved' &&
          !isSearching &&
          sectionItems.length === 0 && (
          <div className="rounded-md border border-border bg-surface p-6">
            <EmptyState
              icon={<Flask size={32} />}
              title="Nothing here yet"
              description="This section's content is still being added — check back soon, or browse another section."
            />
          </div>
        )}
      </div>
    </LaboratoryLayout>
  )
}

// ---------------------------------------------------------------------------
// The Hub itself
// ---------------------------------------------------------------------------

function LaboratoryHub({
  onSetSection,
  onSetDifficulty,
  onRandomPick,
  onOpenClinical,
  savedCount
}: {
  onSetSection: (section: SectionId) => void
  onSetDifficulty: (difficulty: LabDifficulty) => void
  onRandomPick: () => void
  onOpenClinical: () => void
  savedCount: number
}) {
  const difficultyCounts = useMemo(() => countByDifficulty(), [])
  const categoryCounts = useMemo(() => countByCategory(), [])
  // PWA layout-isolation fix — these three grids used raw `sm:`/`lg:`
  // Tailwind breakpoints; see `useBreakpointClass` in
  // shared/hooks/useMediaQuery.ts for why.
  const quickDeskGridClass = useBreakpointClass(GRID_COLS_PRESETS.twoFour)
  const difficultyGridClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoFour)
  const categoryGridClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <div className="flex flex-col gap-10">
      {/* Quick Lab Desk */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-h3 font-medium text-ink-primary">Quick Lab Desk</h2>
            <Micro as="p" className="mt-0.5">
              {QUICK_DESK_TAGLINE}
            </Micro>
          </div>
          <button
            type="button"
            onClick={onRandomPick}
            title={RANDOM_PICK_TAGLINE}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 font-ui text-caption font-medium text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
          >
            <Sparkle size={16} aria-hidden />
            Random Lab Pick
          </button>
        </div>
        <div className={`grid gap-3 ${quickDeskGridClass}`}>
          {QUICK_DESK_ITEMS.map((tile) => (
            <button
              key={tile.section}
              type="button"
              onClick={() => onSetSection(tile.section)}
              className="flex flex-col items-start gap-2 rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
            >
              <span className="text-olive">{tile.icon}</span>
              <span className="font-ui text-ui font-medium leading-tight text-ink-primary">{tile.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenClinical}
            className="flex flex-col items-start gap-2 rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
          >
            <span className="text-olive">
              <Stethoscope size={20} aria-hidden />
            </span>
            <span className="font-ui text-ui font-medium leading-tight text-ink-primary">Clinical Laboratory</span>
          </button>
        </div>
      </section>

      {/* Learn by Difficulty */}
      <section>
        <h2 className="font-display text-h3 font-medium text-ink-primary">Learn by Difficulty</h2>
        <Micro as="p" className="mt-0.5 mb-3">
          {LEARN_BY_DIFFICULTY_TAGLINE}
        </Micro>
        <div className={`grid gap-3 ${difficultyGridClass}`}>
          {DIFFICULTY_ORDER.map((difficulty) => (
            <Card key={difficulty} interactive onClick={() => onSetDifficulty(difficulty)}>
              <CardBody className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="font-display text-h3 font-medium text-ink-primary">{DIFFICULTY_LABELS[difficulty]}</p>
                  <span className="font-ui text-micro text-ink-tertiary">{difficultyCounts[difficulty]}</span>
                </div>
                <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{DIFFICULTY_SHORT_LABELS[difficulty]}</p>
                <p className="mt-1 font-body text-caption text-ink-secondary">{DIFFICULTY_TAGLINES[difficulty]}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Explore by Category */}
      <section>
        <h2 className="font-display text-h3 font-medium text-ink-primary">Explore by Category</h2>
        <Micro as="p" className="mt-0.5 mb-3">
          The complete section structure — everything Quick Lab Desk shortcuts into, laid out in full.
        </Micro>
        <div className={`grid gap-3 ${categoryGridClass}`}>
          {(['protocol', 'concept', 'media', 'biochemical-test', 'biosafety', 'equipment', 'formula'] as LaboratoryCategory[]).map((category) => (
            <Card key={category} interactive onClick={() => onSetSection(category)}>
              <CardBody className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="font-display text-h3 font-medium text-ink-primary">{CATEGORY_LABELS[category]}</p>
                  <span className="font-ui text-micro text-ink-tertiary">{categoryCounts[category]}</span>
                </div>
                <p className="font-ui text-caption italic text-ink-tertiary">{SECTION_TAGLINE[category]}</p>
              </CardBody>
            </Card>
          ))}
          <Card interactive onClick={() => onSetSection('calculators')}>
            <CardBody className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="font-display text-h3 font-medium text-ink-primary">Calculators</p>
                <span className="font-ui text-micro text-ink-tertiary">{CALCULATORS.length}</span>
              </div>
              <p className="font-ui text-caption italic text-ink-tertiary">{CALCULATOR_HUB_TAGLINE}</p>
            </CardBody>
          </Card>
          <Card interactive onClick={() => onSetSection('unit-converter')}>
            <CardBody className="flex flex-col gap-1">
              <p className="font-display text-h3 font-medium text-ink-primary">Unit Converter</p>
              <p className="font-ui text-caption italic text-ink-tertiary">{UNIT_CONVERTER_TAGLINE}</p>
            </CardBody>
          </Card>
          <Card interactive onClick={() => onSetSection('saved')}>
            <CardBody className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="font-display text-h3 font-medium text-ink-primary">Saved Lab Items</p>
                <span className="font-ui text-micro text-ink-tertiary">{savedCount}</span>
              </div>
              <p className="font-ui text-caption italic text-ink-tertiary">Everything you kept — curated, from your library, or from online.</p>
            </CardBody>
          </Card>
          <Card interactive onClick={onOpenClinical}>
            <CardBody className="flex flex-col gap-1">
              <p className="font-display text-h3 font-medium text-ink-primary">Clinical Laboratory</p>
              <p className="font-ui text-caption italic text-ink-tertiary">
                Microbiology, but the patient's in the room now — hematology, blood bank, urinalysis, and more.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  )
}

function DifficultyGrid({
  difficulty,
  items,
  onSelect
}: {
  difficulty: LabDifficulty
  items: ReturnType<typeof listByDifficulty>
  onSelect: (id: string, category: LaboratoryCategory) => void
}) {
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <div>
      <div className="mb-3">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{DIFFICULTY_SHORT_LABELS[difficulty]}</p>
        <Micro as="p" className="mt-0.5">
          {DIFFICULTY_TAGLINES[difficulty]}
        </Micro>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<BookOpen size={32} />}
            title="Nothing tagged at this level yet"
            description="More content is being classified by difficulty — check back soon, or browse by category instead."
          />
        </div>
      ) : (
        <div className={`grid gap-4 ${gridColsClass}`}>
          {items.map((item) => (
            <Card key={item.id} interactive onClick={() => onSelect(item.id, item.category)}>
              <CardBody className="flex flex-col gap-1">
                <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">{CATEGORY_LABELS[item.category]}</p>
                <p className="font-display text-h3 font-medium text-ink-primary">{item.title}</p>
                <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{getItemTagline(item.id, item.category)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ContentGrid({ category, onSelect }: { category: LaboratoryCategory; onSelect: (id: string) => void }) {
  const items = listByCategory(category)
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)
  if (items.length === 0) return null
  return (
    <div>
      <Micro as="p" className="mb-3">
        {SECTION_TAGLINE[category]}
      </Micro>
      <div className={`grid gap-4 ${gridColsClass}`}>
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
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)
  return (
    <div>
      <Micro as="p" className="mb-3">
        {CALCULATOR_HUB_TAGLINE}
      </Micro>
      <div className={`grid gap-4 ${gridColsClass}`}>
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
  calculatorResults,
  onSelect,
  onSelectCalculator
}: {
  query: string
  results: ReturnType<typeof searchLaboratory>
  calculatorResults: typeof CALCULATORS
  onSelect: (id: string, category: LaboratoryCategory) => void
  onSelectCalculator: (id: string) => void
}) {
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  if (results.length === 0 && calculatorResults.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6">
        <EmptyState icon={<MagnifyingGlass size={32} />} title="Nothing matches" description={`No Laboratory content found for "${query}".`} />
      </div>
    )
  }
  return (
    <div className={`grid gap-4 ${gridColsClass}`}>
      {calculatorResults.map((calc) => (
        <Card key={`calc-${calc.id}`} interactive onClick={() => onSelectCalculator(calc.id)}>
          <CardBody className="flex flex-col gap-1">
            <p className="font-display text-h3 font-medium text-ink-primary">{calc.title}</p>
            <p className="font-ui text-caption text-ink-tertiary">Calculator</p>
          </CardBody>
        </Card>
      ))}
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
