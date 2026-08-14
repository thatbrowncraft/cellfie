import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Bookmark, CaretDown, CaretUp, Highlighter, NotePencil, Tag, Trash } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components'
import type { ConceptSource, LibraryItem } from '@/core/db'
import { removeConceptSource } from '@/core/concepts'

interface ConceptSourceListProps {
  sources: ConceptSource[]
  itemsById: Map<string, LibraryItem>
}

const typeConfig: Record<ConceptSource['sourceType'], { label: string; icon: typeof BookOpen }> = {
  pdf: { label: 'Your library', icon: BookOpen },
  highlight: { label: 'Highlight', icon: Highlighter },
  note: { label: 'Note', icon: NotePencil },
  bookmark: { label: 'Bookmark', icon: Bookmark },
  metadata: { label: 'Book tag', icon: Tag },
  manual: { label: 'Added manually', icon: Tag }
}

/**
 * Relevance Correction — a `pdf` source is only ever linked with a
 * `relevanceTier` of 'high', 'relevant', or 'weak' now (TOC/index/
 * bibliography pages are rejected before they're ever stored — see
 * core/concepts/relevance.ts). Only 'high'/'relevant' pdf sources render
 * as real sources here; 'weak' ones are folded into a single collapsible
 * count instead of being dumped into the list. Non-pdf sources (a
 * highlight, note, bookmark, tag) are inherently meaningful — the person
 * chose them — so tiering never applies to them.
 */
function isMeaningfulPdfSource(source: ConceptSource): boolean {
  return source.relevanceTier === 'high' || source.relevanceTier === 'relevant'
}

interface BookGroup {
  libraryItemId: string
  title: string
  /** One entry per distinct page — several sources landing on the exact same page collapse into one row (Concept Hub Refinement §7/§8), each keeping the FIRST real source's text/id for display and navigation. */
  pages: { pageNumber: number | undefined; representative: ConceptSource }[]
  totalSources: number
}

/**
 * Concept Hub Refinement §7/§8/§9 — every linked source, grouped by
 * type, each navigable to the actual PDF page / note / bookmark it
 * points at. Nothing here is a fabricated citation: every row traces
 * back to one real ConceptSource row (core/concepts/service.ts's
 * `addConceptSource`).
 *
 * `pdf`-type sources are grouped ONE LEVEL FURTHER, by book
 * (`libraryItemId`): instead of up to hundreds of flat "Book · Page N"
 * rows, each book renders as a single expandable item showing its
 * match count, and only reveals its page list when opened — the fix
 * for a heavily-referenced concept (e.g. "DNA" appearing on 100 pages
 * of one textbook) rendering as 100 large cards. Non-pdf types
 * (highlight/note/bookmark/tag) stay as a flat list — the person
 * chose each of those individually, and there are rarely more than a
 * handful.
 */
export function ConceptSourceList({ sources, itemsById }: ConceptSourceListProps) {
  const navigate = useNavigate()
  const [showWeak, setShowWeak] = useState(false)
  const [openBookId, setOpenBookId] = useState<string | undefined>(undefined)

  const meaningfulSources = sources.filter((s) => s.sourceType !== 'pdf' || isMeaningfulPdfSource(s))
  const weakSources = sources.filter((s) => s.sourceType === 'pdf' && s.relevanceTier === 'weak')

  if (meaningfulSources.length === 0 && weakSources.length === 0) {
    return (
      <EmptyState
        title="No sources linked yet"
        description="Link a highlight, note, or bookmark to this concept from the reader, or scan a book's text for it, to build its trail here."
      />
    )
  }

  const pdfSources = meaningfulSources.filter((s) => s.sourceType === 'pdf')
  const nonPdfGrouped = new Map<ConceptSource['sourceType'], ConceptSource[]>()
  for (const source of meaningfulSources) {
    if (source.sourceType === 'pdf') continue
    const list = nonPdfGrouped.get(source.sourceType) ?? []
    list.push(source)
    nonPdfGrouped.set(source.sourceType, list)
  }

  // Group pdf sources by book, then by page within each book.
  const bookGroups: BookGroup[] = []
  const bookIndexById = new Map<string, number>()
  for (const source of pdfSources) {
    if (!source.libraryItemId) continue
    let index = bookIndexById.get(source.libraryItemId)
    if (index === undefined) {
      index = bookGroups.length
      bookIndexById.set(source.libraryItemId, index)
      bookGroups.push({
        libraryItemId: source.libraryItemId,
        title: itemsById.get(source.libraryItemId)?.title ?? 'Unknown book',
        pages: [],
        totalSources: 0
      })
    }
    const group = bookGroups[index]
    group.totalSources += 1
    const already = group.pages.find((p) => p.pageNumber === source.pageNumber)
    if (!already) group.pages.push({ pageNumber: source.pageNumber, representative: source })
  }
  for (const group of bookGroups) {
    group.pages.sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  }
  bookGroups.sort((a, b) => b.totalSources - a.totalSources)

  function openSource(source: ConceptSource) {
    if (!source.libraryItemId) return
    const query = source.pageNumber ? `?page=${source.pageNumber}` : ''
    if (source.sourceType === 'note') {
      navigate('/notes')
      return
    }
    navigate(`/library/${source.libraryItemId}/read${query}`)
  }

  function renderSourceRow(source: ConceptSource) {
    const item = source.libraryItemId ? itemsById.get(source.libraryItemId) : undefined
    return (
      <li key={source.id} className="group flex items-center justify-between gap-2 rounded-sm px-2 py-2 hover:bg-surface-raised">
        <button
          type="button"
          onClick={() => openSource(source)}
          disabled={!source.libraryItemId}
          className="flex flex-1 flex-col items-start gap-0.5 text-left disabled:cursor-default"
        >
          <span className="font-ui text-body text-ink-primary">
            {item?.title ?? 'Unlinked'}
            {source.pageNumber ? ` · Page ${source.pageNumber}` : ''}
          </span>
          {source.sourceText && (
            <span className="line-clamp-1 font-body text-caption italic text-ink-secondary">"{source.sourceText}"</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void removeConceptSource(source.id)}
          aria-label="Remove source"
          className="shrink-0 rounded-sm p-1 text-ink-tertiary opacity-0 group-hover:opacity-100 hover:text-error"
        >
          <Trash size={15} />
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {meaningfulSources.length === 0 && (
        <EmptyState title="No strong sources yet" description="This concept only has weak page mentions so far — see below." />
      )}

      {bookGroups.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <BookOpen size={14} aria-hidden />
            Your library
          </h4>
          <div className="flex flex-col gap-2">
            {bookGroups.map((group) => {
              const isOpen = openBookId === group.libraryItemId
              return (
                <div key={group.libraryItemId} className="rounded-md border border-border bg-surface">
                  <button
                    type="button"
                    onClick={() => setOpenBookId(isOpen ? undefined : group.libraryItemId)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>📖</span>
                      <div className="min-w-0">
                        <p className="truncate font-ui text-body font-medium text-ink-primary">{group.title}</p>
                        <p className="font-ui text-caption text-ink-tertiary">
                          {group.pages.length} reference{group.pages.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    {isOpen ? (
                      <CaretUp size={16} className="shrink-0 text-ink-tertiary" />
                    ) : (
                      <CaretDown size={16} className="shrink-0 text-ink-tertiary" />
                    )}
                  </button>
                  {isOpen && (
                    <ul className="flex flex-col gap-1 border-t border-border p-2">
                      {group.pages.map((p) => (
                        <li key={`${group.libraryItemId}-${p.pageNumber ?? 'none'}`}>
                          <button
                            type="button"
                            onClick={() => openSource(p.representative)}
                            className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-surface-raised"
                          >
                            <span className="font-ui text-caption text-ink-primary">
                              {p.pageNumber ? `Page ${p.pageNumber}` : 'Unnumbered page'}
                            </span>
                            {p.representative.sourceText && (
                              <span className="line-clamp-1 font-body text-micro italic text-ink-secondary">
                                "{p.representative.sourceText}"
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {Array.from(nonPdfGrouped.entries()).map(([type, group]) => {
        const config = typeConfig[type]
        const Icon = config.icon
        return (
          <div key={type}>
            <h4 className="mb-2 flex items-center gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              <Icon size={14} aria-hidden />
              {config.label} ({group.length})
            </h4>
            <ul className="flex flex-col gap-1">{group.map(renderSourceRow)}</ul>
          </div>
        )
      })}

      {weakSources.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowWeak((v) => !v)}
            className="flex w-full items-center justify-between gap-2 font-ui text-caption text-ink-tertiary hover:text-ink-secondary"
          >
            <span>
              {weakSources.length} additional page{weakSources.length === 1 ? '' : 's'} contain{weakSources.length === 1 ? 's' : ''} weak
              mentions and {weakSources.length === 1 ? 'was' : 'were'} excluded.
            </span>
            {showWeak ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>
          {showWeak && <ul className="mt-2 flex flex-col gap-1 opacity-70">{weakSources.map(renderSourceRow)}</ul>}
        </div>
      )}
    </div>
  )
}
