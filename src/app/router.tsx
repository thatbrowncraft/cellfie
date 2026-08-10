import { useMemo, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Bookmarks, Highlighter } from '@phosphor-icons/react'
import { AppShell } from './AppShell'
import { DashboardPage } from '../modules/dashboard/DashboardPage'
import { LibraryPage } from '../modules/library/LibraryPage'
import { ReaderPage } from '../modules/library/reader/ReaderPage'
import { ConceptsPage } from '../modules/concepts/ConceptsPage'
import { ConceptDetailPage } from '../modules/concepts/ConceptDetailPage'
import { OrganismExplorerPage } from '../modules/organism-explorer/OrganismExplorerPage'
import { LaboratoryPage } from '../modules/laboratory/LaboratoryPage'
import { ComparisonStudioPage } from '../modules/comparison-studio/ComparisonStudioPage'
import { NotesPage } from '../modules/notes/NotesPage'
import { SettingsPage } from '../modules/settings/SettingsPage'
import { NotFoundPage } from '../modules/not-found/NotFoundPage'
import { db, type Highlight, type LibraryItem, type ReaderBookmark } from '../core/db'
import { useLiveQuery } from '../core/db/useLiveQuery'
import { Card, CardBody, EmptyState, SearchField } from '../shared/components'

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
      (h.text || h.quote || '').toLowerCase().includes(q) ||
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
            const textContent = h.text || h.quote || 'Highlighted text'
            return (
              <Card
                key={h.id}
                className="cursor-pointer transition-colors hover:border-olive"
                onClick={() => navigate(`/library/${h.itemId}/read`)}
              >
                <CardBody className="flex flex-col gap-3">
                  <p className="border-l-2 border-olive pl-3 font-body text-body italic text-ink-primary">
                    "{textContent}"
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
      const title = b.title || b.label || ''
      return (
        title.toLowerCase().includes(q) ||
        (book && book.title.toLowerCase().includes(q))
      )
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
            const pageNum = b.pageNumber ?? b.page
            const displayTitle = b.title || b.label || (pageNum ? `Page ${pageNum}` : 'Bookmark')
            return (
              <Card
                key={b.id}
                className="cursor-pointer transition-colors hover:border-olive"
                onClick={() => navigate(`/library/${b.itemId}/read`)}
              >
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-display text-h3 font-semibold text-olive">
                    <Bookmarks size={20} />
                    <span className="truncate">{displayTitle}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-micro text-ink-tertiary">
                    <span className="truncate">{book ? book.title : 'Unknown book'}</span>
                    {pageNum && <span>Page {pageNum}</span>}
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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/:id/read" element={<ReaderPage />} />
        <Route path="/concepts" element={<ConceptsPage />} />
        <Route path="/concepts/:id" element={<ConceptDetailPage />} />
        <Route path="/organisms" element={<OrganismExplorerPage />} />
        <Route path="/laboratory" element={<LaboratoryPage />} />
        <Route path="/comparison" element={<ComparisonStudioPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/highlights" element={<HighlightsPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
