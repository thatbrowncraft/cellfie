import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, Globe, PencilSimple, Trash } from '@phosphor-icons/react'
import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  backfillSourceRelevance,
  buildBookLesson,
  buildDetailedStudyModules,
  buildExamTools,
  buildResearchReadings,
  buildStudyOverview,
  computeConceptStats,
  deleteConcept,
  extractRelatedConceptsFromKnownPages,
  fetchEuropePmcArticles,
  fetchMeshClassification,
  fetchOnlineKnowledge,
  fetchVisualReferences,
  getCuratedLesson,
  getFirstAndLastEncountered,
  isLikelyOnline,
  scanLibraryForConcept,
  scanLibraryItemForConcepts,
  type EuropePmcArticle,
  type MeshClassification,
  type OnlineKnowledgeSection,
  type StudyOverview,
  type VisualReference
} from '@/core/concepts'
import { detailedModulesPlainText, examFocusPlainText, examToolsPlainText, lessonSectionsPlainText, onlineSectionsPlainText, quickRevisionPlainText } from '@/core/concepts/sectionPlainText'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, Dialog, EmptyState, Tabs } from '@/shared/components'
import { ConceptSourceList } from './components/ConceptSourceList'
import { RelatedConceptsPanel } from './components/RelatedConceptsPanel'
import { ConceptVisualsImport } from './components/ConceptVisualsImport'
import { StudyNotesSection } from './components/StudyNotesSection'
import { MindMapStudio } from './components/MindMapStudio'
import { CuratedLessonView, CuratedQuickRevisionView, CuratedExamFocusView } from './components/CuratedLessonView'
import { EditableSection } from './components/EditableSection'
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

  // Retrieval Stability Correction — `backfillSourceRelevance` and
  // `scanLibraryForConcept` both write new/updated ConceptSource rows
  // over a span of many awaited PDF-page reads. The `sources` liveQuery
  // above used to re-emit a new array after EVERY one of those writes,
  // and Core Concept used to rebuild itself from scratch on every one of
  // those emissions — not a stale-response race (each rebuild WAS the
  // latest data), but a moving target: as scanning slowly discovered
  // more/better pages across the library, the "best" selection
  // legitimately kept changing, which is exactly the "Core Concept
  // changes every few seconds" bug. The fix is to stop treating
  // retrieval as continuously-reactive: run both passes to completion
  // first, and only signal "ready to build" once, via
  // `retrievalGeneration` below — Core Concept is computed once from a
  // settled snapshot, not re-derived on every intermediate write.
  const retrievalSettledForConceptId = useRef<string | undefined>(undefined)
  const [retrievalGeneration, setRetrievalGeneration] = useState(0)
  // Product decision — loading is fine, a premature fallback is not:
  // this stays true for the WHOLE span from "concept opened" to "one
  // complete settled snapshot obtained", so the UI (below) can show an
  // honest "searching your library" state instead of ever rendering the
  // MeSH/curated fallback while the uploaded-book scan is still running.
  const [libraryScanInProgress, setLibraryScanInProgress] = useState(false)
  useEffect(() => {
    if (!concept) return
    let cancelled = false
    setLibraryScanInProgress(true)
    Promise.all([backfillSourceRelevance(concept.id), scanLibraryForConcept(concept)]).finally(() => {
      if (cancelled) return
      retrievalSettledForConceptId.current = concept.id
      setRetrievalGeneration((g) => g + 1)
      setLibraryScanInProgress(false)
    })
    return () => {
      cancelled = true
      setLibraryScanInProgress(false)
    }
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
    () => (concept ? buildExamTools(onlineSections) : { keyPoints: [], importantValues: [] }),
    [concept, onlineSections]
  )

  // Learn tab, Detailed Study mode — five fixed modules (Definition &
  // Biological Scope / Classification & Taxonomic Hierarchy / Structure
  // & Molecular Composition / Biological Mechanism & Function /
  // Important Functional Relationships), built purely from data already
  // fetched above. See core/concepts/detailedStudy.ts's header comment
  // for the cross-module duplication guard.
  const detailedStudyModules = useMemo(
    () => (concept ? buildDetailedStudyModules(concept, onlineSections, meshClassification) : []),
    [concept, onlineSections, meshClassification]
  )

  // Second Refinement §Part 3–7 — the curated-lesson lookup. A hand-
  // authored, source-attributed lesson takes over Core Concept (and
  // feeds Quick Revision/Exam Focus's compact summaries) whenever one
  // exists for this concept; every other concept keeps the prior
  // MeSH/PubChem-based architecture untouched. See
  // core/concepts/curatedLessons/registry.ts.
  const curatedLesson = useMemo(() => (concept ? getCuratedLesson(concept) : undefined), [concept])

  // Book-First Learning Engine, Phase 1 — the new TRUE Tier 1: the
  // person's own uploaded book(s), searched via the pre-existing
  // relevance-scored pipeline (relevance.ts/textDisplay.ts, called
  // through extraction.ts's buildStudyOverview — nothing about that
  // pipeline changes here, this just reconnects it to the Learn tab and
  // reshapes its output via bookLesson.ts). Async because it reads real
  // PDF pages, so it follows the same never-blocks effect pattern as
  // every other Learn-tab feed above: the rest of the page renders
  // immediately, and this fills in once ready. Capped by
  // buildStudyOverview's own MAX_STUDY_SOURCE_PAGES. Built exactly once
  // retrieval has settled (see Retrieval Stability Correction above),
  // not recomputed on every intermediate source-linking write.
  const [studyOverview, setStudyOverview] = useState<StudyOverview | undefined>(undefined)
  const [loadingStudyOverview, setLoadingStudyOverview] = useState(false)
  useEffect(() => {
    setStudyOverview(undefined)
  }, [concept?.id])
  // Retrieval Stability Correction — deliberately NOT keyed on the live
  // `sources` liveQuery. Building from `retrievalGeneration` instead
  // means this runs exactly once retrieval has settled for this concept
  // (plus once more per explicit manual "Scan a book" action, which also
  // bumps the generation) — never on every intermediate source-linking
  // write while the background scan is still in progress. Reads a fresh,
  // one-off snapshot of this concept's sources directly from Dexie
  // rather than the reactive `sources` array, so the selection is a
  // single settled read, not something that can be re-triggered by its
  // own output.
  useEffect(() => {
    if (!concept) return
    if (retrievalSettledForConceptId.current !== concept.id) return
    let cancelled = false
    setLoadingStudyOverview(true)
    ;(async () => {
      const freshSources = await db.conceptSources.where('conceptId').equals(concept.id).toArray()
      return buildStudyOverview(concept, freshSources, itemsById)
    })()
      .then((overview) => {
        if (!cancelled) setStudyOverview(overview)
      })
      .finally(() => {
        if (!cancelled) setLoadingStudyOverview(false)
      })
    return () => {
      cancelled = true
    }
    // itemsById intentionally excluded — see comment above; retrievalGeneration is the actual trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.id, retrievalGeneration])

  // The book's own explanation, reshaped into the same lesson shape
  // CuratedLessonView already renders — `undefined` (never a thin or
  // empty lesson) when the book search found nothing usable for this
  // concept. Per the new source hierarchy this OUTRANKS the curated
  // lesson: a concept's own uploaded textbook, when it actually
  // discusses that concept, is the primary teaching material — the
  // curated Gram Staining lesson remains the fallback gold-standard for
  // when no sufficient uploaded-book content exists.
  const bookLesson = useMemo(() => (concept && studyOverview ? buildBookLesson(concept, studyOverview) : undefined), [concept, studyOverview])

  // Concept 2.0 architecture change §6 — Research & Further Reading,
  // the ONLY place a Europe PMC research article's title/journal/link
  // appears on the Learn tab now. See researchReadings.ts.
  const researchReadings = useMemo(
    () => (concept ? buildResearchReadings(europePmcArticles, concept.name) : []),
    [europePmcArticles, concept]
  )

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
      // A manual scan is an explicit, one-time user action — it deserves
      // exactly one deliberate Core Concept refresh so newly-linked
      // sources can be considered, not the silent background cycling
      // this whole correction exists to remove.
      if (result.sourcesLinked > 0) setRetrievalGeneration((g) => g + 1)
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
                    Core Concept
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
                {studyMode === 'quick' && concept && (
                  <EditableSection
                    conceptId={concept.id}
                    sectionKey="quick-revision"
                    label="Quick Revision"
                    originalText={
                      bookLesson
                        ? quickRevisionPlainText(bookLesson.quickRevision)
                        : curatedLesson
                          ? quickRevisionPlainText(curatedLesson.quickRevision)
                          : onlineSectionsPlainText(onlineSections)
                    }
                  >
                    {bookLesson ? (
                      <CuratedQuickRevisionView lesson={bookLesson} />
                    ) : curatedLesson ? (
                      <CuratedQuickRevisionView lesson={curatedLesson} />
                    ) : (
                      <div className="rounded-md border border-border bg-surface p-5">
                    <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                      <Globe size={14} aria-hidden />
                      Scientific overview
                    </h3>
                    {(libraryScanInProgress || loadingStudyOverview) && (
                      <p className="mb-2 font-ui text-caption text-ink-tertiary">
                        {libraryScanInProgress
                          ? 'Searching your library and reading relevant sections from your books…'
                          : `Combining material from ${stats.bookCount || 'your'} book${stats.bookCount === 1 ? '' : 's'}…`}
                      </p>
                    )}
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
                  </EditableSection>
                )}

                {studyMode === 'quick' && concept && (
                  <StudyNotesSection conceptId={concept.id} section="quick-revision" itemLabel="revision point" />
                )}

                {/* Core Concept — Book-First Learning Engine, Phase 1.
                    Priority: (1) the person's own uploaded book, if it
                    actually discusses this concept (bookLesson.ts, built
                    from extraction.ts's buildStudyOverview); (2) the
                    hand-authored curated lesson (core/concepts/curatedLessons),
                    if one exists; (3) the prior architecture as an
                    honest fallback — Definition/Structure built only
                    from curated (MeSH scope note) or real compound
                    (PubChem) data, Classification/Relationships
                    collapsed as metadata, research kept separate below.
                    That fallback is the honest state for a concept with
                    neither an uploaded-book match nor a curated lesson
                    — never faked. */}
                {(studyMode === 'detailed' && (bookLesson || curatedLesson)) && concept && (
                  <div className="flex flex-col gap-4">
                    <EditableSection
                      conceptId={concept.id}
                      sectionKey="core-concept"
                      label="Core Concept"
                      originalText={lessonSectionsPlainText((bookLesson ?? curatedLesson)!.sections)}
                    >
                      <CuratedLessonView lesson={(bookLesson ?? curatedLesson)!} origin={bookLesson ? 'book' : 'curated'} />
                    </EditableSection>
                    <StudyNotesSection conceptId={concept.id} section="core-concept" itemLabel="study note" />
                  </div>
                )}

                {/* Retrieval Diagnostic Correction — the honest MeSH/
                    PubChem fallback below must only ever render once the
                    uploaded-library scan AND the Study Overview build for
                    THIS concept have actually finished. Rendering it the
                    instant `bookLesson`/`curatedLesson` are still
                    `undefined` — which is also their value while loading
                    — is exactly how a book that genuinely has strong
                    material could get silently outraced by "MeSH
                    responded first". Loading is fine and expected (up to
                    ~30-60s for a large library); a premature fallback is
                    not. */}
                {studyMode === 'detailed' && !bookLesson && !curatedLesson && (libraryScanInProgress || loadingStudyOverview) && concept && (
                  <div className="rounded-md border border-border bg-surface p-6 text-center">
                    <p className="font-body text-body text-ink-primary">
                      {libraryScanInProgress ? 'Searching your library…' : 'Reading relevant sections from your books…'}
                    </p>
                    <p className="mt-1 font-ui text-caption text-ink-tertiary">
                      {stats.bookCount > 0
                        ? `Combining material from ${stats.bookCount} book${stats.bookCount === 1 ? '' : 's'}…`
                        : 'Checking your uploaded library for relevant material…'}
                    </p>
                  </div>
                )}

                {studyMode === 'detailed' && !bookLesson && !curatedLesson && !libraryScanInProgress && !loadingStudyOverview && (
                  <div className="flex flex-col gap-4">
                    {concept && (
                      <EditableSection
                        conceptId={concept.id}
                        sectionKey="core-concept"
                        label="Core Concept"
                        originalText={detailedModulesPlainText(detailedStudyModules.filter((m) => m.id === 'definition' || m.id === 'structure'))}
                      >
                        <div className="flex flex-col gap-4">
                          {detailedStudyModules
                            .filter((m) => m.id === 'definition' || m.id === 'structure')
                            .map((studyModule) => (
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
                      </EditableSection>
                    )}

                    {/* Scientific metadata — Classification & Relationships,
                        collapsed by default. Real MeSH data, kept
                        available for anyone who wants it, but never
                        forced on a beginner. */}
                    <details className="group rounded-md border border-border bg-surface p-5">
                      <summary className="cursor-pointer list-none font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                        Scientific metadata
                      </summary>
                      <div className="mt-4 flex flex-col gap-4">
                        {detailedStudyModules
                          .filter((m) => m.id === 'classification' || m.id === 'relationships')
                          .map((studyModule) => (
                            <div key={studyModule.id}>
                              <h4 className="mb-2 font-ui text-caption font-semibold text-ink-secondary">{studyModule.heading}</h4>
                              <div className="flex flex-col gap-3">
                                {studyModule.subsections.map((sub) => (
                                  <div key={sub.id}>
                                    {sub.heading && (
                                      <h5 className="mb-1 font-ui text-caption font-medium text-ink-secondary">{sub.heading}</h5>
                                    )}
                                    {sub.body && (
                                      <p className="font-body text-body text-ink-primary leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
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
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                  {studyModule.sourceRefs.map((ref, i) => (
                                    <a
                                      key={i}
                                      href={ref.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
                                    >
                                      Source: {ref.sourceName}
                                      <ArrowSquareOut size={12} />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </details>

                    {/* Research & Further Reading — Concept 2.0
                        architecture change §6. The only place a Europe
                        PMC article shows up on Learn: title, why it's
                        relevant, and a source link — never the full
                        abstract. Optional deeper reading, not the
                        lesson. */}
                    <div className="rounded-md border border-border bg-surface p-5">
                      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                        Research & further reading
                      </h3>
                      {researchReadings.length === 0 ? (
                        <p className="font-ui text-caption text-ink-tertiary">
                          No peer-reviewed literature clearly about this concept found yet.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {researchReadings.map((reading, i) => (
                            <div key={`${reading.sourceUrl}-${i}`} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                              <p className="font-body text-body font-medium text-ink-primary">{reading.title}</p>
                              <p className="mt-1 font-ui text-caption text-ink-secondary">{reading.whyRelevant}</p>
                              <a
                                href={reading.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 flex w-fit items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                              >
                                Source: {reading.sourceName}
                                <ArrowSquareOut size={13} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {concept && <StudyNotesSection conceptId={concept.id} section="core-concept" itemLabel="study note" />}
                  </div>
                )}

                {/* Exam Focus — the existing exam-oriented content (key
                    points, important values, compare), now a study MODE
                    inside Learn rather than a separate Level-1 tab. The
                    old generic "Quick questions" block is gone (Third
                    Refinement §14) — a curated lesson's own hand-authored
                    possibleQuestions (CuratedExamFocusView, above) is the
                    real conceptual-question content. Memory aid is
                    intentionally NOT part of this component — see
                    MemoryAidCard below. */}
                {studyMode === 'exam' && concept && (
                  <EditableSection
                    conceptId={concept.id}
                    sectionKey="exam-focus"
                    label="Exam Focus"
                    originalText={curatedLesson ? examFocusPlainText(curatedLesson.examFocus) : examToolsPlainText(examTools)}
                  >
                    <div className="flex flex-col gap-4">
                      {curatedLesson && <CuratedExamFocusView lesson={curatedLesson} />}
                      <ExamToolsPanel concept={concept} examTools={examTools} relatedEntries={relatedEntries} onlineSections={onlineSections} />
                    </div>
                  </EditableSection>
                )}
                {studyMode === 'exam' && concept && <StudyNotesSection conceptId={concept.id} section="exam-focus" itemLabel="exam note" />}

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
                  <MindMapStudio concept={concept} />
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
                        {isLikelyOnline() || !visualsChecked ? 'No visuals added yet' : "Online sources aren't reachable right now."}
                      </p>
                      <p className="mt-1 font-ui text-caption text-ink-tertiary">
                        {isLikelyOnline() || !visualsChecked
                          ? 'Import diagrams, microscopy images, PDFs, or your own study material below.'
                          : 'Diagrams and process illustrations for this concept aren\u2019t available from a reliable source right now.'}
                      </p>
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
