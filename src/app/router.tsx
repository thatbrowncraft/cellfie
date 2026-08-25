import { lazy, Suspense, useMemo, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Bookmarks, Highlighter } from '@phosphor-icons/react'
import { AppShell } from './AppShell'
import { DashboardPage } from '../modules/dashboard/DashboardPage'
import { NotFoundPage } from '../modules/not-found/NotFoundPage'
import { db, type Highlight, type LibraryItem, type ReaderBookmark } from '../core/db'
import { useLiveQuery } from '../core/db/useLiveQuery'
import { Card, CardBody, EmptyState, SearchField, SkeletonCard } from '../shared/components'
import { LoadingLayout } from '../shared/layouts'

/**
 * Route-level code splitting (bundle-size remediation, stage 1).
 *
 * These are the feature areas that pull in the heaviest content/logic —
 * most importantly Organism Explorer/Detail and the Laboratory pages,
 * which sit on top of the large `core/organisms` and `core/laboratory`
 * content registries (see those files' doc comments). Splitting them
 * into their own chunks means a visit to, say, `/notes` no longer has
 * to download and parse that content up front.
 *
 * `DashboardPage` (the default route) and the small in-file
 * Highlights/Bookmarks pages stay eagerly imported since they're what
 * renders on first paint anyway — lazy-loading those would only add an
 * extra Suspense flash with no bundle-size benefit.
 *
 * Named exports are wrapped with `.then(m => ({ default: m.X }))` so the
 * page components themselves don't need to change to default exports.
 */
const LibraryPage = lazy(() => import('../modules/library/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const ReaderPage = lazy(() =>
  import('../modules/library/reader/ReaderPage').then((m) => ({ default: m.ReaderPage }))
)
const ConceptsPage = lazy(() =>
  import('../modules/concepts/ConceptsPage').then((m) => ({ default: m.ConceptsPage }))
)
const ConceptDetailPage = lazy(() =>
  import('../modules/concepts/ConceptDetailPage').then((m) => ({ default: m.ConceptDetailPage }))
)
const OrganismExplorerPage = lazy(() =>
  import('../modules/organism-explorer/OrganismExplorerPage').then((m) => ({ default: m.OrganismExplorerPage }))
)
const OrganismDetailPage = lazy(() =>
  import('../modules/organism-explorer/OrganismDetailPage').then((m) => ({ default: m.OrganismDetailPage }))
)
const LaboratoryPage = lazy(() =>
  import('../modules/laboratory/LaboratoryPage').then((m) => ({ default: m.LaboratoryPage }))
)
const LaboratoryDetailPage = lazy(() =>
  import('../modules/laboratory/LaboratoryDetailPage').then((m) => ({ default: m.LaboratoryDetailPage }))
)
const ClinicalLaboratoryPage = lazy(() =>
  import('../modules/laboratory/ClinicalLaboratoryPage').then((m) => ({ default: m.ClinicalLaboratoryPage }))
)
const ClinicalDetailPage = lazy(() =>
  import('../modules/laboratory/ClinicalDetailPage').then((m) => ({ default: m.ClinicalDetailPage }))
)
const CalculatorDetailPage = lazy(() =>
  import('../modules/laboratory/CalculatorDetailPage').then((m) => ({ default: m.CalculatorDetailPage }))
)
const UnitConverterPage = lazy(() =>
  import('../modules/laboratory/UnitConverterPage').then((m) => ({ default: m.UnitConverterPage }))
)
const ComparisonStudioPage = lazy(() =>
  import('../modules/comparison-studio/ComparisonStudioPage').then((m) => ({ default: m.ComparisonStudioPage }))
)
const NewComparisonPage = lazy(() =>
  import('../modules/comparison-studio/NewComparisonPage').then((m) => ({ default: m.NewComparisonPage }))
)
const ComparisonWorkspacePage = lazy(() =>
  import('../modules/comparison-studio/ComparisonWorkspacePage').then((m) => ({ default: m.ComparisonWorkspacePage }))
)
const NotesPage = lazy(() => import('../modules/notes/NotesPage').then((m) => ({ default: m.NotesPage })))
const SettingsPage = lazy(() =>
  import('../modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

function RouteFallback() {
  return (
    <LoadingLayout>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </LoadingLayout>
  )
}

function HighlightsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const highlights = useLiveQuery<Highlight[]>(() => db.highlights.toArray(), [], [])
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return highlights
    return highlights.filter((h) =>
      (h.text || '').toLowerCase().includes(q) ||
      (h.note || '').toLowerCase().includes(q)
    )
  }, [highlights, query])

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">Highlights</h1>
        <p className="mt-2 font-body text-body-lg text-ink-secondary">
          All your saved key passages and highlighted text across your books.
        </p>
      </header>

      <div className="mb-6">
        <SearchField placeholder="Search highlights..." onChange={setQuery} className="max-w-md" />
      </div>

      {highlights.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<Highlighter size={32} />}
            title="No highlights yet"
            description="Open a book in your library and highlight any passage to save it here."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <EmptyState title="Nothing matches" description="Try a different search term." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => {
            const book = itemsById.get(h.itemId)
            return (
              <Card
                key={h.id}
                className="cursor-pointer transition-colors hover:border-olive"
                onClick={() => navigate(`/library/${h.itemId}/read`)}
              >
                <CardBody className="flex flex-col gap-3">
                  <p className="border-l-2 border-olive pl-3 font-body text-body italic text-ink-primary">
                    "{h.text || 'Highlighted text'}"
                  </p>
                  {h.note && (
                    <p className="rounded-sm bg-surface-raised p-2 font-body text-caption text-ink-secondary">
                      {h.note}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-micro text-ink-tertiary">
                    <span className="truncate">{book ? book.title : 'Unknown book'}</span>
                    {h.page && <span>Page {h.page}</span>}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BookmarksPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const bookmarks = useLiveQuery<ReaderBookmark[]>(() => db.readerBookmarks.toArray(), [], [])
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bookmarks
    return bookmarks.filter((b) => {
      const book = itemsById.get(b.itemId)
      return book && book.title.toLowerCase().includes(q)
    })
  }, [bookmarks, query, itemsById])

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">Bookmarks</h1>
        <p className="mt-2 font-body text-body-lg text-ink-secondary">
          All your saved bookmarks and reading location markers.
        </p>
      </header>

      <div className="mb-6">
        <SearchField placeholder="Search bookmarks..." onChange={setQuery} className="max-w-md" />
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<Bookmarks size={32} />}
            title="No bookmarks yet"
            description="Bookmark pages in the reader to quickly jump back to them anytime."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6">
          <EmptyState title="Nothing matches" description="Try a different search term." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => {
            const book = itemsById.get(b.itemId)
            return (
              <Card
                key={b.id}
                className="cursor-pointer transition-colors hover:border-olive"
                onClick={() => navigate(`/library/${b.itemId}/read`)}
              >
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-display text-h3 font-semibold text-olive">
                    <Bookmarks size={20} />
                    <span className="truncate">{b.page ? `Page ${b.page}` : 'Bookmark'}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-micro text-ink-tertiary">
                    <span className="truncate">{book ? book.title : 'Unknown book'}</span>
                    {b.page && <span>Page {b.page}</span>}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AppRouter() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id/read" element={<ReaderPage />} />
          <Route path="/concepts" element={<ConceptsPage />} />
          <Route path="/concepts/:id" element={<ConceptDetailPage />} />
          <Route path="/organisms" element={<OrganismExplorerPage />} />
          <Route path="/organisms/:organismId" element={<OrganismDetailPage />} />
          <Route path="/laboratory" element={<LaboratoryPage />} />
          <Route path="/laboratory/unit-converter" element={<UnitConverterPage />} />
          <Route path="/laboratory/calculators/:calculatorId" element={<CalculatorDetailPage />} />
          <Route path="/laboratory/clinical" element={<ClinicalLaboratoryPage />} />
          <Route path="/laboratory/clinical/:category/:id" element={<ClinicalDetailPage />} />
          <Route path="/laboratory/:category/:id" element={<LaboratoryDetailPage />} />
          <Route path="/comparison" element={<ComparisonStudioPage />} />
          <Route path="/comparison/new" element={<NewComparisonPage />} />
          <Route path="/comparison/:id" element={<ComparisonWorkspacePage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
