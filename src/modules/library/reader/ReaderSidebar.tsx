import { Bookmark, Trash } from '@phosphor-icons/react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Tabs } from '@/shared/components'
import type { ReaderBookmark } from '@/core/db'
import { ReaderThumbnail } from './ReaderThumbnail'

interface ReaderSidebarProps {
  doc: PDFDocumentProxy
  numPages: number
  currentPage: number
  onSelectPage: (page: number) => void
  bookmarks: ReaderBookmark[]
  onRemoveBookmark: (id: string) => void
}

/** Tabbed Pages/Bookmarks panel shown beside (desktop) or below (mobile) the reader. */
export function ReaderSidebar({
  doc,
  numPages,
  currentPage,
  onSelectPage,
  bookmarks,
  onRemoveBookmark
}: ReaderSidebarProps) {
  return (
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
          id: 'bookmarks',
          label: `Bookmarks${bookmarks.length ? ` (${bookmarks.length})` : ''}`,
          content:
            bookmarks.length === 0 ? (
              <p className="font-ui text-caption text-ink-tertiary">
                No bookmarks yet. Use the bookmark button in the toolbar to save the current page.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {bookmarks.map((bookmark) => (
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
  )
}
