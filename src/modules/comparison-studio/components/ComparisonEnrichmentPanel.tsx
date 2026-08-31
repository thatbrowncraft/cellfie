import { useMemo, useState } from 'react'
import { Books, CaretRight, Check, Globe, Sparkle, WarningCircle, WifiSlash, X } from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, EmptyState, ReferenceOnlyLink, type DropdownOption } from '../../../shared/components'
import { db, type LibraryItem } from '../../../core/db'
import { useLiveQuery } from '../../../core/db/useLiveQuery'
import { lookupComparisonTopicKnowledge, type ComparisonKnowledgeLookupResult } from '../../../core/comparison/knowledgeLayer'
import { savePendingComparisonSearch, clearPendingComparisonSearch, type ComparisonSearchSession } from '../../../core/comparison/draftSession'

type SourceTab = 'my-library' | 'online'
type SideStatus = 'idle' | 'searching' | ComparisonKnowledgeLookupResult['status']

interface AcceptTarget {
  side: 'A' | 'B'
  text: string
  sourceLabel: string
}

/** "Use for" destination target — any real aspect row in the comparison, by id, not just the hardcoded Overview mapping. */
interface AspectAcceptTarget {
  side: 'A' | 'B'
  aspectId: string
  text: string
  sourceLabel: string
}

/** The special, non-aspect "Use for" destination — the comparison's own free-text Notes field. Kept as a distinct sentinel value (never a real aspect id) so the dropdown can offer it alongside every aspect row. */
const NOTES_TARGET = '__notes__'

/**
 * Splits an excerpt into individually selectable sentences (Section
 * Selector brief: "select from retrieved data and select how to use
 * that selected sentence"). Deliberately a plain regex split, not an
 * NLP sentence tokenizer — consistent with `core/knowledge/rank.ts`'s
 * own "keep matching lightweight, no external service" posture. Splits
 * on `.`/`!`/`?` followed by whitespace or end-of-string; abbreviations
 * or decimal numbers occasionally over-split, which is an accepted
 * approximation — a sentence boundary landing one word early/late still
 * leaves the underlying text selectable, just chunked slightly
 * differently than a human would chunk it.
 */
function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
  return (parts ?? [trimmed]).map((s) => s.trim()).filter(Boolean)
}

interface ComparisonEnrichmentPanelProps {
  comparisonId: string
  itemAName: string
  itemBName: string
  /** Every row currently in the comparison (curated + custom), offered as "Use for" destinations alongside Notes — Section Selector brief: "or all sections available in comparison". */
  aspects: { id: string; label: string }[]
  /** Whether each side already has a value for the "Overview" aspect — used only to pick a sensible DEFAULT "Use for" selection (Overview while it's still blank); the person can always change it via the dropdown, unlike the old hardcoded single mapping. */
  overviewFilledA: boolean
  overviewFilledB: boolean
  onUseForAspect: (target: AspectAcceptTarget) => void
  onAddAdditionalInfo: (target: AcceptTarget) => void
  /** Pre-fills and immediately re-runs a search that was interrupted (brief §22 "Resume search") — the resumed request is identical to what was in flight before, since a killed process can't hand back partial results. */
  resume?: ComparisonSearchSession
  onClose: () => void
}

/**
 * The primary source-enrichment entry point (brief §5-14, §32): ONE
 * search per source, run once for the whole comparison, not once per
 * aspect per side. Reuses the exact same `lookupComparisonTopicKnowledge`
 * retrieval calls the per-aspect `ComparisonSourcesPanel` already used —
 * nothing new is built at the network/library layer, only the level at
 * which it's invoked changes (item-level, not aspect-level).
 *
 * A retrieved result is deliberately NOT auto-mapped across every aspect
 * row (brief §9: "do not hallucinate mappings") — the person always
 * makes the mapping explicit themselves. Section Selector brief update:
 * this used to mean exactly one hardcoded choice (Overview-while-blank,
 * or else the comparison's Notes); `ExcerptCard` below now surfaces a
 * "Use for" dropdown listing every real aspect row in this comparison
 * (Overview, Key Distinguishing Feature, any custom row) plus Notes,
 * still defaulting to the same Overview-while-blank guess as before but
 * never limiting the person to only that guess. It also lets the person
 * select which SENTENCES of the excerpt to use, not just accept the
 * whole block verbatim. The existing per-aspect "Find more for this
 * aspect" action (still reachable from each row) remains the advanced
 * fallback for a targeted search scoped to one specific cell (brief §33).
 *
 * COMPLIANCE PATCH: `ExcerptCard` still renders
 * `generalReference.attributionNotice` when present (NCBI attribution
 * for PubMed/Bookshelf, a conservative-reuse notice for Europe PMC
 * abstract excerpts — see `core/knowledge/attribution.ts`). No other
 * behavior change from that patch.
 */
export function ComparisonEnrichmentPanel({
  comparisonId,
  itemAName,
  itemBName,
  aspects,
  overviewFilledA,
  overviewFilledB,
  onUseForAspect,
  onAddAdditionalInfo,
  resume,
  onClose
}: ComparisonEnrichmentPanelProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>(resume?.source ?? 'my-library')
  const [mode, setMode] = useState<Extract<ComparisonSearchSession['mode'], 'my-sources' | 'specific-source'>>(resume?.mode ?? 'my-sources')
  const [libraryItemId, setLibraryItemId] = useState<string | undefined>(resume?.libraryItemId)
  const [statusA, setStatusA] = useState<SideStatus>('idle')
  const [statusB, setStatusB] = useState<SideStatus>('idle')
  const [resultA, setResultA] = useState<ComparisonKnowledgeLookupResult | null>(null)
  const [resultB, setResultB] = useState<ComparisonKnowledgeLookupResult | null>(null)
  /**
   * Root-cause fix ("Search again keeps showing the same data"): ids
   * already shown for each side are remembered here and passed back as
   * `excludeIds` on the next Online Knowledge search, so the shared
   * multi-source pool (core/knowledge) advances to a genuinely
   * different candidate/source per side instead of re-fetching the
   * same deterministic top hit. Cleared whenever a brand-new search
   * (not a "Search again") starts, or when switching tabs.
   */
  const [shownIdsA, setShownIdsA] = useState<string[]>([])
  const [shownIdsB, setShownIdsB] = useState<string[]>([])

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  const searching = statusA === 'searching' || statusB === 'searching'

  /**
   * Root-cause fix ("Search again keeps showing the same data"): Online
   * Knowledge candidates are cached as a deduped, ranked pool per query
   * (`core/knowledge`), not as a single result — a plain re-run no
   * longer needs to bypass any cache to get a different result. Instead,
   * a genuinely new "Search again" passes the ids already shown for
   * each side as `excludeIds`, so the shared pool advances to the next
   * distinct candidate/source. `opts.freshStart` (the initial "Find
   * information" tap, or a tab/mode change) resets that exclusion list;
   * "Search again" does not.
   */
  async function runSearch(opts?: { freshStart?: boolean }) {
    setStatusA('searching')
    setStatusB('searching')
    setResultA(null)
    setResultB(null)

    const excludeA = opts?.freshStart ? [] : shownIdsA
    const excludeB = opts?.freshStart ? [] : shownIdsB
    if (opts?.freshStart) {
      setShownIdsA([])
      setShownIdsB([])
    }

    await savePendingComparisonSearch({
      comparisonId,
      itemAName,
      itemBName,
      source: activeTab,
      mode,
      libraryItemId: mode === 'specific-source' ? libraryItemId : undefined,
      startedAt: Date.now()
    })

    const options =
      activeTab === 'my-library'
        ? ({ mode, libraryItemId: mode === 'specific-source' ? libraryItemId : undefined } as const)
        : ({ mode: 'trusted' } as const)

    // Exactly two lookups total — one per item — no matter how many
    // aspect rows the comparison has (brief §5/§13: "search the whole
    // comparison once", "understand it needs information about BOTH").
    const [lookupA, lookupB] = await Promise.all([
      lookupComparisonTopicKnowledge(itemAName, `${comparisonId}:A`, { ...options, comparedAgainst: itemBName, excludeIds: activeTab === 'online' ? excludeA : undefined }),
      lookupComparisonTopicKnowledge(itemBName, `${comparisonId}:B`, { ...options, comparedAgainst: itemAName, excludeIds: activeTab === 'online' ? excludeB : undefined })
    ])

    if (lookupA.generalReference) setShownIdsA((prev) => [...prev, lookupA.generalReference!.id])
    if (lookupB.generalReference) setShownIdsB((prev) => [...prev, lookupB.generalReference!.id])

    setResultA(lookupA)
    setStatusA(lookupA.status)
    setResultB(lookupB)
    setStatusB(lookupB.status)
    await clearPendingComparisonSearch(comparisonId)
  }

  function sideBlock(side: 'A' | 'B') {
    const name = side === 'A' ? itemAName : itemBName
    const status = side === 'A' ? statusA : statusB
    const result = side === 'A' ? resultA : resultB
    const overviewFilled = side === 'A' ? overviewFilledA : overviewFilledB

    if (status === 'searching' || status === 'idle') return null

    if (status === 'offline') {
      return <EmptyState icon={<WifiSlash size={24} />} title={`${name}: you're offline`} description="Online Knowledge needs a connection." />
    }
    if (status === 'timed-out') {
      return <EmptyState icon={<WarningCircle size={24} />} title={`${name}: taking longer than expected`} description="Safe to try again." />
    }
    if (status === 'error') {
      return <EmptyState icon={<WarningCircle size={24} />} title={`${name}: couldn't retrieve this right now`} description="Something went wrong reaching this source." />
    }
    if (status === 'not-found' || status === 'not-found-in-source') {
      return (
        <EmptyState
          icon={activeTab === 'my-library' ? <Books size={24} /> : <Globe size={24} />}
          title={`${name}: no usable excerpt found`}
          description={
            activeTab === 'my-library'
              ? result?.searchedSourceName
                ? `Not found in ${result.searchedSourceName}.`
                : "Not found in your library."
              : "Trusted scientific sources didn't return anything Cellfie can display as an excerpt — a bare title or citation isn't enough to count as found."
          }
          action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
        />
      )
    }
    if (status === 'exhausted') {
      return (
        <EmptyState
          icon={<Globe size={24} />}
          title={`${name}: no more usable results`}
          description="Every trusted source Cellfie checked for this side has either already been shown or has nothing Cellfie can display as an excerpt."
          action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
        />
      )
    }

    if (status === 'found' && result) {
      const excerptText = result.libraryExcerpts?.[0]?.text ?? result.generalReference?.text ?? result.meshScopeNote?.text
      const sourceLabel =
        activeTab === 'my-library' && result.libraryExcerpts?.[0]
          ? `📘 ${result.libraryExcerpts[0].bookTitle}, p. ${result.libraryExcerpts[0].page}`
          : result.generalReference
            ? `⚡ ${result.generalReference.sourceName}`
            : result.meshScopeNote
              ? `⚡ ${result.meshScopeNote.sourceName}`
              : '⚡ Online Knowledge'

      if (!excerptText) return null

      return (
        <ExcerptCard
          // Keyed by the excerpt itself (not just `side`) so a brand-new
          // search or "Search again" — which swaps in a genuinely
          // different excerptText for this side — remounts this card
          // and resets its sentence-selection/target state, instead of
          // carrying stale selections/confirmation over onto unrelated
          // new content.
          key={`${side}:${excerptText}`}
          name={name}
          excerptText={excerptText}
          sourceLabel={sourceLabel}
          attributionNotice={result.generalReference?.attributionNotice}
          aspects={aspects}
          overviewFilled={overviewFilled}
          onApply={(aspectId, text) => {
            if (aspectId === NOTES_TARGET) onAddAdditionalInfo({ side, text, sourceLabel })
            else onUseForAspect({ side, aspectId, text, sourceLabel })
          }}
        />
      )
    }
    return null
  }

  const bothSettled = statusA !== 'idle' && statusA !== 'searching' && statusB !== 'idle' && statusB !== 'searching'
  const neitherFound = bothSettled && statusA !== 'found' && statusB !== 'found'

  return (
    <Dialog open onClose={onClose} title="Enrich comparison" size="lg">
      <div className="flex flex-col gap-4">
        <p className="font-body text-caption text-ink-tertiary">
          Looking for information about <strong>{itemAName}</strong> vs <strong>{itemBName}</strong>. This searches once for the whole comparison — not
          separately for every row.
        </p>
        {resume && (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-2 font-body text-caption text-ink-secondary">
            Picking up your previous search — it looks like it was interrupted before finishing.
          </p>
        )}

        <div className="flex gap-1 border-b border-border">
          <TabButton active={activeTab === 'my-library'} onClick={() => setActiveTab('my-library')} icon={<Books size={16} aria-hidden />}>
            My Library
          </TabButton>
          <TabButton active={activeTab === 'online'} onClick={() => setActiveTab('online')} icon={<Globe size={16} aria-hidden />}>
            Online Knowledge
          </TabButton>
        </div>

        {activeTab === 'my-library' && !searching && (
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Dropdown
              label="Search"
              options={[
                { value: 'my-sources', label: 'All of my library' },
                { value: 'specific-source', label: 'A specific book' }
              ]}
              value={mode}
              onChange={(v) => {
                setMode(v as typeof mode)
                if (v !== 'specific-source') setLibraryItemId(undefined)
              }}
            />
            {mode === 'specific-source' &&
              (bookOptions.length > 0 ? (
                <Dropdown label="Book" options={bookOptions} value={libraryItemId} onChange={setLibraryItemId} placeholder="Choose a book…" />
              ) : (
                <p className="font-body text-micro text-ink-tertiary">No books in your Library yet — add one from the Library tab first.</p>
              ))}
          </div>
        )}

        {!searching && !bothSettled && (
          <Button
            variant="primary"
            size="small"
            icon={<Sparkle size={16} />}
            disabled={mode === 'specific-source' && !libraryItemId && activeTab === 'my-library'}
            onClick={() => runSearch({ freshStart: true })}
          >
            Find information for this comparison
          </Button>
        )}

        {searching && (
          <EmptyState
            icon={activeTab === 'my-library' ? <Books size={32} /> : <Globe size={32} />}
            title="Searching…"
            description={`Looking for "${itemAName}" and "${itemBName}".`}
          />
        )}

        {bothSettled && (
          <div className="flex flex-col gap-3">
            {sideBlock('A')}
            {sideBlock('B')}
            {neitherFound && (
              <p className="font-body text-caption text-ink-tertiary">
                Nothing reliable found for either side here. Try the other source, or add information manually from each row.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="tertiary" size="small" icon={<CaretRight size={16} />} onClick={() => runSearch()}>
                Search again
              </Button>
              <Button variant="tertiary" size="small" icon={<X size={16} />} onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/**
 * Section Selector brief ("select from retrieved data and select how to
 * use that selected sentence for... use as overview, or use as
 * distinguish feature, or all sections available in comparison"): one
 * retrieved excerpt, rendered as individually toggleable sentences, plus
 * a "Use for" dropdown listing every real aspect row in the comparison
 * (not a hardcoded Overview-or-Notes choice). Deliberately its own
 * component (not inline in `sideBlock`, which is a plain helper
 * function, not a component React can attach hooks to) so its
 * selection/target/usage state follows the Rules of Hooks — and because
 * it's mounted with `key={side:excerptText}` at the call site, a
 * genuinely new excerpt (fresh search or "Search again") remounts it
 * with fresh state for free, with no manual reset effect needed.
 *
 * ROOT-CAUSE FIX ("whole paragraph as overview instead of selected
 * sentence"): the first version tracked a single `applied` boolean for
 * the WHOLE card — the very first "Use selected text" tap replaced the
 * entire card with a bare "Saved to X" confirmation, discarding every
 * sentence that hadn't been sent anywhere yet. The selection itself was
 * already correct (only the ticked sentences were sent — see the
 * screenshotted result, which really did contain only the selected
 * sentences), but losing access to the REST of the excerpt the moment
 * any single selection was applied made it impossible to send a
 * different sentence to a different section afterward, which is exactly
 * the point of a per-sentence picker. Fixed by tracking usage
 * PER SENTENCE (`usedFor`, keyed by sentence index) instead of one flag
 * for the whole card: applying a selection only consumes the sentences
 * that were actually ticked at that moment — they get a small inline
 * "used for X" tag and lock out of further selection — while every
 * still-unused sentence remains live, toggleable, and reusable with a
 * newly chosen "Use for" target. The card only stops offering further
 * picks once EVERY sentence has been sent somewhere.
 */
function ExcerptCard({
  name,
  excerptText,
  sourceLabel,
  attributionNotice,
  aspects,
  overviewFilled,
  onApply
}: {
  name: string
  excerptText: string
  sourceLabel: string
  attributionNotice?: string
  aspects: { id: string; label: string }[]
  overviewFilled: boolean
  onApply: (aspectId: string, text: string) => void
}) {
  const sentences = useMemo(() => splitIntoSentences(excerptText), [excerptText])
  const [selected, setSelected] = useState<boolean[]>(() => sentences.map(() => true))
  /** Which destination LABEL each sentence has already been sent to (`null` = not yet used). Once set, that sentence is locked out of further toggling/selection — see `toggle` and `applySelection` below. */
  const [usedFor, setUsedFor] = useState<(string | null)[]>(() => sentences.map(() => null))

  const options: DropdownOption[] = [
    ...aspects.map((a) => ({ value: a.id, label: a.label })),
    { value: NOTES_TARGET, label: 'Additional source information (Notes)' }
  ]
  // Default target: the still-blank Overview row when one exists (matches the
  // old one-confident-mapping behavior), otherwise the comparison's first
  // aspect row, otherwise Notes — always overridable via the dropdown, and
  // freely changeable again before each subsequent apply.
  const overviewAspect = aspects.find((a) => a.id === 'overview')
  const defaultTarget = !overviewFilled && overviewAspect ? overviewAspect.id : (aspects[0]?.id ?? NOTES_TARGET)
  const [targetId, setTargetId] = useState(defaultTarget)

  const pendingIndices = selected.map((v, i) => (v && !usedFor[i] ? i : -1)).filter((i) => i !== -1)
  const pendingText = pendingIndices
    .map((i) => sentences[i])
    .join(' ')
    .trim()
  const allUsed = usedFor.every((v) => v !== null)

  function toggle(index: number) {
    if (usedFor[index]) return // already sent somewhere — not re-selectable
    setSelected((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  function applySelection() {
    if (pendingIndices.length === 0) return
    const targetLabel = options.find((o) => o.value === targetId)?.label ?? 'Notes'
    onApply(targetId, pendingText)
    setUsedFor((prev) => prev.map((v, i) => (pendingIndices.includes(i) ? targetLabel : v)))
    setSelected((prev) => prev.map((v, i) => (pendingIndices.includes(i) ? false : v)))
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{name}</p>
      <p className="font-body text-body text-ink-secondary">
        {sentences.map((sentence, i) => {
          const used = usedFor[i]
          if (used) {
            return (
              <span key={i} className="rounded px-0.5 text-ink-tertiary">
                {sentence} <span className="font-ui text-micro font-medium text-olive">(used for {used})</span>{' '}
              </span>
            )
          }
          return (
            <span
              key={i}
              role="checkbox"
              aria-checked={selected[i]}
              tabIndex={0}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle(i)
                }
              }}
              className={
                selected[i]
                  ? 'cursor-pointer rounded px-0.5 text-ink-primary underline decoration-olive decoration-2 underline-offset-2'
                  : 'cursor-pointer rounded px-0.5 text-ink-tertiary line-through decoration-1'
              }
            >
              {sentence}{' '}
            </span>
          )
        })}
      </p>
      <p className="font-ui text-micro text-ink-tertiary">{sourceLabel}</p>
      {attributionNotice && <p className="font-ui text-micro text-ink-tertiary">{attributionNotice}</p>}
      {allUsed ? (
        <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
          <Check size={13} weight="bold" aria-hidden />
          Every sentence from this excerpt has been used.
        </span>
      ) : (
        <>
          <p className="font-ui text-micro text-ink-tertiary">
            Tap a sentence to include or leave it out, choose where the selection goes, then apply — sentences already used stay marked but everything
            else stays available for another section.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Dropdown label="Use for" options={options} value={targetId} onChange={setTargetId} />
            <Button variant="tertiary" size="small" icon={<Check size={14} />} disabled={!pendingText} onClick={applySelection}>
              Use selected text
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex items-center gap-1.5 border-b-2 border-olive px-3 pb-2 font-ui text-ui font-medium text-ink-primary'
          : 'flex items-center gap-1.5 border-b-2 border-transparent px-3 pb-2 font-ui text-ui text-ink-tertiary hover:text-ink-secondary'
      }
    >
      {icon}
      {children}
    </button>
  )
}
