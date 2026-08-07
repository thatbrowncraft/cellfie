import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, type LibraryItem, type ReaderBookmark } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { markOpened, updateReadingProgress } from '@/core/db/library'
import { addBookmark, removeBookmark } from '@/core/db/bookmarks'
import { SplitLayout } from '@/shared/layouts'
import { BottomSheet, EmptyState } from '@/shared/components'
import { useBreakpoint } from '@/shared/hooks'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { ReaderToolbar } from './ReaderToolbar'
import { ReaderCanvas, type FitMode } from './ReaderCanvas'
import { ReaderSidebar } from './ReaderSidebar'

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_STEP = 1.2

/**
 * Personal Library Module — PDF Reader milestone. Full-featured reader for
 * a single LibraryItem: paged canvas view, jump-to-page, zoom + fit
 * width/page, sidebar thumbnails, locally-stored bookmarks, reading
 * progress, and "remember last opened page" — all backed by IndexedDB
 * (Dexie) and the existing OPFS file store, no network involved.
 */
export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'

  const item = useLiveQuery<LibraryItem | undefined>(
    () => (id ? db.libraryItems.get(id) : undefined),
    [id],
    undefined
  )
  const bookmarks = useLiveQuery<ReaderBookmark[]>(
    () => (id ? db.readerBookmarks.where('itemId').equals(id).sortBy('page') : []),
    [id],
    []
  )

  const { doc, numPages, loading, error } = usePdfDocument(item?.filePath)

  const [page, setPage] = useState(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [scale, setScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  const initializedRef = useRef(false)

  // Resume from the item's saved page (or 1) the first time it loads, and
  // record that it was opened. Guarded so it only runs once per mount,
  // not on every subsequent live-query update to `item`.
  useEffect(() => {
    if (item && !initializedRef.current) {
      initializedRef.current = true
      setPage(item.lastPageRead && item.lastPageRead >= 1 ? item.lastPageRead : 1)
      void markOpened(item.id)
    }
  }, [item])

  // Keep the current page within bounds once the document reports its length.
  useEffect(() => {
    if (numPages && page > numPages) setPage(numPages)
  }, [numPages, page])

  // Persist reading progress as the page changes (short debounce so rapid
  // prev/next clicks don't spam writes).
  useEffect(() => {
    if (!item) return
    const timeout = setTimeout(() => void updateReadingProgress(item.id, page), 400)
    return () => clearTimeout(timeout)
  }, [item, page])

  // Default the panel open/closed based on viewport whenever the
  // breakpoint itself changes (e.g. rotating a tablet).
  useEffect(() => {
    setSidebarOpen(!isMobile)
  }, [isMobile])

  if (!id) return null

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))
  }
  function jumpTo(target: number) {
    if (!numPages) return
    setPage(Math.min(Math.max(1, target), numPages))
  }
  function zoomIn() {
    setFitMode('custom')
    setScale((s) => Math.min(s * ZOOM_STEP, MAX_SCALE))
  }
  function zoomOut() {
    setFitMode('custom')
    setScale((s) => Math.max(s / ZOOM_STEP, MIN_SCALE))
  }

  const currentBookmark = bookmarks.find((b) => b.page === page)

  async function toggleBookmark() {
    if (!item) return
    if (currentBookmark) {
      await removeBookmark(currentBookmark.id)
    } else {
      await addBookmark(item.id, page)
    }
  }

  function handleSelectPage(target: number) {
    jumpTo(target)
    if (isMobile) setSidebarOpen(false)
  }

  const sidebar =
    doc && numPages ? (
      <ReaderSidebar
        doc={doc}
        numPages={numPages}
        currentPage={page}
        onSelectPage={handleSelectPage}
        bookmarks={bookmarks}
        onRemoveBookmark={(bid) => void removeBookmark(bid)}
      />
    ) : null

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <ReaderToolbar
        title={item?.title ?? 'Loading…'}
        currentPage={page}
        numPages={numPages ?? 0}
        onPrev={goPrev}
        onNext={goNext}
        onJump={jumpTo}
        scale={scale}
        fitMode={fitMode}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitWidth={() => setFitMode('width')}
        onFitPage={() => setFitMode('page')}
        onBack={() => navigate('/library')}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        sidebarOpen={sidebarOpen}
        bookmarked={Boolean(currentBookmark)}
        onToggleBookmark={() => void toggleBookmark()}
      />

      <div className="min-h-0 flex-1">
        {error && (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              title="Couldn't open this PDF"
              description="The file may be missing or the import may not have finished. Try removing and re-importing it from the Library."
            />
          </div>
        )}

        {!error && (loading || !doc || !numPages) && (
          <div className="flex h-full items-center justify-center">
            <p className="font-ui text-caption text-ink-tertiary">Loading document…</p>
          </div>
        )}

        {!error && doc && numPages ? (
          isMobile ? (
            <>
              <ReaderCanvas doc={doc} pageNumber={page} fitMode={fitMode} scale={scale} onScaleChange={setScale} />
              <BottomSheet open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Pages & bookmarks">
                {sidebar}
              </BottomSheet>
            </>
          ) : sidebarOpen ? (
            <SplitLayout
              className="h-full"
              primaryWidth="75%"
              primary={<ReaderCanvas doc={doc} pageNumber={page} fitMode={fitMode} scale={scale} onScaleChange={setScale} />}
              secondary={<div className="h-full overflow-y-auto p-4">{sidebar}</div>}
            />
          ) : (
            <ReaderCanvas doc={doc} pageNumber={page} fitMode={fitMode} scale={scale} onScaleChange={setScale} />
          )
        ) : null}
      </div>
    </div>
  )
}
