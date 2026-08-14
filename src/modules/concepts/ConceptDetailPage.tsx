import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, Globe, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  backfillSourceRelevance,
  buildConceptMindMap,
  buildDetailedStudyModules,
  buildExamTools,
  buildGeneratedVisual,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  fetchEuropePmcArticles,
  fetchMeshClassification,
  fetchOnlineKnowledge,
  fetchVisualReferences,
  getFirstAndLastEncountered,
  isLikelyOnline,
  scanLibraryItemForConcepts,
  type EuropePmcArticle,
  type MeshClassification,
  type MindMapNode,
  type OnlineKnowledgeSection,
  type VisualReference
} from '@/core/concepts'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, Dialog, EmptyState, Tabs } from '@/shared/components'
import { ConceptSourceList } from './components/ConceptSourceList'
import { RelatedConceptsPanel } from './components/RelatedConceptsPanel'
import { ConceptMindMap } from './components/ConceptMindMap'
import { ConceptVisualsImport } from './components/ConceptVisualsImport'
import { GeneratedVisualCard } from './components/GeneratedVisualCard'
import { ConceptFormDialog } from './components/ConceptFormDialog'
import { ExamToolsPanel } from './components/ExamToolsPanel'
import { MemoryAidCard } from './components/MemoryAidCard'

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

  // Concept 2.0 Phase 1 — PRIMARY Learn-tab content. Pulls structured,
  // source-attributed sections from reliable online scientific sources
  // (see core/concepts/onlineKnowledge.ts: PubChem, PubMed, then a
  // Wikipedia-filtered general reference as last resort). Never blocks
  // the page: while loading or if it fails/there's no connection, the
  // rest of the page — including the person's own library material,
  // notes, and highlights, now rendered as a clearly SECONDARY block —
  // renders immediately and independently.
  const [onlineSections, setOnlineSections] = useState<OnlineKnowledgeSection[]>([])
  const [loadingOnlineKnowledge, setLoadingOnlineKnowledge] = useState(false)
  const [onlineKnowledgeChecked, setOnlineKnowledgeChecked] = useState(false)
  useEffect(() => {
    let cancelled = false
    setOnlineSections([])
    setOnlineKnowledgeChecked(false)
    if (!concept) return
    setLoadingOnlineKnowledge(true)
    fetchOnlineKnowledge(concept.name)
      .then((sections) => {
        if (cancelled) return
        setOnlineSections(sections)
      })
      .finally(() => {
        if (cancelled) return
        setLoadingOnlineKnowledge(false)
        setOnlineKnowledgeChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [concept?.id, concept?.name])

  // Detailed Study mode feed — MeSH classification/relationships and the
  // Europe PMC literature tier (core/concepts/onlineKnowledge.ts). Same
  // never-blocks, fail-soft discipline as the Learn tab fetch above: an
  // empty/undefined result just means Detailed Study's modules render an
  // honest "not available" state for whichever section relied on it.
  const [meshClassification, setMeshClassification] = useState<MeshClassification | undefined>(undefined)
  const [europePmcArticles, setEuropePmcArticles] = useState<EuropePmcArticle[]>([])
  useEffect(() => {
    let cancelled = false
    setMeshClassification(undefined)
    setEuropePmcArticles([])
    if (!concept) return
    fetchMeshClassification(concept.name).then((result) => {
      if (!cancelled) setMeshClassification(result)
    })
    fetchEuropePmcArticles(concept.name).then((articles) => {
      if (!cancelled) setEuropePmcArticles(articles)
    })
    return () => {
      cancelled = true
    }
  }, [concept?.id, concept?.name])

  // Concept 2.0 Phase 4 — Visuals tab feed. Same never-blocks,
  // never-fabricates discipline as the Learn tab: real images from real
  // sources only (core/concepts/onlineKnowledge.ts's fetchVisualReferences),
  // an honest empty state otherwise.
  const [visuals, setVisuals] = useState<VisualReference[]>([])
  const [loadingVisuals, setLoadingVisuals] = useState(false)
  const [visualsChecked, setVisualsChecked] = useState(false)
  useEffect(() => {
    let cancelled = false
    setVisuals([])
    setVisualsChecked(false)
    if (!concept) return
    setLoadingVisuals(true)
    fetchVisualReferences(concept.name)
      .then((refs) => {
        if (cancelled) return
        setVisuals(refs)
      })
      .finally(() => {
        if (cancelled) return
        setLoadingVisuals(false)
        setVisualsChecked(true)
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

  // Concept 2.0 Phase 2 — real relationships, split by origin. `relations`
  // is the same full conceptRelations table used by the Mind Map, so
  // Related Concepts and Mind Map stay backed by one source of truth.
  // Deliberately NOT derived from shared tags or same-page/same-book
  // co-occurrence anymore — see core/concepts/graph.ts's own Phase 3 note
  // for why that data still exists (Mind Map fallback) but is no longer
  // presented here as an assertion of relatedness.
  const conceptById = useMemo(() => new Map(allConcepts.map((c) => [c.id, c])), [allConcepts])
  // Concept Hub Refinement §3/§4/§5/§15 — Connections/Mind Map/Exam
  // Focus/Detailed Study's "relatedEntries" must show ONLY relationships
  // the person explicitly created. Filtered right here, the single
  // choke point every one of those consumers reads from, so nothing
  // downstream needs its own origin check. (core/concepts/graph.ts's
  // buildConceptMindMap/buildKnowledgeGraph carry the same filter at
  // their own independent query, since Mind Map doesn't go through this
  // list.) Scientific-literature relationship data can still inform
  // Detailed Study's "Important Functional Relationships" module — see
  // core/concepts/detailedStudy.ts — but only via MeSH data fetched
  // fresh for that module, never via a persisted ConceptRelation row.
  const myRelations = useMemo(
    () => (id ? relations.filter((r) => (r.conceptAId === id || r.conceptBId === id) && r.origin === 'manual') : []),
    [relations, id]
  )
  const relatedEntries = useMemo(
    () =>
      myRelations
        .map((relation) => {
          const otherId = relation.conceptAId === id ? relation.conceptBId : relation.conceptAId
          const other = conceptById.get(otherId)
          return other ? { concept: other, relation } : undefined
        })
        .filter((e): e is { concept: Concept; relation: ConceptRelation } => Boolean(e)),
    [myRelations, conceptById, id]
  )
  const relatedConcepts = useMemo(() => relatedEntries.map((e) => e.concept), [relatedEntries])

  // Concept Hub Refinement — derived purely from data already in memory
  // (onlineSections from the Learn tab fetch): no new network calls, no
  // read of the relationship table (Exam Focus's compare candidates
  // come from ExamToolsPanel's own `relatedEntries` prop directly, not
  // through this function — see examTools.ts's own doc comment).
  const examTools = useMemo(
    () => (concept ? buildExamTools(concept, onlineSections) : { keyPoints: [], importantValues: [], quickQuestions: [] }),
    [concept, onlineSections]
  )

  // Learn tab, Detailed Study mode — five fixed modules (Definition &
  // Biological Scope / Classification & Taxonomic Hierarchy / Structure
  // & Molecular Composition / Biological Mechanism & Function /
  // Important Functional Relationships), built purely from data already
  // fetched above. See core/concepts/detailedStudy.ts's header comment
  // for the cross-module duplication guard.
  const detailedStudyModules = useMemo(
    () => (concept ? buildDetailedStudyModules(concept, onlineSections, meshClassification, europePmcArticles) : []),
    [concept, onlineSections, meshClassification, europePmcArticles]
  )

  // Mind Map / Visuals redesign §10/§11 — Visuals tab's native
  // illustration fallback. Deliberately a DIFFERENT builder from the
  // Mind Map's Study Map (studyMap.ts): generatedVisual.ts favors
  // Structure/Classification "parts" data and produces a flat labeled
  // figure, never the branching flowchart. Only offered once there's
  // real content to draw from, and only ever alongside/after a check
  // for real external visuals — never a substitute the person didn't
  // ask for.
  const generatedVisual = useMemo(
    () => (concept ? buildGeneratedVisual(concept, detailedStudyModules) : undefined),
    [concept, detailedStudyModules]
  )
  const [showGeneratedDiagram, setShowGeneratedDiagram] = useState(false)

  // References tab, "Scientific sources" — deduped by URL across every
  // online tier this concept pulled from (Concept Hub Refinement §9).
  const scientificSourceLinks = useMemo(() => {
    const byUrl = new Map<string, { sourceUrl: string; sourceName: string }>()
    for (const s of onlineSections) byUrl.set(s.sourceUrl, { sourceUrl: s.sourceUrl, sourceName: s.sourceName })
    if (meshClassification) byUrl.set(meshClassification.sourceUrl, { sourceUrl: meshClassification.sourceUrl, sourceName: meshClassification.sourceName })
    return Array.from(byUrl.values())
  }, [onlineSections, meshClassification])

  // Learn tab study-mode switcher. Ephemeral (not persisted/URL-synced)
  // — matches how the existing Connections tab's related/mindmap toggle
  // already works (see `connectionsView` below).
  const [studyMode, setStudyMode] = useState<'quick' | 'detailed' | 'exam'>('quick')

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
                {/* Study-mode switcher — Quick Revision / Detailed Study /
                    Exam Focus. Ephemeral, matches the Connections tab's
                    related/mindmap toggle pattern above. Memory aid
                    (below) is deliberately OUTSIDE this switch, so it
                    stays visible no matter which mode is active. */}
                <div className="flex gap-2 border-b border-border pb-3">
                  <Button variant={studyMode === 'quick' ? 'primary' : 'secondary'} size="small" onClick={() => setStudyMode('quick')}>
                    Quick Revision
                  </Button>
                  <Button
                    variant={studyMode === 'detailed' ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setStudyMode('detailed')}
                  >
                    Detailed Study
                  </Button>
                  <Button variant={studyMode === 'exam' ? 'primary' : 'secondary'} size="small" onClick={() => setStudyMode('exam')}>
                    Exam Focus
                  </Button>
                </div>

                {/* Quick Revision — Concept 2.0 Phase 1 — PRIMARY content.
                    Structured, source-attributed sections from reliable
                    online scientific sources (core/concepts/onlineKnowledge.ts).
                    A Concept must be useful here even with no PDF/book
                    attached at all. Every heading below either comes from
                    the source's own framing or is a generic source-type
                    label — never invented from the concept's topic. */}
                {studyMode === 'quick' && (
                  <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      <Globe size={14} aria-hidden />
                      Scientific overview
                    </h3>
                    {loadingOnlineKnowledge && (
                      <p className="font-ui text-caption text-ink-tertiary">Checking reliable scientific sources…</p>
                    )}
                    {!loadingOnlineKnowledge && onlineSections.length > 0 && (
                      <div className="space-y-4">
                        {onlineSections.map((section, i) => (
                          <div key={`${section.heading}-${i}`}>
                            {section.heading && (
                              <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-secondary mb-1">
                                {section.heading}
                              </h4>
                            )}
                            <p
                              className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed"
                              style={{ overflowWrap: 'anywhere' }}
                            >
                              {section.text}
                            </p>
                            {section.isAbstract && (
                              <p className="mt-1 font-ui text-micro text-ink-tertiary">
                                This is the abstract of a related peer-reviewed paper, not a textbook definition.
                              </p>
                            )}
                            <a
                              href={section.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                            >
                              Source: {section.sourceName}
                              <ArrowSquareOut size={13} />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {!loadingOnlineKnowledge && onlineSections.length === 0 && (
                      <p className="font-ui text-caption text-ink-tertiary">
                        {isLikelyOnline() || !onlineKnowledgeChecked
                          ? 'No reliable scientific source found for this concept yet.'
                          : "Online sources aren't reachable right now. Your saved notes and library material are still available below."}
                      </p>
                    )}
                  </div>
                )}

                {/* Detailed Study — five fixed modules, each made of one
                    or more subsections. Subsections only ever exist
                    when the underlying data is genuinely structured
                    (separate MeSH fields, or a source abstract that
                    already has its own labeled sections) — see
                    core/concepts/detailedStudy.ts for exactly where
                    that structure comes from and the cross-module
                    duplication guard. Source attribution is shown per
                    module (module-level, since a module's subsections
                    are always built from the same one or two sources). */}
                {studyMode === 'detailed' && (
                  <div className="flex flex-col gap-4">
                    {detailedStudyModules.map((studyModule) => (
                      <div key={studyModule.id} className="rounded-md border border-border bg-surface p-5">
                        <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                          {studyModule.heading}
                        </h3>
                        <div className="flex flex-col gap-3">
                          {studyModule.subsections.map((sub) => (
                            <div key={sub.id}>
                              {sub.heading && (
                                <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">{sub.heading}</h4>
                              )}
                              {sub.body && (
                                <p
                                  className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed"
                                  style={{ overflowWrap: 'anywhere' }}
                                >
                                  {sub.body}
                                </p>
                              )}
                              {sub.bullets && sub.bullets.length > 0 && (
                                <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary leading-relaxed">
                                  {sub.bullets.map((bullet, i) => (
                                    <li key={i} style={{ overflowWrap: 'anywhere' }}>
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                        {studyModule.available && studyModule.sourceRefs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
                            {studyModule.sourceRefs.map((ref, i) => (
                              <a
                                key={i}
                                href={ref.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                              >
                                Source: {ref.sourceName}
                                <ArrowSquareOut size={13} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Exam Focus — the existing exam-oriented content (key
                    points, important values, quick questions, compare),
                    now a study MODE inside Learn rather than a separate
                    Level-1 tab. Memory aid is intentionally NOT part of
                    this component — see MemoryAidCard below. */}
                {studyMode === 'exam' && (
                  <ExamToolsPanel concept={concept} examTools={examTools} relatedEntries={relatedEntries} onlineSections={onlineSections} />
                )}

                {/* Memory aid — independent of study mode and of Exam
                    Focus/ExamToolsPanel. Reads/writes the existing
                    Concept.memoryAid field via the existing
                    updateConceptMemoryAid(), unchanged. */}
                <MemoryAidCard concept={concept} />

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
            label: `Connections${relatedConcepts.length ? ` (${relatedConcepts.length})` : ''}`,
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
                    relatedEntries={relatedEntries}
                    hasPdfPageSources={hasPdfPageSources}
                    allConcepts={allConcepts}
                  />
                ) : (
                  <ConceptMindMap root={mindMap} concept={concept} detailedStudyModules={detailedStudyModules} />
                )}
              </div>
            )
          },
          {
            id: 'visuals',
            label: 'Visuals',
            content: (
              <div className="flex flex-col gap-4">
                <div className="rounded-md border border-border bg-surface p-5">
                  {loadingVisuals && (
                    <p className="font-ui text-caption text-ink-tertiary">Checking reliable scientific sources for visuals…</p>
                  )}
                  {!loadingVisuals && visuals.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {visuals.map((v, i) => (
                        <figure key={`${v.imageUrl}-${i}`} className="overflow-hidden rounded-md border border-border">
                          <img
                            src={v.imageUrl}
                            alt={v.caption}
                            loading="lazy"
                            className="aspect-square w-full bg-surface-raised object-contain"
                            onError={(e) => {
                              e.currentTarget.closest('figure')?.remove()
                            }}
                          />
                          <figcaption className="flex flex-col gap-1 p-3">
                            <span className="font-ui text-caption text-ink-primary">{v.caption}</span>
                            <a
                              href={v.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
                            >
                              Source: {v.sourceName}
                              <ArrowSquareOut size={12} />
                            </a>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                  {!loadingVisuals && visuals.length === 0 && (
                    <div className="p-3 text-center">
                      <p className="font-body text-body text-ink-primary">
                        {isLikelyOnline() || !visualsChecked ? 'No verified scientific visual found' : "Online sources aren't reachable right now."}
                      </p>
                      <p className="mt-1 font-ui text-caption text-ink-tertiary">
                        {isLikelyOnline() || !visualsChecked
                          ? "We couldn't find a suitable visual from the approved scientific sources for this concept yet."
                          : 'Diagrams and process illustrations for this concept aren\u2019t available from a reliable source right now.'}
                      </p>
                    </div>
                  )}

                  {/* Mind Map / Visuals redesign §10/§11 — a native
                      illustration built from this concept's own verified
                      structured data (generatedVisual.ts), offered whenever
                      no external image was found (or alongside real visuals
                      — it's never a substitute the person didn't ask for).
                      This is a labeled figure, not the Study Map: see
                      GeneratedVisualCard's own header comment. */}
                  {!loadingVisuals && generatedVisual && (
                    <div className={visuals.length === 0 ? 'mt-2' : 'mt-4 border-t border-border pt-4'}>
                      {!showGeneratedDiagram ? (
                        <Button variant="secondary" size="small" onClick={() => setShowGeneratedDiagram(true)}>
                          Generate illustration
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setShowGeneratedDiagram(false)}
                            className="self-end font-ui text-micro text-ink-tertiary hover:underline"
                          >
                            Hide
                          </button>
                          <GeneratedVisualCard visual={generatedVisual} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <ConceptVisualsImport concept={concept} />
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

                {(onlineSections.length > 0 || meshClassification) && (
                  <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      <Globe size={14} aria-hidden />
                      Scientific sources
                    </h3>
                    <div className="flex flex-col gap-2">
                      {scientificSourceLinks.map((s) => (
                        <a
                          key={s.sourceUrl}
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                        >
                          {s.sourceName}
                          <ArrowSquareOut size={13} />
                        </a>
                      ))}
                    </div>
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
