import { useState, type ReactNode } from 'react'
import { Books, CaretRight, Check, Globe, WarningCircle, WifiSlash, X } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, ReferenceOnlyLink, type DropdownOption } from '../../../shared/components'
import { db, type LibraryItem } from '../../../core/db'
import { useLiveQuery } from '../../../core/db/useLiveQuery'
import {
  lookupComparisonTopicKnowledge,
  type KnowledgeSourceMode,
  type ComparisonKnowledgeLookupResult
} from '../../../core/comparison/knowledgeLayer'
import { contentAvailabilityLabel } from '../../../core/knowledge'

interface AcceptedDraft {
  text: string
  sourceLabel: string
}

interface ComparisonSourcesPanelProps {
  /**
   * Root-cause fix (Final Polish correction — "Find more about Enzymes"
   * returns nothing): this used to double as BOTH the literal search
   * query sent to PubMed/Europe PMC/the library scan AND the display
   * text ("Search my library for '{title}'"), passed in from the call
   * site as `"${aspect.label} — ${itemName}"` (e.g. "Key Distinguishing
   * Feature — Enzymes"). PubMed and a plain-text library scan search for
   * exactly the string they're given — neither one can match a UI label
   * concatenated onto an item name, since that compound phrase never
   * appears verbatim in any real source. `title` is now the actual
   * search term alone (the item name, e.g. "Enzymes") — the same clean
   * term the whole-comparison "Enrich comparison" search already uses
   * successfully — and `aspectLabel` (below) carries the "what for"
   * context for display only.
   */
  title: string
  /** Display-only context — which aspect this fill-in is for (e.g. "Key Distinguishing Feature"). Never part of the search query itself; see `title`'s note above for why mixing the two broke every per-aspect search. */
  aspectLabel?: string
  /** Second-pass fix (audit brief §6): the other item in this comparison (e.g. "Proteins" when `title` is "Enzymes") — folded into the online query alongside `aspectLabel` so the search is genuinely "Enzymes vs Proteins key distinguishing feature", not just "Enzymes key distinguishing feature". Ignored for My Library (a plain-text excerpt scan has no use for comparison context). */
  comparedAgainst?: string
  /** Namespaces the on-device cache only — never sent anywhere. */
  topicId: string
  /** Called when the person accepts a drafted value for a specific side of the comparison (brief §11: Accept → becomes a user-owned aspect override, never silently written into curated content). */
  onAccept: (draft: AcceptedDraft) => void
  /** Opens the panel straight onto a specific tab — used when the person explicitly chose "Search My Library" or "Search Online Knowledge" from the landing search's entity-pair fallback, rather than the generic "Fill from a source" entry point (correction-pass Part 2/3/4). Defaults to 'my-library' when absent, unchanged from before. */
  defaultTab?: 'my-library' | 'online'
}

/**
 * Comparison Studio's Knowledge Layer panel (brief §8/§11) — deliberately
 * the same shape as `LabSourcesPanel`, reusing the identical retrieval
 * calls via `core/comparison/knowledgeLayer.ts`. The only real difference
 * from Laboratory's panel is the terminal action: "Accept" hands the
 * drafted text back to the aspect editor (clearly marked ⚡/📘 there)
 * instead of writing to a Saved Items list, matching the brief's
 * "draft → review → Accept/Dismiss" workflow exactly.
 *
 * COMPLIANCE PATCH: renders `generalReference.attributionNotice` when
 * present (NCBI attribution for PubMed/Bookshelf results, a
 * conservative-reuse notice for Europe PMC abstract excerpts — see
 * `core/knowledge/attribution.ts`). No other behavior change.
 *
 * The caller MUST key this component by `topicId` (or equivalently by
 * `(comparison, aspect, side)`) — see the second-pass fix note at this
 * component's call site in `ComparisonWorkspacePage.tsx` for why:
 * without a stable key, switching between two different aspects without
 * the dialog fully unmounting in between would let one aspect's
 * Search-Again exclusion state leak into another's.
 */
export function ComparisonSourcesPanel({ title, aspectLabel, comparedAgainst, topicId, onAccept, defaultTab }: ComparisonSourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<'my-library' | 'online'>(defaultTab ?? 'my-library')

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-h3 font-medium text-ink-primary">Fill from a source</h3>
        <p className="font-body text-caption text-ink-tertiary">
          {aspectLabel ? (
            <>
              Looking for information about <strong>{title}</strong> to fill in <strong>{aspectLabel}</strong>.{' '}
            </>
          ) : null}
          Draft this from your own books or current external references. Nothing is added to the comparison until you review and accept it.
        </p>
      </div>
      <div className="flex gap-1 border-b border-border">
        <TabButton active={activeTab === 'my-library'} onClick={() => setActiveTab('my-library')} icon={<Books size={16} aria-hidden />}>
          My Library
        </TabButton>
        <TabButton active={activeTab === 'online'} onClick={() => setActiveTab('online')} icon={<Globe size={16} aria-hidden />}>
          Online Knowledge
        </TabButton>
      </div>
      {activeTab === 'my-library' ? (
        <LibraryLookup title={title} topicId={topicId} onAccept={onAccept} />
      ) : (
        <OnlineLookup title={title} aspectLabel={aspectLabel} comparedAgainst={comparedAgainst} topicId={topicId} onAccept={onAccept} />
      )}
    </div>
  )
}

/**
 * Root-cause fix ("Dismiss doesn't do anything"): this used to be a
 * literal no-op (`onDismiss={() => {}}`), so tapping it produced no
 * visible change at all — indistinguishable from a broken button. It
 * now actually dismisses the result, handled by each caller resetting
 * back to the pre-search state so the person can try a different
 * search instead of being stuck looking at a result they don't want.
 */
function AcceptDismissRow({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  const [accepted, setAccepted] = useState(false)
  if (accepted) {
    return (
      <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
        <Check size={13} weight="bold" aria-hidden />
        Added as a draft — review it in the aspect
      </span>
    )
  }
  return (
    <div className="flex gap-2">
      <Button
        variant="tertiary"
        size="small"
        icon={<Check size={14} />}
        onClick={() => {
          onAccept()
          setAccepted(true)
        }}
      >
        Accept
      </Button>
      <Button variant="tertiary" size="small" icon={<X size={14} />} onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
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

// ---------------------------------------------------------------------------
// My Library tab
// ---------------------------------------------------------------------------

function LibraryLookup({ title, topicId, onAccept }: { title: string; topicId: string; onAccept: (d: AcceptedDraft) => void }) {
  const [status, setStatus] = useState<'idle' | 'searching' | ComparisonKnowledgeLookupResult['status']>('idle')
  const [result, setResult] = useState<ComparisonKnowledgeLookupResult | null>(null)
  const [mode, setMode] = useState<Extract<KnowledgeSourceMode, 'my-sources' | 'specific-source'>>('my-sources')
  const [libraryItemId, setLibraryItemId] = useState<string | undefined>(undefined)
  // Root-cause fix: Dismiss on one excerpt used to be a no-op; it now
  // just hides that specific excerpt from this list (not the whole
  // search — there can be several excerpts shown at once here).
  const [dismissedIndexes, setDismissedIndexes] = useState<Set<number>>(new Set())
  /**
   * SEARCH AGAIN FIX (My Library): every excerpt id (`${libraryItemId}:${page}`,
   * see `LibrarySourceExcerpt.id`) shown for this topic is remembered
   * for the lifetime of this panel and passed back as `excludeIds` on
   * the next search — including dismissed ones, since "already shown"
   * means never repeated regardless of accept/dismiss, mirroring
   * `OnlineLookup`'s `shownIds` below. Without this, "Search again"
   * re-ran the exact same deterministic library scan and always
   * returned (and could re-show a just-dismissed) the same excerpts.
   */
  const [shownExcerptIds, setShownExcerptIds] = useState<string[]>([])

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  async function runSearch(force = false, excludeIds: string[] = shownExcerptIds) {
    setStatus('searching')
    setDismissedIndexes(new Set())
    const lookup = await lookupComparisonTopicKnowledge(title, topicId, {
      mode,
      libraryItemId: mode === 'specific-source' ? libraryItemId : undefined,
      forceRefresh: force,
      excludeIds
    })
    if (lookup.libraryExcerpts?.length) setShownExcerptIds((prev) => [...prev, ...lookup.libraryExcerpts!.map((e) => e.id)])
    setResult(lookup)
    setStatus(lookup.status)
  }

  if (status === 'searching') {
    return <EmptyState icon={<Books size={32} />} title="Searching your library…" description={`Looking for "${title}" in your imported books.`} />
  }

  if (status === 'found' && result?.libraryExcerpts) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">
          {mode === 'specific-source' ? `From ${result.libraryExcerpts[0]?.bookTitle ?? 'your book'}` : 'Found in your library'}
        </p>
        {result.libraryExcerpts.map((excerpt, i) =>
          dismissedIndexes.has(i) ? null : (
            <blockquote key={i} className="border-l-2 border-olive pl-3 font-body text-body text-ink-secondary">
              <p>{excerpt.text}</p>
              <cite className="mt-1 block font-ui text-micro not-italic text-ink-tertiary">
                📘 {excerpt.bookTitle}
                {excerpt.author ? ` — ${excerpt.author}` : ''}, p. {excerpt.page}
              </cite>
              <div className="mt-2">
                <AcceptDismissRow
                  onAccept={() => onAccept({ text: excerpt.text, sourceLabel: `📘 ${excerpt.bookTitle}, p. ${excerpt.page}` })}
                  onDismiss={() => setDismissedIndexes((prev) => new Set(prev).add(i))}
                />
              </div>
            </blockquote>
          )
        )}
        <Button variant="tertiary" size="small" onClick={() => runSearch(true)}>
          Search again
        </Button>
      </div>
    )
  }

  if (status === 'exhausted') {
    return (
      <EmptyState
        icon={<Books size={32} />}
        title="No more matching excerpts"
        description={`Every matching excerpt in your library for "${title}" has already been shown.`}
      />
    )
  }

  if (status === 'not-found-in-source') {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          icon={<Books size={32} />}
          title="Not found in this source"
          description={
            result?.searchedSourceName ? `"${title}" wasn't found in ${result.searchedSourceName}.` : `"${title}" wasn't found in any of your imported books.`
          }
        />
        {sourcePicker()}
        <Button variant="secondary" size="small" onClick={() => runSearch()}>
          Search again
        </Button>
      </div>
    )
  }

  if (status === 'timed-out') {
    return (
      <EmptyState
        icon={<WarningCircle size={32} />}
        title="Search is taking longer than expected"
        description="Your library may be large, or a document is slow to read on this device. It's safe to try again."
        action={
          <Button variant="secondary" size="small" onClick={() => runSearch()}>
            Try again
          </Button>
        }
      />
    )
  }

  function sourcePicker() {
    return (
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
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sourcePicker()}
      <Button variant="secondary" size="small" icon={<CaretRight size={16} />} disabled={mode === 'specific-source' && !libraryItemId} onClick={() => runSearch()}>
        Search my library for "{title}"
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Online Knowledge tab
// ---------------------------------------------------------------------------

function OnlineLookup({
  title,
  aspectLabel,
  comparedAgainst,
  topicId,
  onAccept
}: {
  title: string
  aspectLabel?: string
  comparedAgainst?: string
  topicId: string
  onAccept: (d: AcceptedDraft) => void
}) {
  const [status, setStatus] = useState<'idle' | 'searching' | ComparisonKnowledgeLookupResult['status']>('idle')
  const [result, setResult] = useState<ComparisonKnowledgeLookupResult | null>(null)
  // Same fix as LibraryLookup's dismissedIndexes: Dismiss used to do
  // nothing at all. General reference and MeSH scope note are tracked
  // separately since a found result can include both at once.
  const [dismissedGeneral, setDismissedGeneral] = useState(false)
  const [dismissedMesh, setDismissedMesh] = useState(false)
  const [acceptedGeneral, setAcceptedGeneral] = useState(false)
  const [acceptedMesh, setAcceptedMesh] = useState(false)
  /**
   * Root-cause fix ("Search Again keeps showing the same Europe PMC
   * abstract"): every online result's `id` (from the shared multi-source
   * pool in core/knowledge) is remembered here for the lifetime of this
   * panel, whether it was shown, accepted, or dismissed. Search Again
   * passes the whole list back as `excludeIds` so the shared pool
   * advances to a genuinely different candidate/source instead of
   * re-showing the same one (see core/laboratory/knowledgeLayer.ts).
   */
  const [shownIds, setShownIds] = useState<string[]>([])

  async function runSearch(excludeIds?: string[]) {
    setStatus('searching')
    setDismissedGeneral(false)
    setDismissedMesh(false)
    setAcceptedGeneral(false)
    setAcceptedMesh(false)
    const lookup = await lookupComparisonTopicKnowledge(title, topicId, { mode: 'trusted', aspect: aspectLabel, comparedAgainst, excludeIds })
    if (lookup.generalReference) setShownIds((prev) => [...prev, lookup.generalReference!.id])
    setResult(lookup)
    setStatus(lookup.status)
  }

  if (status === 'searching') {
    return <EmptyState icon={<Globe size={32} />} title="Searching trusted scientific sources…" description={`Looking up "${title}".`} />
  }

  if (status === 'offline') {
    return (
      <EmptyState
        icon={<WifiSlash size={32} />}
        title="You're offline"
        description="Online Knowledge needs a connection. Everything else in this comparison still works offline."
        action={
          <Button variant="secondary" size="small" onClick={() => runSearch()}>
            Try again
          </Button>
        }
      />
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={<WarningCircle size={32} />}
        title="Couldn't retrieve this right now"
        description="Something went wrong reaching external sources."
        action={
          <Button variant="secondary" size="small" onClick={() => runSearch(shownIds)}>
            Try again
          </Button>
        }
      />
    )
  }

  if (status === 'not-found') {
    return (
      <EmptyState
        title="No usable excerpt found"
        description={`External trusted sources didn't return anything Cellfie can display as an excerpt for "${title}" either — a title alone isn't enough to count as found.`}
        action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
      />
    )
  }

  if (status === 'exhausted') {
    return (
      <EmptyState
        icon={<Globe size={32} />}
        title="No more usable results"
        description={`Every trusted source Cellfie checked for "${title}"${aspectLabel ? ` — ${aspectLabel}` : ''} has either already been shown or has nothing Cellfie can display as an excerpt.`}
        action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
      />
    )
  }

  if (status === 'found' && result) {
    return (
      <div className="flex flex-col gap-4">
        {result.generalReference && !dismissedGeneral && (
          <div>
            <p className="font-body text-body text-ink-primary">{result.generalReference.text}</p>
            <a href={result.generalReference.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-ui text-caption text-olive hover:underline">
              ⚡ {contentAvailabilityLabel(result.generalReference.contentAvailability)}{' '}
              {result.generalReference.sourceName}
            </a>
            {result.generalReference.attributionNotice && (
              <p className="mt-1 font-body text-micro text-ink-tertiary">{result.generalReference.attributionNotice}</p>
            )}
            <div className="mt-2">
              {acceptedGeneral ? (
                <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
                  <Check size={13} weight="bold" aria-hidden />
                  Added as a draft — review it in the aspect
                </span>
              ) : (
                <AcceptDismissRow
                  onAccept={() => {
                    onAccept({ text: result.generalReference!.text, sourceLabel: `⚡ ${result.generalReference!.sourceName}` })
                    setAcceptedGeneral(true)
                  }}
                  onDismiss={() => setDismissedGeneral(true)}
                />
              )}
            </div>
          </div>
        )}
        {result.meshScopeNote && !dismissedMesh && (
          <div>
            <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">MeSH Scope Note</p>
            <p className="mt-1 font-body text-body text-ink-primary">{result.meshScopeNote.text}</p>
            <a href={result.meshScopeNote.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-ui text-caption text-olive hover:underline">
              ⚡ {result.meshScopeNote.sourceName}
            </a>
            <div className="mt-2">
              {acceptedMesh ? (
                <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
                  <Check size={13} weight="bold" aria-hidden />
                  Added as a draft — review it in the aspect
                </span>
              ) : (
                <AcceptDismissRow
                  onAccept={() => {
                    onAccept({ text: result.meshScopeNote!.text, sourceLabel: `⚡ ${result.meshScopeNote!.sourceName}` })
                    setAcceptedMesh(true)
                  }}
                  onDismiss={() => setDismissedMesh(true)}
                />
              )}
            </div>
          </div>
        )}
        {((result.generalReference && dismissedGeneral) || !result.generalReference) && ((result.meshScopeNote && dismissedMesh) || !result.meshScopeNote) && (
          <p className="font-body text-caption text-ink-tertiary">Dismissed. Search another source/result.</p>
        )}
        {/* Root-cause fix ("Search again keeps showing the same data"): this now passes every id shown so far as excludeIds, so the shared multi-source pool (core/knowledge) advances to a genuinely different result/source instead of re-fetching the same deterministic top hit. */}
        <Button variant="tertiary" size="small" onClick={() => runSearch(shownIds)}>
          Search again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-caption text-ink-tertiary">Check current external scientific sources for this topic.</p>
      <Button variant="secondary" size="small" icon={<CaretRight size={16} />} onClick={() => runSearch()}>
        Search online knowledge for "{title}"
      </Button>
    </div>
  )
}
