import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db, type Highlight, type HighlightColor, type HighlightRect, type LibraryItem, type Note, type ReaderBookmark } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { markOpened, updateReadingProgress } from '@/core/db/library'
import { addBookmark, removeBookmark } from '@/core/db/bookmarks'
import { addHighlight, removeHighlight, updateHighlightColor, updateHighlightNote } from '@/core/db/highlights'
import { createNoteFromHighlight } from '@/core/db/notes'
import { addReadingSeconds } from '@/core/db/reading-time'
import { SplitLayout } from '@/shared/layouts'
import { BottomSheet, EmptyState } from '@/shared/components'
import { useBreakpoint } from '@/shared/hooks'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { ReaderToolbar } from './ReaderToolbar'
import { ReaderCanvas, type FitMode, type ReaderCanvasHandle } from './ReaderCanvas'
import { ReaderSidebar } from './ReaderSidebar'
import { HighlightPopover, type PopoverAnchor } from './HighlightPopover'
import { NoteEditorDialog } from '@/modules/notes/components/NoteEditorDialog'

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_STEP = 1.2
// How often accumulated reading time is flushed to appSettings while a book is open (Sprint 2 §9).
const READING_TIME_FLUSH_MS = 30_000

/**
 * Personal Library Module — PDF Reader milestone, extended in Sprint 2
 * (Study Companion milestone) with Text Highlighting (§1), Sticky Notes
 * (§2), Linked Notes (§5), the Highlights/Notes sidebar tabs (§6), and
 * in-book search. Full-featured reader for a single LibraryItem: paged
 * canvas view, jump-to-page, zoom + fit width/page, sidebar thumbnails,
 * locally-stored bookmarks/highlights/notes, and reading progress — all
 * backed by IndexedDB (Dexie) and the existing OPFS file store, no
 * network involved.
 */
export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const highlights = useLiveQuery<Highlight[]>(
    () => (id ? db.highlights.where('itemId').equals(id).sortBy('page') : []),
    [id],
    []
  )
  const notes = useLiveQuery<Note[]>(
    () => (id ? db.notes.where('itemId').equals(id).sortBy('updatedAt') : []),
    [id],
    []
  )

  const { doc, numPages, loading, error } = usePdfDocument(item?.filePath)

  const [page, setPage] = useState(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [scale, setScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  // Sprint 2 §1/§2: exactly one of these is ever open at a time — a
  // fresh-selection color picker, or an existing highlight's edit panel.
  const [pendingSelection, setPendingSelection] = useState<{ text: string; rects: HighlightRect[]; anchor: PopoverAnchor } | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<{ highlight: Highlight; anchor: PopoverAnchor } | null>(null)

  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined)

  // Bug 1 fix: lets the toolbar's Highlight button reach into the current
  // page's TextLayer to finalize whatever selection exists, and tracks
  // whether that button should be enabled.
  const canvasRef = useRef<ReaderCanvasHandle>(null)
  const [hasTextSelection, setHasTextSelection] = useState(false)

  const initializedRef = useRef(false)

  // Resume from the item's saved page (or 1) the first time it loads —
  // unless a `?page=` query param is present, which takes priority (that's
  // how search results, notes, and highlights deep-link into a page).
  useEffect(() => {
    if (item && !initializedRef.current) {
      initializedRef.current = true
      const pageParam = Number(searchParams.get('page'))
      const target = pageParam > 0 ? pageParam : item.lastPageRead && item.lastPageRead >= 1 ? item.lastPageRead : 1
      setPage(target)
      void markOpened(item.id)
    }
  }, [item, searchParams])

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

  // Sprint 2 §9 (optional): accrue reading time in the background while
  // this book is open, flushing periodically so a crash/close never loses
  // more than one interval's worth. Pauses while the tab is hidden.
  useEffect(() => {
    if (!item) return
    let accumulated = 0
    let lastTick = Date.now()
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') {
        accumulated += (Date.now() - lastTick) / 1000
      }
      lastTick = Date.now()
    }, 1000)
    const flush = setInterval(() => {
      if (accumulated > 0) {
        void addReadingSeconds(accumulated)
        accumulated = 0
      }
    }, READING_TIME_FLUSH_MS)
    return () => {
      clearInterval(tick)
      clearInterval(flush)
      if (accumulated > 0) void addReadingSeconds(accumulated)
    }
  }, [item])

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
    setPendingSelection(null)
    setActiveHighlight(null)
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

  // --- Highlighting (Sprint 2 §1/§2) ---------------------------------

  function handleSelectionFinalize(text: string, rects: HighlightRect[], anchor: PopoverAnchor) {
    setActiveHighlight(null)
    setPendingSelection({ text, rects, anchor })
  }

  // Bug 1 fix: the toolbar's explicit Highlight button — reads whatever
  // selection currently exists on the page via the same TextLayer
  // conversion mouseup/touchend use, so there's still exactly one
  // highlighting code path (just three ways to trigger it).
  function handleHighlightButtonClick() {
    canvasRef.current?.finalizeSelection()
  }

  async function handlePickColorForNewSelection(color: HighlightColor) {
    if (!id || !pendingSelection) return
    await addHighlight({ itemId: id, page, color, rects: pendingSelection.rects, text: pendingSelection.text })
    window.getSelection()?.removeAllRanges()
    setPendingSelection(null)
  }

  function handleSelectHighlight(highlight: Highlight, anchor: PopoverAnchor) {
    setPendingSelection(null)
    setActiveHighlight({ highlight, anchor })
  }

  function handleSelectHighlightFromList(highlight: Highlight) {
    jumpTo(highlight.page)
    // Anchor the popover roughly centered — there's no click point from a list selection.
    setActiveHighlight({ highlight, anchor: { x: window.innerWidth / 2, y: window.innerHeight / 3 } })
  }

  async function handleUpdateHighlightColor(color: HighlightColor) {
    if (!activeHighlight) return
    await updateHighlightColor(activeHighlight.highlight.id, color)
    setActiveHighlight((prev) => (prev ? { ...prev, highlight: { ...prev.highlight, color } } : prev))
  }

  async function handleSaveHighlightNote(note: string) {
    if (!activeHighlight) return
    await updateHighlightNote(activeHighlight.highlight.id, note)
  }

  async function handleDeleteHighlight(highlightId: string) {
    await removeHighlight(highlightId)
    setActiveHighlight(null)
  }

  async function handleOpenFullNoteFromHighlight() {
    if (!activeHighlight || !item) return
    const linked = notes.find((n) => n.highlightId === activeHighlight.highlight.id)
    if (linked) {
      setEditingNote(linked)
    } else {
      const created = await createNoteFromHighlight({
        itemId: item.id,
        itemTitle: item.title,
        page: activeHighlight.highlight.page,
        highlightId: activeHighlight.highlight.id,
        highlightedText: activeHighlight.highlight.text
      })
      setEditingNote(created)
    }
    setActiveHighlight(null)
    setNoteEditorOpen(true)
  }

  function handleOpenNoteFromSidebar(note: Note) {
    setEditingNote(note)
    setNoteEditorOpen(true)
    if (note.page) jumpTo(note.page)
  }

  function handleNewNoteForCurrentPage() {
    setEditingNote(undefined)
    setNoteEditorOpen(true)
  }

  const pageHighlights = highlights.filter((h) => h.page === page)

  const sidebar =
    doc && numPages ? (
      <ReaderSidebar
        doc={doc}
        numPages={numPages}
        currentPage={page}
        onSelectPage={handleSelectPage}
        bookmarks={bookmarks}
        onRemoveBookmark={(bid) => void removeBookmark(bid)}
        highlights={highlights}
        onSelectHighlightFromList={handleSelectHighlightFromList}
        onRemoveHighlight={(hid) => void removeHighlight(hid)}
        notes={notes}
        onOpenNote={handleOpenNoteFromSidebar}
      />
    ) : null

  const canvasProps = {
    doc,
    pageNumber: page,
    fitMode,
    scale,
    onScaleChange: setScale,
    highlights: pageHighlights,
    onSelectionFinalize: handleSelectionFinalize,
    onSelectHighlight: handleSelectHighlight,
    onSelectionAvailabilityChange: setHasTextSelection
  }

  return (
    // Mobile-viewport bugfix: below `sm:` the app shell's <main> adds
    // `pb-20` (5rem) of bottom padding to clear the fixed BottomNav, on
    // top of the 4rem TopNav — so the reader needs to subtract both
    // (9rem total), not just the TopNav, or this box ends up taller than
    // the visible viewport. That extra height was making the *document*
    // scrollable behind the reader's own internal scroll areas, so a
    // scroll/pan gesture could land on the wrong scroll container
    // entirely. `100dvh` (vs `100vh`) also keeps this correct as the
    // mobile browser's address bar shows/hides. Desktop/tablet (`sm:`
    // and up, no BottomNav, no extra padding) keeps the original,
    // unchanged 4rem-only calculation.
    <div className="flex h-[calc(100dvh-9rem)] flex-col sm:h-[calc(100vh-4rem)]">
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
        onNewNote={handleNewNoteForCurrentPage}
        onHighlight={handleHighlightButtonClick}
        canHighlight={hasTextSelection}
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
              <ReaderCanvas ref={canvasRef} {...canvasProps} doc={doc} />
              <BottomSheet open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Pages, highlights & notes">
                {sidebar}
              </BottomSheet>
            </>
          ) : sidebarOpen ? (
            <SplitLayout
              className="h-full"
              primaryWidth="75%"
              primary={<ReaderCanvas ref={canvasRef} {...canvasProps} doc={doc} />}
              secondary={<div className="h-full overflow-y-auto p-4">{sidebar}</div>}
            />
          ) : (
            <ReaderCanvas ref={canvasRef} {...canvasProps} doc={doc} />
          )
        ) : null}
      </div>

      {pendingSelection && (
        <HighlightPopover
          anchor={pendingSelection.anchor}
          onPickColor={(color) => void handlePickColorForNewSelection(color)}
          onSaveNote={() => {}}
          onClose={() => {
            window.getSelection()?.removeAllRanges()
            setPendingSelection(null)
          }}
        />
      )}

      {activeHighlight && (
        <HighlightPopover
          anchor={activeHighlight.anchor}
          highlight={activeHighlight.highlight}
          onPickColor={(color) => void handleUpdateHighlightColor(color)}
          onSaveNote={(note) => void handleSaveHighlightNote(note)}
          onOpenFullNote={() => void handleOpenFullNoteFromHighlight()}
          onDelete={() => void handleDeleteHighlight(activeHighlight.highlight.id)}
          onClose={() => setActiveHighlight(null)}
        />
      )}

      <NoteEditorDialog
        open={noteEditorOpen}
        onClose={() => setNoteEditorOpen(false)}
        note={editingNote}
        linkedContext={item ? { itemId: item.id, itemTitle: item.title, page } : undefined}
      />
    </div>
  )
}
