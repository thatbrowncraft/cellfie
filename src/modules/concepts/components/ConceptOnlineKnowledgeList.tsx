/**
 * ConceptOnlineKnowledgeList — Concept Online Knowledge Enrichment
 * brief. Renders the Online Knowledge excerpts the person has applied
 * to one Concept section (a fixed Learn-tab section or a custom one),
 * each with its own source attribution — mirrors StudyNotesSection's
 * "always visually separate from Cellfie's own content" placement, but
 * for source-attributed excerpts rather than the person's free-text
 * notes. Read-only besides removal: this is selected source material,
 * not something to be rewritten in place.
 */
import { ArrowSquareOut, Trash } from '@phosphor-icons/react'
import type { ConceptOnlineKnowledgeEntry } from '../../../core/db'
import { deleteOnlineKnowledgeEntry, listOnlineKnowledgeEntries } from '../../../core/concepts/customSections'
import { useLiveQuery } from '../../../core/db/useLiveQuery'

interface ConceptOnlineKnowledgeListProps {
  conceptId: string
  sectionKey: string
}

export function ConceptOnlineKnowledgeList({ conceptId, sectionKey }: ConceptOnlineKnowledgeListProps) {
  const entries = useLiveQuery<ConceptOnlineKnowledgeEntry[]>(
    () => listOnlineKnowledgeEntries(conceptId, sectionKey),
    [conceptId, sectionKey],
    []
  )

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Online Knowledge</h4>
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-sm border-l-4 border-olive/50 bg-surface-raised p-3">
          <p className="whitespace-pre-line font-body text-body text-ink-primary" style={{ overflowWrap: 'anywhere' }}>
            {entry.text}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
            >
              Source: {entry.sourceName}
              <ArrowSquareOut size={12} />
            </a>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => void deleteOnlineKnowledgeEntry(entry.id)}
              className="p-1 text-ink-tertiary hover:text-error"
            >
              <Trash size={13} />
            </button>
          </div>
          {entry.attributionNotice && <p className="mt-1 font-ui text-micro text-ink-tertiary">{entry.attributionNotice}</p>}
        </div>
      ))}
    </div>
  )
}
