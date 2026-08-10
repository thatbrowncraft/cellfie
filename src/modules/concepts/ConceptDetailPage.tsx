import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowSquareOut,
  BookOpen,
  CheckCircle,
  Lightbulb,
  ListNumbers,
  PencilSimple,
  Question,
  Trash
} from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  buildConceptMindMap,
  cleanOcrText,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  fetchOnlineSummary,
  getCoOccurrenceRelated,
  getFirstAndLastEncountered,
  getRelatedConceptIds,
  getSourceExcerpt,
  parseStudySections,
  scanLibraryItemForConcepts,
  type CoOccurrenceMatch,
  type MindMapNode,
  type OnlineSummary,
  type SourceExcerpt
} from '@/core/concepts'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, Dialog, EmptyState, Tabs } from '@/shared/components'
import { ConceptSourceList } from './components/ConceptSourceList'
import { RelatedConceptsPanel } from './components/RelatedConceptsPanel'
import { ConceptMindMap } from './components/ConceptMindMap'
import { ConceptFormDialog } from './components/ConceptFormDialog'

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

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummary | undefined>(undefined)
  const [loadingOnlineSummary, setLoadingOnlineSummary] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOnlineSummary(undefined)
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

  const studyCard = useMemo(() => {
    if (!concept?.description) return null
    return parseStudySections(concept.description)
  }, [concept?.description])

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
                {/* Clean Study Knowledge Card */}
                <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-sm">
                  <h2 className="mb-4 font-display text-h3 font-semibold text-ink-primary border-b border-border pb-2">
                    {concept.name}
                  </h2>

                  <div className="flex flex-col gap-5 font-body text-body text-ink-primary">
                    {/* Definition */}
                    {(studyCard?.definition || onlineSummary?.definition) && (
                      <section>
                        <h3 className="mb-1 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          <BookOpen size={14} /> Definition
                        </h3>
                        <p className="leading-relaxed text-ink-primary">
                          {studyCard?.definition || onlineSummary?.definition}
                        </p>
                      </section>
                    )}

                    {/* Purpose */}
                    {studyCard?.purpose && studyCard.purpose.length > 0 && (
                      <section>
                        <h3 className="mb-1 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          <Question size={14} /> Purpose / Why it is used
                        </h3>
                        <ul className="list-inside list-disc space-y-1">
                          {studyCard.purpose.map((p, idx) => (
                            <li key={idx} className="leading-relaxed">{p}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Principle */}
                    {studyCard?.principle && studyCard.principle.length > 0 && (
                      <section>
                        <h3 className="mb-1 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          <Lightbulb size={14} /> Principle
                        </h3>
                        <ul className="list-inside list-disc space-y-1">
                          {studyCard.principle.map((pr, idx) => (
                            <li key={idx} className="leading-relaxed">{pr}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Procedure / Steps */}
                    {studyCard?.procedure && studyCard.procedure.length > 0 && (
                      <section>
                        <h3 className="mb-1 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          <ListNumbers size={14} /> Procedure / Steps
                        </h3>
                        <ol className="list-inside list-decimal space-y-1 font-medium">
                          {studyCard.procedure.map((step, idx) => (
                            <li key={idx} className="leading-relaxed font-normal">{step}</li>
                          ))}
                        </ol>
                      </section>
                    )}

                    {/* Result / Interpretation */}
                    {studyCard?.results && (
                      <section>
                        <h3 className="mb-1 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          <CheckCircle size={14} /> Result / Interpretation
                        </h3>
                        <p className="leading-relaxed">{studyCard.results}</p>
                      </section>
                    )}

                    {/* Key points to remember */}
                    {studyCard?.remember && studyCard.remember.length > 0 && (
                      <section>
                        <h3 className="mb-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          Remember
                        </h3>
                        <ul className="list-inside list-disc space-y-1">
                          {studyCard.remember.map((rem, idx) => (
                            <li key={idx} className="leading-relaxed">{rem}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {!studyCard?.definition && !onlineSummary?.definition && concept.description && (
                      <p className="whitespace-pre-line leading-relaxed text-ink-primary">
                        {cleanOcrText(concept.description)}
                      </p>
                    )}

                    {!concept.description && !onlineSummary && !loadingOnlineSummary && (
                      <p className="font-ui text-caption italic text-ink-tertiary">
                        No overview saved yet. Extracted sources and notes are displayed below.
                      </p>
                    )}
                  </div>

                  {/* Scientific Source Reference */}
                  <div className="mt-6 border-t border-border pt-4">
                    <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary mb-1">
                      Source / Scientific reference
                    </h4>
                    {firstAndLast.first ? (
                      <p className="font-ui text-caption text-ink-secondary">
                        <span className="font-medium text-ink-primary">{firstAndLast.first.bookTitle}</span>, Page {firstAndLast.first.pageNumber}
                      </p>
                    ) : onlineSummary ? (
                      <a
                        href={onlineSummary.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                      >
                        {onlineSummary.sourceName} <ArrowSquareOut size={13} />
                      </a>
                    ) : (
                      <p className="font-ui text-caption text-ink-tertiary">Local Library Record</p>
                    )}
                  </div>
                </div>

                {/* Source Excerpt Container */}
                {!concept.description && hasPdfPageSources && (
                  <div className="rounded-lg border border-border bg-surface p-5">
                    <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      Raw Source Context
                    </h3>
                    <p className="mb-2 font-ui text-caption text-ink-secondary">
                      {firstAndLast.first?.bookTitle}, page {firstAndLast.first?.pageNumber}
                    </p>
                    {excerpt ? (
                      <blockquote className="whitespace-pre-line rounded-md bg-surface-raised p-3 font-body text-caption italic text-ink-secondary">
                        “{cleanOcrText(excerpt.text)}”
                        <span className="mt-1 block font-ui text-micro not-italic text-ink-tertiary">
                          Unedited excerpt from source PDF — preserved for verification.
                        </span>
                      </blockquote>
                    ) : (
                      <Button variant="secondary" size="small" disabled={loadingExcerpt} onClick={() => void handleShowExcerpt()}>
                        {loadingExcerpt ? 'Reading source…' : 'Show raw source excerpt'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Highlights & Notes */}
                {(yourHighlights.length > 0 || yourNotes.length > 0) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {yourHighlights.length > 0 && (
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          Your highlights
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {yourHighlights.map((s) => (
                            <li key={s.id} className="font-body text-caption italic text-ink-secondary">
                              “{cleanOcrText(s.sourceText || '')}”
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {yourNotes.length > 0 && (
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          Your notes
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {yourNotes.map((s) => (
                            <li key={s.id} className="font-body text-caption text-ink-secondary">
                              {cleanOcrText(s.sourceText || '')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
          This removes "{concept.name}" and every source/relationship link to it. The highlights, notes, and
          bookmarks it was linked from are not affected.
        </p>
      </Dialog>
    </div>
  )
}
