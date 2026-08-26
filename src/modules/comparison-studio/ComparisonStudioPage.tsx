import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight, MagnifyingGlass, Plus, Scales } from '@phosphor-icons/react'
import { Button, EmptyState, Tabs } from '../../shared/components'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { db, type SavedComparisonRecord } from '../../core/db'
import { ALL_CURATED_COMPARISONS, getCuratedComparisonById } from '../../core/comparison/registry'
import {
  COMPARISON_DIFFICULTY_LABELS,
  COMPARISON_DIFFICULTY_ORDER,
  COMPARISON_DOMAIN_LABELS,
  type ComparisonDifficulty,
  type ComparisonDomain,
  type ComparisonFrequency,
  type ComparisonItemRef
} from '../../core/comparison/types'
import { getComparisonTagline } from '../../core/comparison/microcopy'
import { getRecentComparisons, type RecentComparisonEntry } from '../../core/comparison/recentlyViewed'
import { resolveComparisonSearch, type UnifiedSearchResult } from '../../core/comparison/unifiedSearch'
import { ComparisonCard } from './components/ComparisonCard'

type SavedTab = 'saved' | 'favorites' | 'custom'

/** Landing shows at most this many recent entries (brief §5: "fine to show a small Recent section as well... do not duplicate huge amounts of content"). Same cap Dashboard uses, for the same reason. */
const MAX_LANDING_RECENT = 4
/** "Featured comparisons" cap (brief §4: "approximately 4-6 cards maximum"). */
const MAX_FEATURED = 6
/** Debounce for the landing search box — SearchField reports every keystroke, and each non-empty query can trigger an entity search with a dynamic import (see unifiedSearch.ts), so this avoids firing on every character typed. */
const SEARCH_DEBOUNCE_MS = 350

/**
 * A small, stable "Featured comparisons" selection (brief §4/§27) —
 * frequently-tested items first, then common ones, until MAX_FEATURED is
 * reached. Deliberately not random/rotating: a stable pick means the
 * cards a person bookmarks mentally stay find-able, and it costs nothing
 * extra since the full curated set is already loaded in this module
 * either way (brief §29 — no *additional* content gets pulled in for
 * this, it's a slice of what's already resident).
 */
function pickFeatured(): typeof ALL_CURATED_COMPARISONS {
  const byPriority = [...ALL_CURATED_COMPARISONS].sort((a, b) => {
    const rank = (f: ComparisonFrequency) => (f === 'frequently-tested' ? 0 : f === 'common' ? 1 : 2)
    return rank(a.frequency) - rank(b.frequency)
  })
  return byPriority.slice(0, MAX_FEATURED)
}

/** Builds the query-string NewComparisonPage already knows how to read (`itemAName`/`itemARefKind`/... and the `itemB*` equivalents added alongside it) so an entity-pair fallback match becomes a real prefilled comparison in one hop, with no second prefill mechanism invented for this. */
function buildComparisonUrl(itemA: ComparisonItemRef, itemB: ComparisonItemRef, domain: ComparisonDomain): string {
  const params = new URLSearchParams()
  params.set('itemAName', itemA.name)
  if (itemA.refKind) params.set('itemARefKind', itemA.refKind)
  if (itemA.refId) params.set('itemARefId', itemA.refId)
  if (itemA.labCategory) params.set('itemALabCategory', itemA.labCategory)
  params.set('itemBName', itemB.name)
  if (itemB.refKind) params.set('itemBRefKind', itemB.refKind)
  if (itemB.refId) params.set('itemBRefId', itemB.refId)
  if (itemB.labCategory) params.set('itemBLabCategory', itemB.labCategory)
  params.set('domain', domain)
  return `/comparison/new?${params.toString()}`
}

/**
 * Comparison Studio landing page (brief §2-7, §14, §22/§23, §27).
 *
 * No longer renders "Discover · N curated comparisons" followed by every
 * curated card (removed per brief §2/§4/test 9) — that full, filterable
 * catalog now lives at `/comparison/explore` (`ExploreComparisonsPage`).
 * This page stays a calm hub: hero + primary action, one prominent
 * search box with an entity/custom fallback path (brief §8-13, §32-33),
 * then small Featured / Recent / Explore-by-level / Explore-by-domain
 * sections, each capped, plus the existing Saved/Favorites/My
 * Comparisons collection (unchanged — that's the user's own small set
 * of records, not the curated catalog, so keeping it here doesn't
 * reintroduce the "giant list" problem).
 *
 * The search box itself doesn't implement a second search engine (brief
 * §31) — `resolveComparisonSearch` (`core/comparison/unifiedSearch.ts`)
 * only orchestrates the existing curated search (`registry.ts`) and the
 * existing entity search (`entitySearch.ts`, already used by
 * `ItemPicker.tsx`). My Library / Online Knowledge stay exactly where
 * they already lived — per-aspect, inside the Comparison Workspace via
 * `ComparisonSourcesPanel` — once a search here resolves to a
 * comparison (curated or freshly built), that's how the user pulls in
 * Library/Knowledge-Layer material for it (brief §13/§14/§19/§20).
 */
export function ComparisonStudioPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResult, setSearchResult] = useState<UnifiedSearchResult>({ kind: 'empty' })
  const [searching, setSearching] = useState(false)
  const [savedTab, setSavedTab] = useState<SavedTab>('saved')
  const searchSeq = useRef(0)

  const savedRecords = useLiveQuery<SavedComparisonRecord[]>(
    () => db.savedComparisons.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  )
  const recentComparisons = useLiveQuery<RecentComparisonEntry[]>(() => getRecentComparisons(MAX_LANDING_RECENT), [], [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const seq = ++searchSeq.current
    if (!debouncedQuery.trim()) {
      setSearchResult({ kind: 'empty' })
      setSearching(false)
      return
    }
    setSearching(true)
    resolveComparisonSearch(debouncedQuery).then((result) => {
      if (searchSeq.current !== seq) return // a newer search superseded this one
      setSearchResult(result)
      setSearching(false)
    })
  }, [debouncedQuery])

  const featured = useMemo(() => pickFeatured(), [])

  const favorites = savedRecords.filter((r) => r.favorite)
  const custom = savedRecords.filter((r) => r.sourceType === 'custom')

  function openCurated(id: string) {
    navigate(`/comparison/${id}`)
  }

  function openSaved(record: SavedComparisonRecord) {
    const routeId = record.sourceType === 'curated' ? record.curatedComparisonId! : record.id
    navigate(`/comparison/${routeId}`)
  }

  function handleBuildFromEntities() {
    if (searchResult.kind !== 'entity-pair') return
    const domain = searchResult.itemA.suggestedDomain !== 'organism' ? searchResult.itemA.suggestedDomain : searchResult.itemB.suggestedDomain
    navigate(buildComparisonUrl(searchResult.itemA.item, searchResult.itemB.item, domain))
  }

  function handleCreateCustomFromQuery(rawQuery: string) {
    const params = new URLSearchParams({ itemAName: rawQuery })
    navigate(`/comparison/new?${params.toString()}`)
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-6">
        <h1 className="font-display text-display font-semibold text-ink-primary">Comparison Studio</h1>
        <p className="mt-2 max-w-2xl font-body text-body-lg text-ink-secondary">
          Put two things side by side and see exactly where they agree, where they diverge, and which difference actually matters.
        </p>
        <div className="mt-4">
          <Button icon={<Plus size={18} />} onClick={() => navigate('/comparison/new')}>
            New comparison
          </Button>
        </div>
      </header>

      {/* Search / Discovery — the gateway into Cellfie curated content, entity-based building, My Library, and Online Knowledge (brief §3/§8-13). */}
      <section className="mb-8">
        <div className="relative flex items-center rounded-md border-2 border-border-strong bg-surface focus-within:border-olive">
          <MagnifyingGlass className="pointer-events-none absolute left-4 text-ink-tertiary" size={20} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything to compare… e.g. Gram positive vs Gram negative"
            aria-label="Search anything to compare"
            className="w-full bg-transparent py-4 pl-12 pr-4 font-ui text-body-lg text-ink-primary placeholder:text-ink-tertiary outline-none"
          />
        </div>

        {debouncedQuery.trim() && (
          <div className="mt-3">
            {searching ? (
              <p className="font-ui text-caption text-ink-tertiary">Searching…</p>
            ) : (
              <SearchOutcome
                result={searchResult}
                onOpenCurated={openCurated}
                onBuildFromEntities={handleBuildFromEntities}
                onCreateCustom={() => handleCreateCustomFromQuery(debouncedQuery)}
              />
            )}
          </div>
        )}
      </section>

      {/* Recently visited — lightweight metadata only, never the full registry (brief §5/§29). */}
      {recentComparisons.length > 0 && (
        <section className="mb-8">
          <SectionHeading title="Recently visited" />
          <div className="flex flex-col gap-3">
            {recentComparisons.map((entry) => (
              <ComparisonCard
                key={entry.id}
                itemAName={entry.itemAName}
                itemBName={entry.itemBName}
                domain={entry.domain}
                onClick={() => navigate(`/comparison/${entry.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured comparisons — a small, stable sample, never the full catalog (brief §4/§27). */}
      <section className="mb-8">
        <SectionHeading title="Featured comparisons" />
        <div className="flex flex-col gap-3">
          {featured.map((c) => {
            const tagline = getComparisonTagline(c.id)
            return (
              <div key={c.id}>
                <ComparisonCard
                  itemAName={c.itemA.name}
                  itemBName={c.itemB.name}
                  domain={c.domain}
                  difficulty={c.difficulty}
                  frequency={c.frequency}
                  onClick={() => openCurated(c.id)}
                />
                {tagline && <p className="mt-1 px-1 font-body text-micro italic text-ink-tertiary">{tagline}</p>}
              </div>
            )
          })}
        </div>
      </section>

      {/* Explore by level / domain — compact chip rows, not a filter toolbar (brief §27/§28). */}
      <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <SectionHeading title="Explore by level" />
          <div className="flex flex-wrap gap-2">
            {COMPARISON_DIFFICULTY_ORDER.map((level) => (
              <ChipButton key={level} onClick={() => navigate(`/comparison/explore?difficulty=${level}`)}>
                {COMPARISON_DIFFICULTY_LABELS[level as ComparisonDifficulty]}
              </ChipButton>
            ))}
          </div>
        </div>
        <div>
          <SectionHeading title="Explore by domain" />
          <div className="flex flex-wrap gap-2">
            {domainsInUse().map((domain) => (
              <ChipButton key={domain} onClick={() => navigate(`/comparison/explore?domain=${domain}`)}>
                {COMPARISON_DOMAIN_LABELS[domain]}
              </ChipButton>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <button
          type="button"
          onClick={() => navigate('/comparison/explore')}
          className="inline-flex items-center gap-1 font-ui text-body font-medium text-olive hover:underline"
        >
          Explore all comparisons <CaretRight size={16} aria-hidden />
        </button>
      </section>

      {/* Saved / Favorites / My Comparisons — the user's own small set of records, not the curated catalog, so this stays here without reintroducing the "giant list" problem (brief §35: don't remove existing functionality). */}
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
    </div>
  )
}

function domainsInUse(): ComparisonDomain[] {
  const domains = new Set<ComparisonDomain>()
  for (const c of ALL_CURATED_COMPARISONS) domains.add(c.domain)
  return Array.from(domains)
}

function SectionHeading({ title }: { title: string }) {
  return <p className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</p>
}

function ChipButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border-strong bg-surface px-4 py-2 font-ui text-caption font-medium text-ink-primary hover:border-olive hover:text-olive"
    >
      {children}
    </button>
  )
}

/**
 * Renders whichever of the search result states applies (brief §33):
 * curated hits, an entity-pair with no curated match yet, or a
 * no-dead-end custom fallback. Never an empty page (brief §12/§33).
 */
function SearchOutcome({
  result,
  onOpenCurated,
  onBuildFromEntities,
  onCreateCustom
}: {
  result: UnifiedSearchResult
  onOpenCurated: (id: string) => void
  onBuildFromEntities: () => void
  onCreateCustom: () => void
}) {
  if (result.kind === 'curated') {
    return (
      <div className="flex flex-col gap-3">
        {result.hits.slice(0, 5).map((hit) => {
          const tagline = getComparisonTagline(hit.id)
          const [itemAName, itemBName] = hit.title.split(' vs ')
          return (
            <div key={hit.id}>
              <ComparisonCard
                itemAName={itemAName}
                itemBName={itemBName ?? ''}
                domain={hit.domain}
                difficulty={hit.difficulty}
                frequency={hit.frequency}
                onClick={() => onOpenCurated(hit.id)}
              />
              {tagline && <p className="mt-1 px-1 font-body text-micro italic text-ink-tertiary">{tagline}</p>}
            </div>
          )
        })}
      </div>
    )
  }

  if (result.kind === 'entity-pair') {
    return (
      <div className="rounded-md border border-border-strong bg-surface p-4">
        <p className="font-ui text-body text-ink-secondary">No curated comparison found for</p>
        <p className="mt-1 font-display text-h3 font-medium text-ink-primary">
          {result.itemA.item.name} <span className="text-ink-tertiary">vs</span> {result.itemB.item.name}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="small" onClick={onBuildFromEntities}>
            Build comparison
          </Button>
          <Button size="small" variant="secondary" onClick={onBuildFromEntities}>
            Search My Library
          </Button>
          <Button size="small" variant="secondary" onClick={onBuildFromEntities}>
            Search Online Knowledge
          </Button>
        </div>
        <p className="mt-2 font-ui text-caption text-ink-tertiary">
          Any of these opens the comparison workspace, where you can pull in your library or the Knowledge Layer per aspect.
        </p>
      </div>
    )
  }

  return (
    <EmptyState
      icon={<Scales size={28} />}
      title="No exact match"
      description="That pair isn't in the curated set yet, but you can still build it."
      action={
        <Button size="small" onClick={onCreateCustom}>
          Create custom comparison
        </Button>
      }
    />
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
            : 'Save a curated comparison, or star one to find it here faster.'
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
