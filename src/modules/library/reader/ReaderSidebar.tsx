import { useMemo, useState } from 'react'
import { Bookmark, Trash } from '@phosphor-icons/react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Tabs, SearchField } from '@/shared/components'
import { markerColorVar } from './HighlightsLayer'
import type { Highlight, Note, ReaderBookmark } from '@/core/db'
import { searchWithinBook } from '@/core/search'
import { ReaderThumbnail } from './ReaderThumbnail'
import { ReaderNoteList } from './ReaderNoteList'

interface ReaderSidebarProps {
  doc: PDFDocumentProxy
  numPages: number
  currentPage: number
  onSelectPage: (page: number) => void
  bookmarks: ReaderBookmark[]
  onRemoveBookmark: (id: string) => void
  highlights: Highlight[]
  onSelectHighlightFromList: (highlight: Highlight) => void
  onRemoveHighlight: (id: string) => void
  notes: Note[]
  onOpenNote: (note: Note) => void
}

/** Tabbed Pages/Highlights/Notes/Bookmarks panel shown beside (desktop) or below (mobile) the reader, plus in-book search (Sprint 2 §6/§7). */
export function ReaderSidebar({
  doc,
  numPages,
  currentPage,
  onSelectPage,
  bookmarks,
  onRemoveBookmark,
  highlights,
  onSelectHighlightFromList,
  onRemoveHighlight,
  notes,
  onOpenNote
}: ReaderSidebarProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => searchWithinBook(query, highlights, notes, bookmarks),
    [query, highlights, notes, bookmarks]
  )

  return (
    <div className="flex flex-col gap-3">
      <SearchField placeholder="Search this book…" onChange={setQuery} />
      <Tabs
        tabs={[
          {
            id: 'pages',
            label: 'Pages',
            content: (
              <div className="flex flex-col gap-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
                  <ReaderThumbnail
                    key={pageNumber}
                    doc={doc}
                    pageNumber={pageNumber}
                    active={pageNumber === currentPage}
                    onSelect={onSelectPage}
                  />
                ))}
              </div>
            )
          },
          {
            id: 'highlights',
            label: `Highlights${highlights.length ? ` (${highlights.length})` : ''}`,
            content:
              filtered.highlights.length === 0 ? (
                <p className="font-ui text-caption text-ink-tertiary">
                  {highlights.length === 0
                    ? 'No highlights yet. Select any text in the document to mark it.'
                    : 'Nothing matches your search.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {filtered.highlights.map((h) => (
                    <li key={h.id} className="group flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-surface-raised">
                      <button
                        type="button"
                        onClick={() => onSelectHighlightFromList(h)}
                        className="flex flex-1 items-start gap-2 text-left"
                      >
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(${markerColorVar[h.color]})` }}
                          aria-hidden
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-ui text-caption text-ink-primary">
                            "{h.text.trim().slice(0, 100)}"
                          </span>
                          <span className="font-ui text-micro text-ink-tertiary">
                            Page {h.page}
                            {h.note ? ' · has a note' : ''}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveHighlight(h.id)}
                        aria-label="Delete highlight"
                        className="shrink-0 rounded-sm p-1 text-ink-tertiary opacity-0 group-hover:opacity-100 hover:text-error"
                      >
                        <Trash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )
          },
          {
            id: 'notes',
            label: `Notes${notes.length ? ` (${notes.length})` : ''}`,
            content: <ReaderNoteList notes={filtered.notes} onOpen={onOpenNote} />
          },
          {
            id: 'bookmarks',
            label: `Bookmarks${bookmarks.length ? ` (${bookmarks.length})` : ''}`,
            content:
              filtered.bookmarks.length === 0 ? (
                <p className="font-ui text-caption text-ink-tertiary">
                  {bookmarks.length === 0
                    ? 'No bookmarks yet. Use the bookmark button in the toolbar to save the current page.'
                    : 'Nothing matches your search.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {filtered.bookmarks.map((bookmark) => (
                    <li
                      key={bookmark.id}
                      className="flex items-center justify-between gap-2 rounded-sm px-2 py-2 hover:bg-surface-raised"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPage(bookmark.page)}
                        className="flex items-center gap-2 font-ui text-ui text-ink-primary"
                      >
                        <Bookmark size={16} weight="fill" className="text-terracotta" aria-hidden />
                        Page {bookmark.page}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveBookmark(bookmark.id)}
                        aria-label={`Remove bookmark on page ${bookmark.page}`}
                        className="rounded-sm p-1 text-ink-tertiary hover:text-error"
                      >
                        <Trash size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )
          }
        ]}
      />
    </div>
  )
}
