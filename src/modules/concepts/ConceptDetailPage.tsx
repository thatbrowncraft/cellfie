// src/modules/concepts/ConceptDetailPage.tsx

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react'
import { ArrowLeft, ArrowSquareOut, BookOpen, Globe, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  buildConceptMindMap,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  fetchOnlineSummary,
  getCoOccurrenceRelated,
  getFirstAndLastEncountered,
  getRelatedConceptIds,
  getSourceExcerpt,
  isLikelyOnline,
  scanLibraryItemForConcepts,
  buildLocalKnowledgeSections,
  type CoOccurrenceMatch,
  type MindMapNode,
  type OnlineSummary,
  type SourceExcerpt,
  type KnowledgeSection
} from '@/core/concepts'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, Dialog, EmptyState, Tabs } from '@/shared/components'
import { ConceptSourceList } from './components/ConceptSourceList'
import { RelatedConceptsPanel } from './components/RelatedConceptsPanel'
import { ConceptMindMap } from './components/ConceptMindMap'
import { ConceptFormDialog } from './components/ConceptFormDialog'

/**
 * Renders a clean structured section for the scientific Overview card.
 */
function SectionBlock({ section }: { section: KnowledgeSection }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="font-ui text-caption font-semibold uppercase tracking-wider text-ink-secondary">
        {section.title}
      </h4>
      {section.format === 'paragraph' && typeof section.content === 'string' && (
        <p className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
          {section.content}
        </p>
      )}
      {section.format === 'bullets' && Array.isArray(section.content) && (
        <ul className="list-inside list-disc flex flex-col gap-1 pl-1 font-body text-body text-ink-primary">
          {section.content.map((item, idx) => (
            <li key={idx} className="leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
              {item}
            </li>
          ))}
        </ul>
      )}
      {section.format === 'numbered' && Array.isArray(section.content) && (
        <ol className="list-inside list-decimal flex flex-col gap-1 pl-1 font-body text-body text-ink-primary">
          {section.content.map((step, idx) => (
            <li key={idx} className="leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function ConceptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [scanMessage, setScanMessage] = useState<string | undefined>(undefined)

  const concept = useLiveQuery<Concept | undefined>(() => (id ? db.concepts.get(id) : undefined), [id], undefined)
  const sources = useLiveQuery<ConceptSource[]>(
    () => (id ? db.conceptSources.where('conceptId').equals(id).toArray() : []),
    [id],
    []
  )
  const allConcepts = useLiveQuery<Concept[]>(() => db.concepts.toArray(), [], [])
  const relations = useLiveQuery<ConceptRelation[]>(() => db.conceptRelations.toArray(), [], [])
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  useEffect(() => {
    if (!concept) return
    void extractRelatedConceptsFromKnownPages(concept)
  }, [concept?.id])

  // Online Scientific Enrichment state (Authoritative sources only - NO Wikipedia)
  const [onlineSummary, setOnlineSummary] = useState<OnlineSummary | undefined>(undefined)
  const [loadingOnlineSummary, setLoadingOnlineSummary] = useState(false)
  const [onlineSummaryChecked, setOnlineSummaryChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOnlineSummary(undefined)
    setOnlineSummaryChecked(false)
    if (!concept) return
    setLoadingOnlineSummary(true)

    fetchOnlineSummary(concept.name)
      .then((summary) => {
        if (cancelled) return
        setOnlineSummary(summary)
      })
      .finally(() => {
        if (cancelled) return
        setLoadingOnlineSummary(false)
        setOnlineSummaryChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [concept?.id, concept?.name])

  const yourHighlights = useMemo(() => sources.filter((s) => s.sourceType === 'highlight' && s.sourceText), [sources])
  const yourNotes = useMemo(() => sources.filter((s) => s.sourceType === 'note' && s.sourceText), [sources])

  const relatedIds = useLiveQuery<string[]>(() => (id ? getRelatedConceptIds(id) : []), [id, relations.length], [])
  const relatedConcepts = useMemo(
    () => allConcepts.filter((c) => relatedIds.includes(c.id)),
    [allConcepts, relatedIds]
  )
  const sharedTagSuggestions = useMemo(() => {
    if (!concept) return []
    return allConcepts.filter(
      (c) => c.id !== concept.id && !relatedIds.includes(c.id) && c.tags.some((t) => concept.tags.includes(t))
    )
  }, [allConcepts, concept, relatedIds])

  const coOccurring = useLiveQuery<CoOccurrenceMatch[]>(
    () => (id ? getCoOccurrenceRelated(id) : []),
    [id, sources.length],
    []
  )
  const firstAndLast = useMemo(() => getFirstAndLastEncountered(sources, itemsById), [sources, itemsById])
  const hasPdfPageSources = useMemo(
    () => sources.some((s) => s.sourceType === 'pdf' && s.libraryItemId && s.pageNumber != null),
    [sources]
  )
  const [excerpt, setExcerpt] = useState<SourceExcerpt | undefined>(undefined)
  const [loadingExcerpt, setLoadingExcerpt] = useState(false)

  // Local structured knowledge derived from user description/sources
  const localSections = useMemo(
    () => buildLocalKnowledgeSections(concept?.description, yourHighlights[0]?.sourceText),
    [concept?.description, yourHighlights]
  )

  async function handleShowExcerpt() {
    if (!firstAndLast.first || !concept) return
    const item = itemsById.get(firstAndLast.first.libraryItemId)
    if (!item) return
    setLoadingExcerpt(true)
    try {
      const result = await getSourceExcerpt(item, firstAndLast.first.pageNumber, concept.name)
      setExcerpt(result)
    } finally {
      setLoadingExcerpt(false)
    }
  }

  const mindMap = useLiveQuery<MindMapNode>(
    () => (id ? buildConceptMindMap(id) : Promise.resolve({ id: id ?? '', label: '', children: [] })),
    [id, sources.length, relations.length],
    { id: id ?? '', label: '', children: [] }
  )

  const sourceItemIds = useMemo(
    () => Array.from(new Set(sources.filter((s) => s.libraryItemId).map((s) => s.libraryItemId as string))),
    [sources]
  )
  const scannableBooks = useMemo(
    () => items.filter((i) => i.pageCount && !sourceItemIds.includes(i.id)),
    [items, sourceItemIds]
  )

  if (!id) return null

  if (!concept) {
    return (
      <EmptyStateLayout>
        <EmptyState
          title="Concept not found"
          description="It may have been deleted, or hasn't finished loading yet."
          action={
            <Button variant="secondary" onClick={() => navigate('/concepts')}>
              Back to Concepts
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  const stats = computeConceptStats(concept, sources)

  async function handleScan(item: LibraryItem) {
    setScanning(item.id)
    setScanMessage(undefined)
    try {
      const result = await scanLibraryItemForConcepts(item)
      setScanMessage(
        result.sourcesLinked > 0
          ? `Scanned ${result.pagesScanned} pages of "${item.title}" — linked ${result.sourcesLinked} new source${result.sourcesLinked === 1 ? '' : 's'}.`
          : `Scanned ${result.pagesScanned} pages of "${item.title}" — no matches for this concept.`
      )
    } finally {
      setScanning(null)
    }
  }

  async function handleDelete() {
    if (!id) return
    await deleteConcept(id)
    navigate('/concepts')
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate('/concepts')}
        className="mb-4 flex items-center gap-1.5 font-ui text-caption font-medium text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft size={16} />
        Concepts
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display font-semibold text-ink-primary">{concept.name}</h1>
          {concept.aliases.length > 0 && (
            <p className="mt-1 font-ui text-caption text-ink-tertiary">Also known as {concept.aliases.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="small" icon={<PencilSimple size={15} />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="destructive" size="small" icon={<Trash size={15} />} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Books', value: stats.bookCount },
          { label: 'Pages', value: stats.pageCount },
          { label: 'Highlights', value: stats.highlightCount },
          { label: 'Notes', value: stats.noteCount }
        ].map((s) => (
          <Card key={s.label}>
            <CardBody>
              <span className="block font-display text-h2 font-semibold text-ink-primary">{s.value}</span>
              <span className="font-ui text-caption text-ink-secondary">{s.label}</span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Tabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="flex flex-col gap-6">
                {/* PRIMARY STUDY KNOWLEDGE CARD */}
                <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-xs">
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                    <h3 className="flex items-center gap-2 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                      <Globe size={16} className="text-olive" aria-hidden />
                      Scientific Knowledge Overview
                    </h3>
                    {onlineSummary && (
                      <span className="rounded-full bg-surface-raised px-2.5 py-0.5 font-ui text-micro font-medium text-olive">
                        Authoritative Source
                      </span>
                    )}
                  </div>

                  {loadingOnlineSummary && (
                    <div className="py-4 text-center">
                      <p className="font-ui text-caption text-ink-tertiary">Fetching authoritative scientific overview…</p>
                    </div>
                  )}

                  {/* 1. Render Online Scientific Knowledge if available */}
                  {!loadingOnlineSummary && onlineSummary && (
                    <div className="flex flex-col gap-5">
                      {onlineSummary.sections.map((sec, i) => (
                        <SectionBlock key={i} section={sec} />
                      ))}

                      <div className="mt-2 border-t border-border pt-3">
                        <a
                          href={onlineSummary.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline"
                        >
                          <span>Source / Scientific Reference: {onlineSummary.sourceName}</span>
                          <ArrowSquareOut size={14} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 2. Render Local Knowledge Card if online is unavailable but local text exists */}
                  {!loadingOnlineSummary && !onlineSummary && localSections.length > 0 && (
                    <div className="flex flex-col gap-5">
                      {localSections.map((sec, i) => (
                        <SectionBlock key={i} section={sec} />
                      ))}

                      {firstAndLast.first && (
                        <div className="mt-2 border-t border-border pt-3">
                          <p className="font-ui text-caption text-ink-secondary">
                            Source / Scientific Reference: <strong className="text-ink-primary">{firstAndLast.first.bookTitle}</strong>, Page {firstAndLast.first.pageNumber}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Empty State Status */}
                  {!loadingOnlineSummary && !onlineSummary && localSections.length === 0 && (
                    <p className="font-ui text-caption text-ink-tertiary">
                      {isLikelyOnline() || !onlineSummaryChecked
                        ? 'No authoritative scientific card found online for this term. Local library sources are shown below.'
                        : 'Offline mode active — displaying local library sources.'}
                    </p>
                  )}
                </div>

                {/* FROM YOUR LIBRARY & RAW SOURCE EVIDENCE */}
                <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
                  <h3 className="mb-3 flex items-center gap-2 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                    <BookOpen size={16} aria-hidden />
                    From Your Library
                  </h3>

                  <p className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                    {concept.description ?? 'No custom description saved yet.'}
                  </p>

                  {/* PDF Unedited Raw Source Evidence Box */}
                  {!concept.description && hasPdfPageSources && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="mb-2 font-ui text-caption text-ink-secondary">
                        Source Evidence: <span className="font-medium text-ink-primary">{firstAndLast.first?.bookTitle}</span> (Page {firstAndLast.first?.pageNumber})
                      </p>
                      {excerpt ? (
                        <blockquote
                          className="mt-2 rounded-md bg-surface-raised p-4 font-body text-caption italic text-ink-secondary border-l-2 border-olive"
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          “{excerpt.cleanedText || excerpt.text}”
                          <span className="mt-2 block font-ui text-micro not-italic font-normal text-ink-tertiary">
                            Unedited source text excerpt — maintained for reference.
                          </span>
                        </blockquote>
                      ) : (
                        <Button variant="secondary" size="small" disabled={loadingExcerpt} onClick={() => void handleShowExcerpt()}>
                          {loadingExcerpt ? 'Reading page…' : 'Show raw source evidence excerpt'}
                        </Button>
                      )}
                    </div>
                  )}

                  {concept.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                      {concept.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro text-ink-secondary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* FIRST / LAST ENCOUNTERED */}
                {(firstAndLast.first || firstAndLast.last) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {firstAndLast.first && (
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <h3 className="mb-1 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                          First Encountered
                        </h3>
                        <p className="font-body text-body font-medium text-ink-primary">{firstAndLast.first.bookTitle}</p>
                        <p className="font-ui text-caption text-ink-secondary">Page {firstAndLast.first.pageNumber}</p>
                      </div>
                    )}
                    {firstAndLast.last && (
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <h3 className="mb-1 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                          Last Referenced
                        </h3>
                        <p className="font-body text-body font-medium text-ink-primary">{firstAndLast.last.bookTitle}</p>
                        <p className="font-ui text-caption text-ink-secondary">Page {firstAndLast.last.pageNumber}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* NOTES & HIGHLIGHTS */}
                {(yourHighlights.length > 0 || yourNotes.length > 0) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {yourHighlights.length > 0 && (
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <h3 className="mb-2 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                          Your Highlights
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {yourHighlights.map((s) => (
                            <li key={s.id} className="font-body text-caption italic text-ink-secondary" style={{ overflowWrap: 'anywhere' }}>
                              “{s.sourceText}”
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {yourNotes.length > 0 && (
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <h3 className="mb-2 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                          Your Notes
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {yourNotes.map((s) => (
                            <li key={s.id} className="font-body text-caption text-ink-secondary" style={{ overflowWrap: 'anywhere' }}>
                              {s.sourceText}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* RELATED CONCEPTS */}
                {(relatedConcepts.length > 0 || coOccurring.length > 0) && (
                  <div className="rounded-lg border border-border bg-surface p-5">
                    <h3 className="mb-3 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                      Related Concepts
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {Array.from(new Map([...relatedConcepts, ...coOccurring.map((m) => m.concept)].map((c) => [c.id, c])).values())
                        .slice(0, 8)
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/concepts/${c.id}`)}
                              className="rounded-full bg-surface-raised px-3 py-1.5 font-ui text-caption text-ink-secondary hover:text-ink-primary transition-colors"
                            >
                              {c.name}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* SCANNER */}
                {scannableBooks.length > 0 && (
                  <div className="rounded-lg border border-border bg-surface p-5">
                    <h3 className="mb-2 font-ui text-micro font-semibold uppercase tracking-wider text-ink-tertiary">
                      Scan a Book for Concept References
                    </h3>
                    <p className="mb-3 font-body text-caption text-ink-secondary">
                      Scans library books for verbatim references to "{concept.name}".
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {scannableBooks.slice(0, 6).map((item) => (
                        <Button
                          key={item.id}
                          variant="secondary"
                          size="small"
                          disabled={scanning === item.id}
                          onClick={() => void handleScan(item)}
                        >
                          {scanning === item.id ? 'Scanning…' : `Scan “${item.title}”`}
                        </Button>
                      ))}
                    </div>
                    {scanMessage && <p className="mt-3 font-ui text-caption text-ink-secondary">{scanMessage}</p>}
                  </div>
                )}
              </div>
            )
          },
          {
            id: 'sources',
            label: `Sources${sources.length ? ` (${sources.length})` : ''}`,
            content: <ConceptSourceList sources={sources} itemsById={itemsById} />
          },
          {
            id: 'related',
            label: `Related${relatedConcepts.length + coOccurring.length ? ` (${relatedConcepts.length + coOccurring.length})` : ''}`,
            content: (
              <RelatedConceptsPanel
                concept={concept}
                relatedConcepts={relatedConcepts}
                sharedTagSuggestions={sharedTagSuggestions}
                coOccurring={coOccurring}
                hasPdfPageSources={hasPdfPageSources}
                itemsById={itemsById}
                relations={relations}
                allConcepts={allConcepts}
              />
            )
          },
          {
            id: 'mindmap',
            label: 'Mind map',
            content: <ConceptMindMap root={mindMap} />
          }
        ]}
      />

      <ConceptFormDialog open={editOpen} onClose={() => setEditOpen(false)} concept={concept} />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this concept?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete concept
            </Button>
          </>
        }
      >
        <p>
          This removes "{concept.name}" and all associated source and relationship links. Your saved book highlights and notes will remain intact.
        </p>
      </Dialog>
    </div>
  )
}

