import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NotePencil, DownloadSimple, PushPin, Highlighter, Bookmarks } from '@phosphor-icons/react'
import { EmptyState, Button, SearchField, Dropdown, Card, CardBody } from '@/shared/components'
import { useBreakpointClass, GRID_COLS_PRESETS } from '@/shared/hooks/useMediaQuery'
import { db, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { exportNotesAsMarkdown, exportJsonBackup } from '@/core/export'
import { NoteCard } from './components/NoteCard'
import { NoteEditorDialog } from './components/NoteEditorDialog'
import { FloatingStudyParticles } from './components/FloatingStudyParticles'

type Section = 'notes' | 'highlights' | 'bookmarks'
type SortOrder = 'recent' | 'edited' | 'title'
type GroupBy = 'none' | 'book' | 'subject'

/**
 * Study Vault subtitles (Final Polish brief §09) — one per section,
 * swapped instantly on tab change (plain state derived from the
 * existing `section` value below, no reload/refetch involved). Kept
 * short and Cellfie's usual "witty but doesn't undercut the science"
 * register (see core/laboratory/microcopy.ts for the house style this
 * matches), distinct per section so switching tabs is itself legible
 * even before reading the tab label.
 */
const SECTION_SUBTITLES: Record<Section, string> = {
  notes: 'Your brain dump, organized enough to actually reuse.',
  highlights: 'Proof that yellow ink counts as studying.',
  bookmarks: 'Digital dog-ears for the pages you still owe yourself.'
}

const sortOptions: { value: SortOrder; label: string }[] = [
  { value: 'edited', label: 'Recently edited' },
  { value: 'recent', label: 'Recently created' },
  { value: 'title', label: 'Title (A–Z)' }
]

const groupOptions: { value: GroupBy; label: string }[] = [
  { value: 'none', label: "Don't group" },
  { value: 'book', label: 'Grouped by book' },
  { value: 'subject', label: 'Grouped by subject' }
]

function SectionTabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'flex items-center gap-1.5 border-b-2 border-olive px-3 pb-2 font-ui text-ui font-medium text-ink-primary'
          : 'flex items-center gap-1.5 border-b-2 border-transparent px-3 pb-2 font-ui text-ui text-ink-tertiary hover:text-ink-secondary'
      }
    >
      {icon}
      {children}
    </button>
  )
}

/**
 * Study Vault (Final Polish brief §08-12) — Sprint 2 §3/§4/§5's Notebook,
 * renamed and re-scoped: this page now covers Notes, Highlights, AND
 * Bookmarks (see the navigation-correction note below), so a title that
 * only said "Notes" no longer described the whole page. "Study Vault" is
 * the umbrella; each section keeps its own name as a tab.
 *
 * Standalone + highlight-linked notes: search, tag/book/favorite
 * filters, three sort orders, optional grouping, and a pinned section
 * that always floats to the top regardless of grouping — pinning is
 * meant to win.
 *
 * Navigation correction: Highlights and Bookmarks used to be their own
 * top-level routes (`/highlights`, `/bookmarks`) reachable only from
 * Dashboard shortcut cards — they had no sidebar/bottom-nav entry of
 * their own, so once you left Dashboard there was no way back to them
 * except the browser back button. Both are saved-reading-artifact lists
 * that belong with Notes conceptually (things you kept while reading),
 * so they're now sections of this same page instead of separate
 * destinations — reachable the same way Notes always was, via the one
 * nav item, switched with the tabs below rather than a URL.
 * `?section=highlights`/`?section=bookmarks` still work as deep links
 * (Dashboard's shortcut cards use them) so existing links don't break.
 */
export function NotesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag')
  const section = (searchParams.get('section') as Section | null) ?? 'notes'

  function setSection(next: Section) {
    const params = new URLSearchParams(searchParams)
    if (next === 'notes') params.delete('section')
    else params.set('section', next)
    setSearchParams(params, { replace: true })
  }

  const notes = useLiveQuery<Note[]>(() => db.notes.toArray(), [], [])
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('edited')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [bookFilter, setBookFilter] = useState<string>('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined)
  const [exportBusy, setExportBusy] = useState(false)

  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  const bookFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All books' },
      ...items.filter((i) => notes.some((n) => n.itemId === i.id)).map((i) => ({ value: i.id, label: i.title }))
    ],
    [items, notes]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((note) => {
      if (tagFilter && !note.tags.includes(tagFilter.toLowerCase())) return false
      if (favoriteOnly && !note.favorite) return false
      if (bookFilter !== 'all' && note.itemId !== bookFilter) return false
      if (!q) return true
      return (
        note.title.toLowerCase().includes(q) ||
        note.contentMarkdown.toLowerCase().includes(q) ||
        note.tags.some((t) => t.includes(q))
      )
    })
  }, [notes, query, tagFilter, favoriteOnly, bookFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    switch (sortOrder) {
      case 'title':
        return list.sort((a, b) => a.title.localeCompare(b.title))
      case 'recent':
        return list.sort((a, b) => b.createdAt - a.createdAt)
      case 'edited':
      default:
        return list.sort((a, b) => b.updatedAt - a.updatedAt)
    }
  }, [filtered, sortOrder])

  const pinned = sorted.filter((n) => n.pinned)
  const unpinned = sorted.filter((n) => !n.pinned)

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null as string | null, notes: unpinned }]
    if (groupBy === 'book') {
      const byBook = new Map<string, Note[]>()
      for (const note of unpinned) {
        const key = note.itemId ? itemsById.get(note.itemId)?.title ?? 'Unknown book' : 'Not linked to a book'
        byBook.set(key, [...(byBook.get(key) ?? []), note])
      }
      return Array.from(byBook.entries()).map(([label, ns]) => ({ label, notes: ns }))
    }
    // subject: groups by each note's first tag — the Subjects Registry
    // (config/subjects.registry.ts) is unseeded in this build, so tags
    // are the closest thing to "subject" the data actually carries.
    const bySubject = new Map<string, Note[]>()
    for (const note of unpinned) {
      const key = note.tags[0] ? `#${note.tags[0]}` : 'Untagged'
      bySubject.set(key, [...(bySubject.get(key) ?? []), note])
    }
    return Array.from(bySubject.entries()).map(([label, ns]) => ({ label, notes: ns }))
  }, [groupBy, unpinned, itemsById])

  function openNew() {
    setEditingNote(undefined)
    setEditorOpen(true)
  }
  function openEdit(note: Note) {
    setEditingNote(note)
    setEditorOpen(true)
  }

  async function handleExport(format: 'markdown' | 'json') {
    setExportBusy(true)
    try {
      if (format === 'markdown') await exportNotesAsMarkdown(sorted.length ? sorted : undefined)
      else await exportJsonBackup()
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="relative mx-auto max-w-content overflow-hidden px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <FloatingStudyParticles />

      <div className="relative z-10">
      <header className="mb-6">
        <h1 className="font-display text-display font-semibold text-ink-primary">Study Vault</h1>
        <p className="mt-1 font-body text-body-lg text-ink-secondary">
          Everything you write — and everything you kept while reading — stays linked back to where you learned it.
        </p>
        {/* Final Polish brief §09: swaps immediately with `section`, no reload. */}
        <p className="mt-1 font-ui text-caption italic text-ink-tertiary" key={section}>
          {SECTION_SUBTITLES[section]}
        </p>
      </header>

      <div className="mb-8 flex gap-1 border-b border-border">
        <SectionTabButton active={section === 'notes'} onClick={() => setSection('notes')} icon={<NotePencil size={16} aria-hidden />}>
          Notes
        </SectionTabButton>
        <SectionTabButton active={section === 'highlights'} onClick={() => setSection('highlights')} icon={<Highlighter size={16} aria-hidden />}>
          Highlights
        </SectionTabButton>
        <SectionTabButton active={section === 'bookmarks'} onClick={() => setSection('bookmarks')} icon={<Bookmarks size={16} aria-hidden />}>
          Bookmarks
        </SectionTabButton>
      </div>

      {section === 'notes' && (
        <>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <SearchField placeholder="Search notes…" onChange={setQuery} className="min-w-[240px] flex-1" />
              <Dropdown label="Sort" options={sortOptions} value={sortOrder} onChange={(v) => setSortOrder(v as SortOrder)} />
              <Dropdown label="Group" options={groupOptions} value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} />
              {bookFilterOptions.length > 1 && (
                <Dropdown label="Book" options={bookFilterOptions} value={bookFilter} onChange={setBookFilter} />
              )}
              <button
                type="button"
                aria-pressed={favoriteOnly}
                onClick={() => setFavoriteOnly((f) => !f)}
                className="flex h-[52px] items-center gap-2 rounded-sm border border-border px-4 font-ui text-ui font-medium text-ink-secondary transition-colors duration-micro hover:bg-surface-raised data-[active=true]:border-terracotta data-[active=true]:text-ink-primary"
                data-active={favoriteOnly}
              >
                Favorites only
              </button>
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams)
                    params.delete('tag')
                    setSearchParams(params)
                  }}
                  className="flex h-[52px] items-center gap-2 rounded-sm border border-terracotta bg-surface-raised px-4 font-ui text-ui font-medium text-ink-primary"
                >
                  #{tagFilter} ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" icon={<DownloadSimple size={18} />} disabled={exportBusy || notes.length === 0} onClick={() => void handleExport('markdown')}>
                Export Markdown
              </Button>
              <Button variant="secondary" icon={<DownloadSimple size={18} />} disabled={exportBusy} onClick={() => void handleExport('json')}>
                Export JSON
              </Button>
              <Button icon={<NotePencil size={18} />} onClick={openNew}>
                New note
              </Button>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-6">
              <EmptyState
                icon={<NotePencil size={32} />}
                title="No notes yet"
                description="Use Quick Capture (bottom right, or press N) to jot your first note. Highlight text in the reader to attach one to a passage."
                action={<Button variant="secondary" onClick={openNew}>Write a note</Button>}
              />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-6">
              <EmptyState title="Nothing matches" description="Try a different search, or clear your filters." />
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {pinned.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    <PushPin size={14} weight="fill" />
                    Pinned
                  </h2>
                  <div className={`grid gap-4 ${gridColsClass}`}>
                    {pinned.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        linkedBookTitle={note.itemId ? itemsById.get(note.itemId)?.title : undefined}
                        onOpen={() => openEdit(note)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {groups.map((group, i) => (
                <section key={group.label ?? i}>
                  {group.label && (
                    <h2 className="mb-4 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{group.label}</h2>
                  )}
                  <div className={`grid gap-4 ${gridColsClass}`}>
                    {group.notes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        linkedBookTitle={note.itemId ? itemsById.get(note.itemId)?.title : undefined}
                        onOpen={() => openEdit(note)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <NoteEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} note={editingNote} />
        </>
      )}

      {section === 'highlights' && <HighlightsSection navigate={navigate} />}
      {section === 'bookmarks' && <BookmarksSection navigate={navigate} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Highlights section (formerly the standalone /highlights route)
// ---------------------------------------------------------------------------

function HighlightsSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [query, setQuery] = useState('')
  const highlights = useLiveQuery<Highlight[]>(() => db.highlights.toArray(), [], [])
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return highlights
    return highlights.filter((h) => (h.text || '').toLowerCase().includes(q) || (h.note || '').toLowerCase().includes(q))
  }, [highlights, query])

  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <div>
      <div className="mb-6">
        <SearchField placeholder="Search highlights…" onChange={setQuery} className="max-w-md" />
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
        <div className={`grid gap-4 ${gridColsClass}`}>
          {filtered.map((h) => {
            const book = itemsById.get(h.itemId)
            return (
              <Card key={h.id} className="cursor-pointer transition-colors hover:border-olive" onClick={() => navigate(`/library/${h.itemId}/read`)}>
                <CardBody className="flex flex-col gap-3">
                  <p className="border-l-2 border-olive pl-3 font-body text-body italic text-ink-primary">"{h.text || 'Highlighted text'}"</p>
                  {h.note && <p className="rounded-sm bg-surface-raised p-2 font-body text-caption text-ink-secondary">{h.note}</p>}
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

// ---------------------------------------------------------------------------
// Bookmarks section (formerly the standalone /bookmarks route)
// ---------------------------------------------------------------------------

function BookmarksSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
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

  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwoThree)

  return (
    <div>
      <div className="mb-6">
        <SearchField placeholder="Search bookmarks…" onChange={setQuery} className="max-w-md" />
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
        <div className={`grid gap-4 ${gridColsClass}`}>
          {filtered.map((b) => {
            const book = itemsById.get(b.itemId)
            return (
              <Card key={b.id} className="cursor-pointer transition-colors hover:border-olive" onClick={() => navigate(`/library/${b.itemId}/read`)}>
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

