import { useState, type ReactNode } from 'react'
import { Books, CaretRight, Check, Globe, WarningCircle, WifiSlash, X } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, type DropdownOption } from '../../../shared/components'
import { db, type LibraryItem } from '../../../core/db'
import { useLiveQuery } from '../../../core/db/useLiveQuery'
import {
  lookupComparisonTopicKnowledge,
  type KnowledgeSourceMode,
  type ComparisonKnowledgeLookupResult
} from '../../../core/comparison/knowledgeLayer'

interface AcceptedDraft {
  text: string
  sourceLabel: string
}

interface ComparisonSourcesPanelProps {
  /** What's being searched for, e.g. "ELISA — Sensitivity". The actual search term. */
  title: string
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
 */
export function ComparisonSourcesPanel({ title, topicId, onAccept, defaultTab }: ComparisonSourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<'my-library' | 'online'>(defaultTab ?? 'my-library')

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-h3 font-medium text-ink-primary">Fill from a source</h3>
        <p className="font-body text-caption text-ink-tertiary">
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
        <OnlineLookup title={title} topicId={topicId} onAccept={onAccept} />
      )}
    </div>
  )
}

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

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  async function runSearch() {
    setStatus('searching')
    const lookup = await lookupComparisonTopicKnowledge(title, topicId, { mode, libraryItemId: mode === 'specific-source' ? libraryItemId : undefined })
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
        {result.libraryExcerpts.map((excerpt, i) => (
          <blockquote key={i} className="border-l-2 border-olive pl-3 font-body text-body text-ink-secondary">
            <p>{excerpt.text}</p>
            <cite className="mt-1 block font-ui text-micro not-italic text-ink-tertiary">
              📘 {excerpt.bookTitle}
              {excerpt.author ? ` — ${excerpt.author}` : ''}, p. {excerpt.page}
            </cite>
            <div className="mt-2">
              <AcceptDismissRow
                onAccept={() => onAccept({ text: excerpt.text, sourceLabel: `📘 ${excerpt.bookTitle}, p. ${excerpt.page}` })}
                onDismiss={() => {}}
              />
            </div>
          </blockquote>
        ))}
        <Button variant="tertiary" size="small" onClick={() => setStatus('idle')}>
          Search again
        </Button>
      </div>
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
        <Button variant="secondary" size="small" onClick={runSearch}>
          Search again
        </Button>
      </div>
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
      <Button variant="secondary" size="small" icon={<CaretRight size={16} />} disabled={mode === 'specific-source' && !libraryItemId} onClick={runSearch}>
        Search my library for "{title}"
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Online Knowledge tab
// ---------------------------------------------------------------------------

function OnlineLookup({ title, topicId, onAccept }: { title: string; topicId: string; onAccept: (d: AcceptedDraft) => void }) {
  const [status, setStatus] = useState<'idle' | 'searching' | ComparisonKnowledgeLookupResult['status']>('idle')
  const [result, setResult] = useState<ComparisonKnowledgeLookupResult | null>(null)

  async function runSearch() {
    setStatus('searching')
    const lookup = await lookupComparisonTopicKnowledge(title, topicId, { mode: 'trusted' })
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
          <Button variant="secondary" size="small" onClick={runSearch}>
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
          <Button variant="secondary" size="small" onClick={runSearch}>
            Try again
          </Button>
        }
      />
    )
  }

  if (status === 'not-found') {
    return <EmptyState title="Nothing reliable found" description={`External trusted sources didn't return anything reliable for "${title}" either.`} />
  }

  if (status === 'found' && result) {
    return (
      <div className="flex flex-col gap-4">
        {result.generalReference && (
          <div>
            <p className="font-body text-body text-ink-primary">{result.generalReference.text}</p>
            <a href={result.generalReference.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-ui text-caption text-olive hover:underline">
              ⚡ {result.generalReference.isAbstract ? 'Abstract from ' : 'From '}
              {result.generalReference.sourceName}
            </a>
            <div className="mt-2">
              <AcceptDismissRow
                onAccept={() => onAccept({ text: result.generalReference!.text, sourceLabel: `⚡ ${result.generalReference!.sourceName}` })}
                onDismiss={() => {}}
              />
            </div>
          </div>
        )}
        {result.meshScopeNote && (
          <div>
            <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">MeSH Scope Note</p>
            <p className="mt-1 font-body text-body text-ink-primary">{result.meshScopeNote.text}</p>
            <a href={result.meshScopeNote.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-ui text-caption text-olive hover:underline">
              ⚡ {result.meshScopeNote.sourceName}
            </a>
            <div className="mt-2">
              <AcceptDismissRow
                onAccept={() => onAccept({ text: result.meshScopeNote!.text, sourceLabel: `⚡ ${result.meshScopeNote!.sourceName}` })}
                onDismiss={() => {}}
              />
            </div>
          </div>
        )}
        <Button variant="tertiary" size="small" onClick={() => setStatus('idle')}>
          Search again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-caption text-ink-tertiary">Check current external scientific sources for this topic.</p>
      <Button variant="secondary" size="small" icon={<CaretRight size={16} />} onClick={runSearch}>
        Search online knowledge for "{title}"
      </Button>
    </div>
  )
}
