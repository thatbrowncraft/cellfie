import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Bookmark,
  CaretLeft,
  CaretRight,
  HighlighterCircle,
  List,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NotePencil
} from '@phosphor-icons/react'
import { Tooltip } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import type { FitMode } from './ReaderCanvas'

interface ReaderToolbarProps {
  title: string
  currentPage: number
  numPages: number
  onPrev: () => void
  onNext: () => void
  onJump: (page: number) => void
  scale: number
  fitMode: FitMode
  onZoomIn: () => void
  onZoomOut: () => void
  onFitWidth: () => void
  onFitPage: () => void
  onBack: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  bookmarked: boolean
  onToggleBookmark: () => void
  onNewNote: () => void
  /** Bug 1 fix: explicit, always-visible Highlight action — the reliable
   *  mobile-friendly trigger, and a convenience shortcut on desktop too. */
  onHighlight: () => void
  /** Whether there's currently a live text selection to highlight. */
  canHighlight: boolean
  /** Book Reader — EPUB/HTML has no fixed page geometry to zoom/fit, so this section is hidden for those formats. Defaults to shown (PDF's original behavior). */
  showZoomControls?: boolean
  /** Book Reader — text-selection highlighting is PDF-only this pass (see FlowReaderView.tsx's doc comment); hidden rather than shown-disabled for EPUB/HTML, since it can never work. Defaults to shown. */
  showHighlight?: boolean
}

const iconButton =
  'rounded-sm p-2 text-ink-secondary hover:bg-surface-raised hover:text-ink-primary disabled:opacity-40 disabled:pointer-events-none'

const fitButton = (active: boolean) =>
  cn(
    'rounded-sm px-3 py-2 font-ui text-caption font-medium transition-colors duration-micro',
    active ? 'bg-surface-raised text-ink-primary' : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
  )

/** Sticky reader toolbar — Design System §10.5 conventions (surface bg, bottom border, no shadow). */
export function ReaderToolbar({
  title,
  currentPage,
  numPages,
  onPrev,
  onNext,
  onJump,
  scale,
  fitMode,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onBack,
  onToggleSidebar,
  sidebarOpen,
  bookmarked,
  onToggleBookmark,
  onNewNote,
  onHighlight,
  canHighlight,
  showZoomControls = true,
  showHighlight = true
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage))

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  function commitPageInput() {
    const parsed = parseInt(pageInput, 10)
    if (!Number.isNaN(parsed)) onJump(parsed)
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    commitPageInput()
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip label="Back to Library">
          <button type="button" onClick={onBack} aria-label="Back to Library" className={iconButton}>
            <ArrowLeft size={20} />
          </button>
        </Tooltip>
        <h1 className="truncate font-display text-h3 font-medium text-ink-primary">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Tooltip label="Previous page">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={iconButton}
            >
              <CaretLeft size={18} />
            </button>
          </Tooltip>

          <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
            <label htmlFor="reader-page-jump" className="sr-only">
              Jump to page
            </label>
            <input
              id="reader-page-jump"
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              className="w-12 rounded-sm border border-border bg-canvas px-2 py-1.5 text-center font-ui text-caption text-ink-primary outline-none focus:border-2 focus:border-olive"
              aria-label={`Page, ${numPages} total`}
            />
            <span className="font-ui text-caption text-ink-tertiary">/ {numPages || '—'}</span>
          </form>

          <Tooltip label="Next page">
            <button
              type="button"
              onClick={onNext}
              disabled={numPages > 0 && currentPage >= numPages}
              aria-label="Next page"
              className={iconButton}
            >
              <CaretRight size={18} />
            </button>
          </Tooltip>
        </div>

        {showZoomControls && (
          <div className="flex items-center gap-1 border-l border-border pl-4">
            <Tooltip label="Zoom out">
              <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={iconButton}>
                <MagnifyingGlassMinus size={18} />
              </button>
            </Tooltip>
            <span className="w-12 text-center font-ui text-caption text-ink-secondary">{Math.round(scale * 100)}%</span>
            <Tooltip label="Zoom in">
              <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={iconButton}>
                <MagnifyingGlassPlus size={18} />
              </button>
            </Tooltip>

            <button type="button" onClick={onFitWidth} className={fitButton(fitMode === 'width')}>
              Fit width
            </button>
            <button type="button" onClick={onFitPage} className={fitButton(fitMode === 'page')}>
              Fit page
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 border-l border-border pl-4">
          {showHighlight && (
            <Tooltip label={canHighlight ? 'Highlight the selected text' : 'Select text in the page, then tap here to highlight it'}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onHighlight}
                disabled={!canHighlight}
                aria-label="Highlight selected text"
                className={iconButton}
              >
                <HighlighterCircle size={20} weight={canHighlight ? 'fill' : 'regular'} className={canHighlight ? 'text-terracotta' : ''} />
              </button>
            </Tooltip>
          )}

          <Tooltip label="Write a note about this page">
            <button type="button" onClick={onNewNote} aria-label="Write a note about this page" className={iconButton}>
              <NotePencil size={20} />
            </button>
          </Tooltip>

          <Tooltip label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}>
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-pressed={bookmarked}
              aria-label={bookmarked ? 'Remove bookmark on this page' : 'Bookmark this page'}
              className={iconButton}
            >
              <Bookmark size={20} weight={bookmarked ? 'fill' : 'regular'} className={bookmarked ? 'text-terracotta' : ''} />
            </button>
          </Tooltip>

          <Tooltip label={sidebarOpen ? 'Hide panel' : 'Show pages & bookmarks'}>
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-pressed={sidebarOpen}
              aria-label={sidebarOpen ? 'Hide pages and bookmarks panel' : 'Show pages and bookmarks panel'}
              className={iconButton}
            >
              <List size={20} />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
