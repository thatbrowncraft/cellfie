import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Atom } from '@phosphor-icons/react'
import { Card, CardBody, SearchField, EmptyState, H2, H3, Body, Caption, Micro } from '../../shared/components'
import { cn } from '../../shared/utils/cn'
import { ALL_ELEMENTS, searchElements } from '../../core/periodic-table/registry'
import { ELEMENT_FAMILIES, MNEMONICS, PERIODIC_TRENDS, QUICK_MODES } from '../../core/periodic-table/reference'
import { PeriodicTableGrid } from './components/PeriodicTableGrid'
import { FilterBar, FILTER_OPTIONS } from './components/FilterBar'
import { MemoryTricksSection } from './components/MemoryTricksSection'

type QuickModeId = (typeof QUICK_MODES)[number]['id'] | null

/**
 * Study Vault Periodic Table — a new page/module added alongside the
 * existing Study Vault (Notes) page, not a rewrite of it (brief §1).
 * Reuses Card/SearchField/Button/Typography exactly as Laboratory and
 * Notes already do, so it visually belongs to Cellfie without a second
 * design language (brief §20).
 */
export function PeriodicTablePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null)
  const [activePeriod, setActivePeriod] = useState<number | null>(null)
  const [quickMode, setQuickMode] = useState<QuickModeId>(null)

  const isSearching = query.trim().length > 0
  const searchResults = useMemo(() => (isSearching ? searchElements(query) : []), [query, isSearching])

  const filterOption = FILTER_OPTIONS.find((f) => f.id === activeFilter)
  const activeFamily = ELEMENT_FAMILIES.find((f) => f.id === activeFamilyId) ?? null

  const highlightIds = useMemo(() => {
    if (isSearching) return new Set(searchResults.map((e) => e.id))
    if (activeFamily) {
      return new Set(ALL_ELEMENTS.filter((e) => activeFamily.categories.includes(e.elementCategory)).map((e) => e.id))
    }
    if (activePeriod) {
      return new Set(ALL_ELEMENTS.filter((e) => e.period === activePeriod).map((e) => e.id))
    }
    if (filterOption && filterOption.id !== 'all') {
      const matches = ALL_ELEMENTS.filter((e) => {
        if (filterOption.categories) return filterOption.categories.includes(e.elementCategory)
        if (filterOption.block) return `block-${e.block}` === filterOption.block
        return true
      })
      return new Set(matches.map((e) => e.id))
    }
    return undefined
  }, [isSearching, searchResults, activeFamily, activePeriod, filterOption])

  function handleSelect(id: string) {
    navigate(`/periodic-table/${id}`)
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-6 flex items-start gap-3">
        <Atom size={28} className="mt-1 flex-shrink-0 text-olive" aria-hidden />
        <div>
          <H2 as="h1">Periodic Table</H2>
          <Body className="mt-1 text-ink-secondary">
            All 118 elements, real data, real relationships — tap any element for the full profile.
          </Body>
        </div>
      </header>

      <div className="mb-4">
        <SearchField
          placeholder="Search by name, symbol, or atomic number…"
          onChange={(v) => {
            setQuery(v)
            if (v.trim()) {
              setActiveFilter('all')
              setActiveFamilyId(null)
              setActivePeriod(null)
            }
          }}
        />
      </div>

      {!isSearching && (
        <div className="mb-4">
          <FilterBar
            activeId={activeFilter}
            onChange={(id) => {
              setActiveFilter(id)
              setActiveFamilyId(null)
              setActivePeriod(null)
            }}
          />
        </div>
      )}

      {/* Quick exploration modes — brief §26, kept lightweight (one row, no dashboard sprawl). */}
      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setQuickMode((prev) => (prev === m.id ? null : m.id))}
            aria-pressed={quickMode === m.id}
            className={cn(
              'rounded-sm border px-3 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
              quickMode === m.id
                ? 'border-olive bg-surface-raised text-ink-primary'
                : 'border-border text-ink-secondary hover:bg-surface-raised'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {quickMode === 'family' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {ELEMENT_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActiveFamilyId((prev) => (prev === f.id ? null : f.id))
                setActivePeriod(null)
                setActiveFilter('all')
              }}
              aria-pressed={activeFamilyId === f.id}
              className={cn(
                'rounded-full border px-3 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
                activeFamilyId === f.id
                  ? 'border-terracotta bg-surface-raised text-ink-primary'
                  : 'border-border text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {activeFamily && (
        <p className="mb-4 font-ui text-caption italic text-ink-tertiary">"{activeFamily.description}"</p>
      )}

      {quickMode === 'atomic-number' && (
        <Card className="mb-6">
          <CardBody>
            <H3>Atomic Number Memory Aids</H3>
            <div className="mt-3 flex flex-col gap-4">
              {MNEMONICS.map((m) => (
                <div key={m.id}>
                  <Caption className="font-medium text-ink-secondary">{m.label}</Caption>
                  <p className="mt-1 font-ui text-caption text-ink-tertiary">{m.sequence.join(' · ')}</p>
                  <Body className="mt-1 italic">{m.mnemonic}</Body>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {quickMode === 'metal-nonmetal' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {['metals', 'nonmetals', 'metalloids'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveFilter(id)
                setActiveFamilyId(null)
                setActivePeriod(null)
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
                activeFilter === id
                  ? 'border-terracotta bg-surface-raised text-ink-primary'
                  : 'border-border text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {FILTER_OPTIONS.find((f) => f.id === id)?.label}
            </button>
          ))}
        </div>
      )}

      {quickMode === 'period' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePeriod((prev) => (prev === p ? null : p))}
              aria-pressed={activePeriod === p}
              className={cn(
                'rounded-full border px-3 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
                activePeriod === p
                  ? 'border-terracotta bg-surface-raised text-ink-primary'
                  : 'border-border text-ink-secondary hover:bg-surface-raised'
              )}
            >
              Period {p}
            </button>
          ))}
        </div>
      )}

      {quickMode === 'ncert' && (
        <p className="mb-4 font-ui text-caption italic text-ink-tertiary">
          Filter or search above, then check each element's profile for its "NCERT / Study Relevance" section.
        </p>
      )}

      {isSearching && searchResults.length === 0 ? (
        <EmptyState title="No elements found" description={`Nothing matches "${query}" yet — try a name, symbol, or atomic number.`} />
      ) : (
        <PeriodicTableGrid onSelect={handleSelect} highlightIds={highlightIds} />
      )}

      {isSearching && searchResults.length > 0 && (
        <Micro className="mt-3 block text-ink-tertiary">
          {searchResults.length} match{searchResults.length === 1 ? '' : 'es'} highlighted above.
        </Micro>
      )}

      {!isSearching && !quickMode && (
        <Card className="mt-8">
          <CardBody>
            <H3>Periodic Trend Guide</H3>
            <div className="mt-3 flex flex-col gap-4">
              {PERIODIC_TRENDS.map((t) => (
                <div key={t.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <Caption className="font-medium text-ink-primary">{t.label}</Caption>
                  <Body className="mt-1">
                    <span className="font-medium text-ink-secondary">Across a period: </span>
                    {t.acrossPeriod}
                  </Body>
                  <Body className="mt-1">
                    <span className="font-medium text-ink-secondary">Down a group: </span>
                    {t.downGroup}
                  </Body>
                  {t.exceptions && (
                    <Body className="mt-1 text-ink-tertiary">
                      <span className="font-medium">Exception: </span>
                      {t.exceptions}
                    </Body>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {!isSearching && !quickMode && <MemoryTricksSection />}
    </div>
  )
}
