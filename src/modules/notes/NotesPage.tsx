import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NotePencil, DownloadSimple, PushPin } from '@phosphor-icons/react'
import { EmptyState, Button, SearchField, Dropdown } from '@/shared/components'
import { db, type LibraryItem, type Note } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { exportNotesAsMarkdown, exportJsonBackup } from '@/core/export'
import { NoteCard } from './components/NoteCard'
import { NoteEditorDialog } from './components/NoteEditorDialog'

type SortOrder = 'recent' | 'edited' | 'title'
type GroupBy = 'none' | 'book' | 'subject'

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

/**
 * Notes — Sprint 2 §3/§4/§5, the Notebook. Standalone + highlight-linked
 * notes in one place: search, tag/book/favorite filters, three sort
 * orders, optional grouping, and a pinned section that always floats to
 * the top regardless of grouping — pinning is meant to win.
 */
export function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag')

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
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display font-semibold text-ink-primary">Notes</h1>
          <p className="mt-2 font-body text-body-lg text-ink-secondary">
            Everything you write stays linked back to where you learned it.
          </p>
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
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-4">
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
            onClick={() => setSearchParams({})}
            className="flex h-[52px] items-center gap-2 rounded-sm border border-terracotta bg-surface-raised px-4 font-ui text-ui font-medium text-ink-primary"
          >
            #{tagFilter} ✕
          </button>
        )}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  )
}
