import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, Globe, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { getPageTextContent, joinPageText, loadPdfDocument } from '@/core/pdf-engine'
import { readFile } from '@/core/file-storage'
import {
  backfillSourceRelevance,
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
  type CoOccurrenceMatch,
  type MindMapNode,
  type OnlineSummary,
  type SourceExcerpt
} from '@/core/concepts'
import { cleanDisplayText, splitIntoKnownSections, type SectionBlock } from '@/core/concepts/textDisplay'
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
  const bestOverviewSource = useMemo(() => {
    const tierRank: Record<string, number> = { high: 2, relevant: 1 }
    const candidates = sources.filter(
      (s) => s.sourceType === 'pdf' && s.libraryItemId && s.pageNumber != null && (s.relevanceTier === 'high' || s.relevanceTier === 'relevant')
    )
    if (candidates.length === 0) return undefined
    return [...candidates].sort(
      (a, b) => (tierRank[b.relevanceTier ?? ''] ?? 0) - (tierRank[a.relevanceTier ?? ''] ?? 0) || (a.pageNumber! - b.pageNumber!)
    )[0]
  }, [sources])

  const hasMeaningfulPdfSource = Boolean(bestOverviewSource)
  const hasPdfPageSources = useMemo(
    () => sources.some((s) => s.sourceType === 'pdf' && s.libraryItemId && s.pageNumber != null),
    [sources]
  )
  const bestOverviewBookTitle = bestOverviewSource?.libraryItemId
    ? itemsById.get(bestOverviewSource.libraryItemId)?.title
    : undefined

  // Sprint 3.1 correction — reads this concept's own first-encountered
  // PDF page (once, when it changes) so the Overview can show ANY
  // headings that page's own book already uses (Principle, Procedure,
  // Precautions, etc.) as real sections, instead of one raw paragraph.
  // This is reorganizing the person's own material by its own structure
  // — nothing is invented. If the page has no recognizable headings,
  // `localSections` comes back empty and the Overview falls back to the
  // plain "From your library" excerpt below.
  const [localSections, setLocalSections] = useState<SectionBlock[]>([])
  const [loadingLocalSections, setLoadingLocalSections] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLocalSections([])
    if (!bestOverviewSource?.libraryItemId || bestOverviewSource.pageNumber == null) return
    const item = itemsById.get(bestOverviewSource.libraryItemId)
    if (!item) return
    setLoadingLocalSections(true)
    ;(async () => {
      try {
        const blob = await readFile(item.filePath)
        const doc = await loadPdfDocument(blob)
        const { items: textItems } = await getPageTextContent(doc, bestOverviewSource.pageNumber as number)
        const pageText = joinPageText(textItems)
        if (cancelled) return
        setLocalSections(splitIntoKnownSections(pageText))
      } catch {
        if (!cancelled) setLocalSections([])
      } finally {
        if (!cancelled) setLoadingLocalSections(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestOverviewSource?.libraryItemId, bestOverviewSource?.pageNumber])

  const [excerpt, setExcerpt] = useState<SourceExcerpt | undefined>(undefined)
  const [loadingExcerpt, setLoadingExcerpt] = useState(false)

  // Knowledge Model Correction §8 — on-demand only, never automatic:
  // pulls a short, clearly-labeled raw excerpt from the source page,
  // never an authored/invented definition.
  async function handleShowExcerpt() {
    if (!bestOverviewSource?.libraryItemId || bestOverviewSource.pageNumber == null || !concept) return
    const item = itemsById.get(bestOverviewSource.libraryItemId)
    if (!item) return
    setLoadingExcerpt(true)
    try {
      const term = bestOverviewSource.sourceText || concept.name
      const result = await getSourceExcerpt(item, bestOverviewSource.pageNumber, term)
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
            id: 'learn',
            label: 'Learn',
            content: (
              <div className="flex flex-col gap-6">
                {/* Study overview — Sprint 3.1 correction. Prefers, in order: (1) the person's own
                    typed description, (2) this concept's own book reorganized by ITS OWN headings
                    (Principle/Procedure/etc. — real structure, not invented), (3) a plain excerpt as
                    a last resort. Never fabricates a section that isn't actually supported. */}
                <div className="rounded-md border border-border bg-surface p-5">
                  <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    Study overview
                  </h3>

                  {concept.description && (
                    <p className="whitespace-pre-line font-body text-body text-ink-primary" style={{ overflowWrap: 'anywhere' }}>
                      {cleanDisplayText(concept.description)}
                    </p>
                  )}

                  {!concept.description && localSections.some((s) => s.heading) && (
                    <div className="flex flex-col gap-4">
                      {localSections
                        .filter((s) => s.heading)
                        .map((section, i) => (
                          <div key={`${section.heading}-${i}`}>
                            <h4 className="mb-1 font-ui text-caption font-semibold uppercase tracking-wide text-ink-secondary">
                              {section.heading}
                            </h4>
                            {/^\s*\d+[.)]/.test(section.body) ? (
                              <ol className="ml-4 list-decimal font-body text-body text-ink-primary">
                                {section.body
                                  .split(/\n(?=\s*\d+[.)])/)
                                  .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
                                  .filter(Boolean)
                                  .map((line, j) => (
                                    <li key={j} className="mb-1" style={{ overflowWrap: 'anywhere' }}>
                                      {line}
                                    </li>
                                  ))}
                              </ol>
                            ) : /^\s*[•*-]\s+/.test(section.body) ? (
                              <ul className="ml-4 list-disc font-body text-body text-ink-primary">
                                {section.body
                                  .split(/\n(?=\s*[•*-]\s+)/)
                                  .map((line) => line.replace(/^\s*[•*-]\s+/, '').trim())
                                  .filter(Boolean)
                                  .map((line, j) => (
                                    <li key={j} className="mb-1" style={{ overflowWrap: 'anywhere' }}>
                                      {line}
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p className="whitespace-pre-line font-body text-body text-ink-primary" style={{ overflowWrap: 'anywhere' }}>
                                {section.body}
                              </p>
                            )}
                          </div>
                        ))}
                      {bestOverviewSource && (
                        <p className="border-t border-border pt-3 font-ui text-caption text-ink-tertiary">
                          Source: {bestOverviewBookTitle}, page {bestOverviewSource.pageNumber}
                        </p>
                      )}
                    </div>
                  )}

                  {!concept.description && loadingLocalSections && (
                    <p className="font-ui text-caption text-ink-tertiary">Reading your source page…</p>
                  )}

                  {!concept.description && !loadingLocalSections && !localSections.some((s) => s.heading) && (
                    <>
                      <p className="font-body text-body text-ink-primary">No description saved yet.</p>
                      {hasMeaningfulPdfSource ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-2 font-ui text-caption text-ink-secondary">
                            Source context available — {bestOverviewBookTitle}, page {bestOverviewSource?.pageNumber}
                          </p>
                          {excerpt ? (
                            <blockquote
                              className="whitespace-pre-line rounded-md bg-surface-raised px-3 py-2 font-body text-caption italic text-ink-secondary"
                              style={{ overflowWrap: 'anywhere' }}
                            >
                              “{cleanDisplayText(excerpt.text)}”
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
                      ) : (
                        <p className="mt-3 border-t border-border pt-3 font-ui text-caption text-ink-tertiary">
                          Local source context not strong enough to build an overview.
                        </p>
                      )}
                    </>
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
                        ? 'Reliable online information was not found.'
                        : 'Online enrichment unavailable — you appear to be offline. Your local library is still available.'}
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
