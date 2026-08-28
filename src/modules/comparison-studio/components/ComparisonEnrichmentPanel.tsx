import { useState } from 'react'
import { Books, CaretRight, Check, Globe, Sparkle, WarningCircle, WifiSlash, X } from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, EmptyState, type DropdownOption } from '../../../shared/components'
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

interface ComparisonEnrichmentPanelProps {
  comparisonId: string
  itemAName: string
  itemBName: string
  /** Whether each side already has a value for the "Overview" aspect — Accept targets Overview when it's still blank, and falls back to "Add as additional source information" otherwise (brief §9: never invent a mapping when one isn't obviously appropriate). */
  overviewFilledA: boolean
  overviewFilledB: boolean
  onAcceptToOverview: (target: AcceptTarget) => void
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
 * row (brief §9: "do not hallucinate mappings"). It offers exactly one
 * confident mapping — the Overview aspect, when it's still blank — and
 * otherwise stores the excerpt as comparison-level "Additional source
 * information" (the comparison's own Notes), which is the honest,
 * non-invented way to keep evidence that doesn't cleanly map onto one row.
 * The existing per-aspect "Find more for this aspect" action (still
 * reachable from each row) remains the advanced fallback for pulling a
 * specific piece of that evidence into a specific cell (brief §33).
 */
export function ComparisonEnrichmentPanel({
  comparisonId,
  itemAName,
  itemBName,
  overviewFilledA,
  overviewFilledB,
  onAcceptToOverview,
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
   * Root-cause fix ("Accept/Add — no button works"): these buttons used
   * to call their handler and render nothing different afterward — the
   * write to the aspect/notes genuinely happened, but with the panel
   * open as a modal over the row it's updating, there was zero visible
   * confirmation, and nothing stopped a second tap from silently
   * appending the same excerpt to Notes a second time. Tracked per side
   * so each accept action gets its own inline confirmation and can't be
   * repeated by mistake, mirroring the same pattern `AcceptDismissRow`
   * already uses successfully in `ComparisonSourcesPanel`.
   */
  const [acceptedActionA, setAcceptedActionA] = useState<'overview' | 'notes' | null>(null)
  const [acceptedActionB, setAcceptedActionB] = useState<'overview' | 'notes' | null>(null)

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  const searching = statusA === 'searching' || statusB === 'searching'

  /**
   * Root-cause fix ("Search again keeps showing the same data"): Online
   * Knowledge results are cached for 7 days per term
   * (`core/laboratory/knowledgeLayer.ts`'s `KL_CACHE_TTL_MS`), so a plain
   * re-run of the identical lookup for "Enzymes"/"Proteins" correctly
   * hit that cache and returned the exact same result every time — the
   * retrieval layer already supports `forceRefresh` to bypass it, it
   * just was never threaded through from this "Search again" button.
   * `force` is only meaningful for the Online Knowledge tab (My
   * Library always re-scans live, uncached, so passing it there is a
   * harmless no-op) but is included unconditionally so the option
   * object's shape doesn't need an extra branch.
   */
  async function runSearch(opts?: { force?: boolean }) {
    setStatusA('searching')
    setStatusB('searching')
    setResultA(null)
    setResultB(null)
    setAcceptedActionA(null)
    setAcceptedActionB(null)

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
        ? ({ mode, libraryItemId: mode === 'specific-source' ? libraryItemId : undefined, forceRefresh: opts?.force } as const)
        : ({ mode: 'trusted', forceRefresh: opts?.force } as const)

    // Exactly two lookups total — one per item — no matter how many
    // aspect rows the comparison has (brief §5/§13: "search the whole
    // comparison once", "understand it needs information about BOTH").
    const [lookupA, lookupB] = await Promise.all([
      lookupComparisonTopicKnowledge(itemAName, `${comparisonId}:A`, options),
      lookupComparisonTopicKnowledge(itemBName, `${comparisonId}:B`, options)
    ])

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
    const acceptedAction = side === 'A' ? acceptedActionA : acceptedActionB
    const setAcceptedAction = side === 'A' ? setAcceptedActionA : setAcceptedActionB

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
          title={`${name}: nothing found`}
          description={
            activeTab === 'my-library'
              ? result?.searchedSourceName
                ? `Not found in ${result.searchedSourceName}.`
                : "Not found in your library."
              : "Nothing reliable found in trusted scientific sources."
          }
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
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{name}</p>
          <p className="font-body text-body text-ink-secondary">{excerptText}</p>
          <p className="font-ui text-micro text-ink-tertiary">{sourceLabel}</p>
          {acceptedAction ? (
            <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
              <Check size={13} weight="bold" aria-hidden />
              {acceptedAction === 'overview' ? 'Saved to Overview' : 'Added to Your Notes'}
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!overviewFilled && (
                <Button
                  variant="tertiary"
                  size="small"
                  icon={<Check size={14} />}
                  onClick={() => {
                    onAcceptToOverview({ side, text: excerptText, sourceLabel })
                    setAcceptedAction('overview')
                  }}
                >
                  Use as Overview
                </Button>
              )}
              <Button
                variant="tertiary"
                size="small"
                icon={<Check size={14} />}
                onClick={() => {
                  onAddAdditionalInfo({ side, text: excerptText, sourceLabel })
                  setAcceptedAction('notes')
                }}
              >
                Add as additional source information
              </Button>
            </div>
          )}
        </div>
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
            onClick={() => runSearch()}
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
              <Button variant="tertiary" size="small" icon={<CaretRight size={16} />} onClick={() => runSearch({ force: true })}>
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
