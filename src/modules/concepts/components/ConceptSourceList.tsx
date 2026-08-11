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
  pdf: { label: 'Found in book text', icon: BookOpen },
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

/**
 * Sprint 3 §2/§8/§9 — every linked source, grouped by type, each
 * navigable to the actual PDF page / note / bookmark it points at.
 * Nothing here is a fabricated citation: every row is one ConceptSource
 * row (see core/concepts/service.ts's `addConceptSource`).
 */
export function ConceptSourceList({ sources, itemsById }: ConceptSourceListProps) {
  const navigate = useNavigate()
  const [showWeak, setShowWeak] = useState(false)

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

  const grouped = new Map<ConceptSource['sourceType'], ConceptSource[]>()
  for (const source of meaningfulSources) {
    const list = grouped.get(source.sourceType) ?? []
    list.push(source)
    grouped.set(source.sourceType, list)
  }

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
            <span className="line-clamp-1 font-body text-caption italic text-ink-secondary">
              "{source.sourceText}"
            </span>
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
        <EmptyState
          title="No strong sources yet"
          description="This concept only has weak page mentions so far — see below."
        />
      )}

      {Array.from(grouped.entries()).map(([type, group]) => {
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
          {showWeak && (
            <ul className="mt-2 flex flex-col gap-1 opacity-70">{weakSources.map(renderSourceRow)}</ul>
          )}
        </div>
      )}
    </div>
  )
}
