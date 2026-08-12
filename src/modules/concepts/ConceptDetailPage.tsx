import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, Globe, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  backfillSourceRelevance,
  buildConceptMindMap,
  buildStudyOverview,
  cleanDisplayText,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  fetchOnlineSummary,
  getCoOccurrenceRelated,
  getFirstAndLastEncountered,
  getRelatedConceptIds,
  isLikelyOnline,
  scanLibraryItemForConcepts,
  type CoOccurrenceMatch,
  type MindMapNode,
  type OnlineSummary,
  type StudyOverview
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

  // Concept 2.0 §5/§19 — four top-level tabs (Learn / Connections / Visuals /
  // References), persisted in the URL so a refresh (or a shared link) lands
  // back on the same tab instead of always resetting to Learn.
  const CONCEPT_TAB_IDS = ['learn', 'connections', 'visuals', 'references'] as const
  type ConceptTabId = (typeof CONCEPT_TAB_IDS)[number]
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeConceptTab: ConceptTabId = (CONCEPT_TAB_IDS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as ConceptTabId)
    : 'learn'
  function setActiveConceptTab(nextId: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', nextId)
        return next
      },
      { replace: true }
    )
  }
  const [connectionsView, setConnectionsView] = useState<'related' | 'mindmap'>('related')

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

  // Relevance Correction — one-time, throttled retrofit for sources linked
  // before relevance scoring existed (the "69 sources" case). Safe to fire
  // on every visit; it no-ops once a concept has already been backfilled.
  useEffect(() => {
    if (!concept) return
    void backfillSourceRelevance(concept.id)
  }, [concept?.id])

  // Study Overview Correction — the Study Overview's local-book content
  // (§ content priority, step 2) only reads PDFs when there's no saved
  // `concept.description` to show instead (step 1 always wins). Pulls
  // the concept's own strongest page's actual leading prose, plus any
  // sections the source material itself already labels — never a
  // manufactured "Principle/Procedure/..." structure. See
  // core/concepts/extraction.ts's buildStudyOverview for the full rule.
  const [localOverview, setLocalOverview] = useState<StudyOverview | undefined>(undefined)
  const [loadingLocalOverview, setLoadingLocalOverview] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLocalOverview(undefined)
    if (!concept || concept.description) return
    setLoadingLocalOverview(true)
    buildStudyOverview(sources, itemsById)
      .then((result) => {
        if (!cancelled) setLocalOverview(result)
      })
      .finally(() => {
        if (!cancelled) setLoadingLocalOverview(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.id, concept?.description, sources.length, itemsById])

  // Sprint 4 — for an explicitly-selected concept, try to pull a real,
  // attributed scientific summary from Wikipedia (see
  // core/concepts/onlineKnowledge.ts for why Wikipedia and not
  // NCBI/CDC/WHO directly). Never blocks the page: while it's loading or
  // if it fails/there's no connection, the rest of the Overview — the
  // person's own library material, notes, and highlights — renders
  // immediately and independently below.
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

  // Personal knowledge layer (brief: "YOUR NOTES" / "YOUR HIGHLIGHTS") —
  // reuses the same ConceptSource rows already shown in the Sources tab,
  // just filtered to the two source types that carry the person's own
  // wording verbatim. No rewriting, no summarizing.
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
  // Sprint 3 Correction §5A/§7 — concepts that share an actual book+page
  // ConceptSource with this one, independent of any manual relation/tag.
  const coOccurring = useLiveQuery<CoOccurrenceMatch[]>(
    () => (id ? getCoOccurrenceRelated(id) : []),
    [id, sources.length],
    []
  )
  const firstAndLast = useMemo(() => getFirstAndLastEncountered(sources, itemsById), [sources, itemsById])

  // Relevance Correction — the Study Overview must be built from the
  // concept's STRONGEST source page, not simply the lowest page number
  // (which is exactly how a table-of-contents page — always early in the
  // book — used to win). Picks the highest-tier `pdf` source; ties break
  // toward the earliest page. A concept with only `weak` (or no) pdf
  // sources gets none here, and the UI below shows the honest "not
  // strong enough" message instead of a misleading excerpt.
  const hasPdfPageSources = useMemo(
    () => sources.some((s) => s.sourceType === 'pdf' && s.libraryItemId && s.pageNumber != null),
    [sources]
  )

  const mindMap = useLiveQuery<MindMapNode>(
    () => (id ? buildConceptMindMap(id) : Promise.resolve({ id: id ?? '', label: '', children: [] })),
    [id, sources.length, relations.length],
    { id: id ?? '', label: '', children: [] }
  )

  const meaningfulSourceCount = useMemo(
    () => sources.filter((s) => s.sourceType !== 'pdf' || s.relevanceTier === 'high' || s.relevanceTier === 'relevant').length,
    [sources]
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

  // Narrowed once here so the JSX below can rely on plain (non-optional)
  // property access instead of repeating `localOverview?.` everywhere —
  // TypeScript can't carry the narrowing from a ternary's `||` test
  // condition into the branch's JSX, so this local is what actually
  // fixes the "'localOverview' is possibly 'undefined'" build errors.
  const hasLocalOverview = Boolean(
    localOverview && (localOverview.paragraph || localOverview.sections.length > 0)
  )
  const overview = hasLocalOverview ? (localOverview as StudyOverview) : undefined

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
    <div className="mx-auto w-full min-w-0 max-w-content overflow-x-hidden px-4 py-8 sm:px-6 md:px-8">
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

      <div className="w-full min-w-0 max-w-full overflow-x-hidden">
       <Tabs
         tabs={[
          {
            id: 'learn',
            label: 'Learn',
            content: (
              <div className="flex flex-col gap-6">
                       {/* Study Overview Section — Study Overview Correction.
                           No section heading here is ever hardcoded to a subject
                           (no "Principle"/"Procedure"/"Diagnostic Value"): a
                           heading only renders when the source material itself
                           already used that word. See core/concepts/extraction.ts
                           (buildStudyOverview) and core/concepts/textDisplay.ts
                           (splitIntoKnownSections) for where that's enforced. */}
          <div className="rounded-md border border-border bg-surface p-5 space-y-4">
            <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              Study overview
            </h3>

            {concept.description ? (
              // Priority 1 — the person's own saved description, shown as-is
              // (just the render-time word-break safety net applied).
              <div className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed">
                {cleanDisplayText(concept.description)}
              </div>
            ) : loadingLocalOverview ? (
              <p className="font-ui text-caption text-ink-tertiary">Looking through your library…</p>
            ) : overview ? (
              // Priority 2 — the concept's own strongest local page, in the
              // source's own words and, separately, the source's own
              // section structure (only if the source actually has one).
              <div className="space-y-4">
                {overview.paragraph && (
                  <div>
                    <p className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed">
                      {cleanDisplayText(overview.paragraph.text)}
                    </p>
                    <p className="mt-2 font-ui text-micro text-ink-tertiary">
                      From your library — {overview.paragraph.bookTitle}, p. {overview.paragraph.pageNumber}
                    </p>
                  </div>
                )}
                {overview.sections.map((section) => (
                  <div key={`${section.heading}-${section.pageNumber}`}>
                    <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-secondary mb-1">
                      {section.heading}
                    </h4>
                    <p className="whitespace-pre-line text-ink-primary leading-relaxed">
                      {cleanDisplayText(section.body)}
                    </p>
                    <p className="mt-1 font-ui text-micro text-ink-tertiary">
                      {section.bookTitle}, p. {section.pageNumber}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              // Priority 6 — honest empty state. Never a random excerpt.
              <div className="space-y-3">
                <p className="font-body text-body text-ink-primary">No useful explanation available yet.</p>
                <p className="font-ui text-caption text-ink-secondary">
                  {hasPdfPageSources
                    ? "This concept has pages linked in your library, but none had enough real explanatory text to build an overview from."
                    : meaningfulSourceCount > 0
                      ? `${meaningfulSourceCount} source${meaningfulSourceCount === 1 ? '' : 's'} linked so far, but nothing strong enough for a written overview yet.`
                      : 'No sources linked to this concept yet.'}
                </p>
                {scannableBooks.length > 0 && (
                  <Button variant="secondary" size="small" onClick={() => setActiveConceptTab('references')}>
                    Scan a book for this concept
                  </Button>
                )}
              </div>
            )}

            {concept.tags && concept.tags.length > 0 && (
              <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                {concept.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro text-ink-secondary">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>


                {/* Scientific reference — online, source depends on the topic (see core/concepts/onlineKnowledge.ts
                    for the full hierarchy and why Wikipedia is excluded, including from the general-reference
                    fallback tier). Kept as its own separate card, never merged into "Study overview" above, so
                    it's always clear which parts came from the person's own book vs. an online reference. */}
                <div className="rounded-md border border-border bg-surface p-5">
                  <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    <Globe size={14} aria-hidden />
                    Scientific reference
                  </h3>
                  {loadingOnlineSummary && (
                    <p className="font-ui text-caption text-ink-tertiary">Checking online reference sources…</p>
                  )}
                  {!loadingOnlineSummary && onlineSummary && (
                    <div className="flex flex-col gap-2">
                      <h4 className="font-ui text-caption font-medium text-ink-primary" style={{ overflowWrap: 'anywhere' }}>
                        {onlineSummary.title}
                      </h4>
                      <p className="whitespace-pre-line font-body text-body text-ink-primary" style={{ overflowWrap: 'anywhere' }}>
                        {onlineSummary.extract}
                      </p>
                      {onlineSummary.isAbstract && (
                        <p className="font-ui text-micro text-ink-tertiary">
                          This is the abstract of a related peer-reviewed paper, not a textbook definition.
                        </p>
                      )}
                      <a
                        href={onlineSummary.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                      >
                        Source: {onlineSummary.sourceName}
                        <ArrowSquareOut size={13} />
                      </a>
                    </div>
                  )}
                  {!loadingOnlineSummary && !onlineSummary && (
                    <p className="font-ui text-caption text-ink-tertiary">
                      {isLikelyOnline() || !onlineSummaryChecked
                        ? 'No reliable external information found yet.'
                        : 'Online knowledge unavailable. Your local library and saved knowledge are still available.'}
                    </p>
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

                {/* Concept 2.0 §18 — compact access only; the full text lives in the
                    existing Notes/Highlights modules, not duplicated here. */}
                {(yourHighlights.length > 0 || yourNotes.length > 0) && (
                  <div className="flex flex-wrap gap-3">
                    {yourHighlights.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate('/highlights')}
                        className="rounded-md border border-border bg-surface px-4 py-2 font-ui text-caption font-medium text-ink-secondary hover:text-ink-primary"
                      >
                        Your highlights · {yourHighlights.length}
                      </button>
                    )}
                    {yourNotes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate('/notes')}
                        className="rounded-md border border-border bg-surface px-4 py-2 font-ui text-caption font-medium text-ink-secondary hover:text-ink-primary"
                      >
                        Your notes · {yourNotes.length}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          },
          {
            id: 'connections',
            label: `Connections${relatedConcepts.length + coOccurring.length ? ` (${relatedConcepts.length + coOccurring.length})` : ''}`,
            content: (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 border-b border-border pb-3">
                  <Button
                    variant={connectionsView === 'related' ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setConnectionsView('related')}
                  >
                    Related concepts
                  </Button>
                  <Button
                    variant={connectionsView === 'mindmap' ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setConnectionsView('mindmap')}
                  >
                    Mind map
                  </Button>
                </div>
                {connectionsView === 'related' ? (
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
                ) : (
                  <ConceptMindMap root={mindMap} />
                )}
              </div>
            )
          },
          {
            id: 'visuals',
            label: 'Visuals',
            content: (
              <div className="rounded-md border border-border bg-surface p-8 text-center">
                <p className="font-body text-body text-ink-primary">No suitable visual reference found.</p>
                <p className="mt-1 font-ui text-caption text-ink-tertiary">
                  Diagrams and process illustrations for this concept aren't available yet.
                </p>
              </div>
            )
          },
          {
            id: 'references',
            label: `References${meaningfulSourceCount ? ` (${meaningfulSourceCount})` : ''}`,
            content: (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    Your library
                  </h3>
                  <ConceptSourceList sources={sources} itemsById={itemsById} />
                </div>

                {onlineSummary && (
                  <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      <Globe size={14} aria-hidden />
                      Online references
                    </h3>
                    <a
                      href={onlineSummary.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                    >
                      {onlineSummary.sourceName}
                      <ArrowSquareOut size={13} />
                    </a>
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
          }
        ]}
        activeId={activeConceptTab}
        onChange={setActiveConceptTab}
      />

     </div>

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
