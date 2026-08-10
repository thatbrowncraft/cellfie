import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  buildConceptMindMap,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  getCoOccurrenceRelated,
  getFirstAndLastEncountered,
  getRelatedConceptIds,
  getSourceExcerpt,
  scanLibraryItemForConcepts,
  type CoOccurrenceMatch,
  type MindMapNode,
  type SourceExcerpt
} from '@/core/concepts'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, Dialog, EmptyState, Tabs } from '@/shared/components'
import { ConceptSourceList } from './components/ConceptSourceList'
import { RelatedConceptsPanel } from './components/RelatedConceptsPanel'
import { ConceptMindMap } from './components/ConceptMindMap'
import { ConceptFormDialog } from './components/ConceptFormDialog'

/**
 * Concept Detail — Sprint 3 §8/§9/§10/§13. Overview (description or "No
 * description saved yet"), traceable sources grouped by type, related
 * concepts (manual + shared-tag), locally-computed statistics, and a
 * per-concept mind map. Every number and edge here is derived from
 * `useLiveQuery` subscriptions against Dexie — nothing hardcoded.
 */
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

  // Knowledge Graph Correction §17 — a concept can already have PDF page
  // sources (e.g. this book was imported/opened before this feature, or
  // before this concept existed) with Related/Mind map still empty,
  // because nothing had scanned those specific pages for *other*
  // concepts yet. This starts from the concept's own known pages only
  // (not the whole book) and is internally throttled per (concept, book,
  // page set), so it's safe to fire on every visit.
  useEffect(() => {
    if (!concept) return
    void extractRelatedConceptsFromKnownPages(concept)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.id])

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
  // Sprint 3 Correction §5A/§7 — concepts that share an actual book+page
  // ConceptSource with this one, independent of any manual relation/tag.
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

  // Knowledge Model Correction §8 — on-demand only, never automatic:
  // pulls a short, clearly-labeled raw excerpt from the source page,
  // never an authored/invented definition.
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
                <div className="rounded-md border border-border bg-surface p-5">
                  <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    Description
                  </h3>
                  <p className="font-body text-body text-ink-primary">
                    {concept.description ?? 'No description saved yet.'}
                  </p>
                  {!concept.description && hasPdfPageSources && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 font-ui text-caption text-ink-secondary">
                        Source context available — {firstAndLast.first?.bookTitle}, page {firstAndLast.first?.pageNumber}
                      </p>
                      {excerpt ? (
                        <blockquote className="rounded-md bg-surface-raised px-3 py-2 font-body text-caption italic text-ink-secondary">
                          “{excerpt.text}”
                          <span className="mt-1 block font-ui text-micro not-italic text-ink-tertiary">
                            Unedited excerpt from the source — not a definition.
                          </span>
                        </blockquote>
                      ) : (
                        <Button variant="secondary" size="small" disabled={loadingExcerpt} onClick={() => void handleShowExcerpt()}>
                          {loadingExcerpt ? 'Reading source…' : 'Show source excerpt'}
                        </Button>
                      )}
                    </div>
                  )}
                  {concept.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {concept.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro text-ink-secondary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {(firstAndLast.first || firstAndLast.last) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {firstAndLast.first && (
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="mb-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          First encountered
                        </h3>
                        <p className="font-body text-body text-ink-primary">{firstAndLast.first.bookTitle}</p>
                        <p className="font-ui text-caption text-ink-secondary">Page {firstAndLast.first.pageNumber}</p>
                      </div>
                    )}
                    {firstAndLast.last && (
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="mb-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          Last referenced
                        </h3>
                        <p className="font-body text-body text-ink-primary">{firstAndLast.last.bookTitle}</p>
                        <p className="font-ui text-caption text-ink-secondary">Page {firstAndLast.last.pageNumber}</p>
                      </div>
                    )}
                  </div>
                )}

                {(relatedConcepts.length > 0 || coOccurring.length > 0) && (
                  <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      Related concepts
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {Array.from(new Map([...relatedConcepts, ...coOccurring.map((m) => m.concept)].map((c) => [c.id, c])).values())
                        .slice(0, 8)
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/concepts/${c.id}`)}
                              className="rounded-full bg-surface-raised px-3 py-1.5 font-ui text-caption text-ink-secondary hover:text-ink-primary"
                            >
                              {c.name}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {scannableBooks.length > 0 && (
                  <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      Scan a book for this concept
                    </h3>
                    <p className="mb-3 font-body text-caption text-ink-secondary">
                      Looks for this concept's name and aliases as literal text — no scientific knowledge is invented.
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
          This removes "{concept.name}" and every source/relationship link to it. The highlights, notes, and
          bookmarks it was linked from are not affected.
        </p>
      </Dialog>
    </div>
  )
}
