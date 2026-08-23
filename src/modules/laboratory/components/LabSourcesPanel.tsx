import { useState } from 'react'
import { Books, CaretRight, Globe, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, type DropdownOption } from '../../../shared/components'
import { db, type LibraryItem } from '../../../core/db'
import { useLiveQuery } from '../../../core/db/useLiveQuery'
import {
  lookupLabTopicKnowledge,
  type KnowledgeSourceMode,
  type LabKnowledgeLookupResult,
  type LabKnowledgeLookupStatus
} from '../../../core/laboratory/knowledgeLayer'

interface LabSourcesPanelProps {
  /** The item's display title — the actual search term used against Library/Online lookups. */
  title: string
  /** The item's stable content id — used only to namespace the on-device cache, never sent anywhere. */
  contentId: string
}

/**
 * Laboratory 2.0 brief §16-21 ("the Laboratory module must eventually
 * work with THREE information layers") + §19 ("source selection should
 * be user-controlled"). This panel covers Layers 2 and 3 — Layer 1
 * (Cellfie's own curated content) is already fully rendered by the rest
 * of LaboratoryDetailPage above this component, so this never duplicates
 * that.
 *
 * Nothing here runs on mount — every lookup is explicit-tap-only (§20:
 * "do not silently mix... into one anonymous answer"), and "My Library"
 * vs "Online Knowledge" are two clearly separate tabs that never blend
 * their results into a single unattributed block.
 */
export function LabSourcesPanel({ title, contentId }: LabSourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<'my-library' | 'online'>('my-library')

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-h3 font-medium text-ink-primary">More Sources</h3>
        <p className="font-body text-caption text-ink-tertiary">
          Look this topic up in your own imported books, or in current external scientific references — kept separate from Cellfie's curated
          content above so you always know where an answer came from.
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
        <LibraryLookup title={title} contentId={contentId} />
      ) : (
        <OnlineLookup title={title} contentId={contentId} />
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

// ---------------------------------------------------------------------------
// My Library tab
// ---------------------------------------------------------------------------

function LibraryLookup({ title, contentId }: { title: string; contentId: string }) {
  const [status, setStatus] = useState<'idle' | 'searching' | LabKnowledgeLookupStatus>('idle')
  const [result, setResult] = useState<LabKnowledgeLookupResult | null>(null)
  const [mode, setMode] = useState<Extract<KnowledgeSourceMode, 'my-sources' | 'specific-source'>>('my-sources')
  const [libraryItemId, setLibraryItemId] = useState<string | undefined>(undefined)

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  async function runSearch() {
    setStatus('searching')
    const lookup = await lookupLabTopicKnowledge(title, contentId, { mode, libraryItemId: mode === 'specific-source' ? libraryItemId : undefined })
    setResult(lookup)
    setStatus(lookup.status)
  }

  if (status === 'searching') {
    return <EmptyState icon={<Books size={32} />} title="Searching your library…" description={`Looking for “${title}” in your imported books.`} />
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
              {excerpt.bookTitle}
              {excerpt.author ? ` — ${excerpt.author}` : ''}, p. {excerpt.page}
            </cite>
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
            result?.searchedSourceName
              ? `“${title}” wasn't found in ${result.searchedSourceName}.`
              : `“${title}” wasn't found in any of your imported books.`
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
      <Button
        variant="secondary"
        size="small"
        icon={<CaretRight size={16} />}
        disabled={mode === 'specific-source' && !libraryItemId}
        onClick={runSearch}
      >
        Search my library for “{title}”
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Online Knowledge tab
// ---------------------------------------------------------------------------

function OnlineLookup({ title, contentId }: { title: string; contentId: string }) {
  const [status, setStatus] = useState<'idle' | 'searching' | LabKnowledgeLookupStatus>('idle')
  const [result, setResult] = useState<LabKnowledgeLookupResult | null>(null)

  async function runSearch() {
    setStatus('searching')
    const lookup = await lookupLabTopicKnowledge(title, contentId, { mode: 'trusted' })
    setResult(lookup)
    setStatus(lookup.status)
  }

  if (status === 'searching') {
    return <EmptyState icon={<Globe size={32} />} title="Searching trusted scientific sources…" description={`Looking up “${title}”.`} />
  }

  if (status === 'offline') {
    return (
      <EmptyState
        icon={<WifiSlash size={32} />}
        title="You're offline"
        description="Online Knowledge needs a connection. Cellfie's curated content above still works offline."
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
    return (
      <EmptyState
        title="Nothing reliable found"
        description={`External trusted sources didn't return anything reliable for “${title}” either. Cellfie's curated content above is still the best reference here.`}
      />
    )
  }

  if (status === 'found' && result) {
    return (
      <div className="flex flex-col gap-4">
        {result.generalReference && (
          <div>
            <p className="font-body text-body text-ink-primary">{result.generalReference.text}</p>
            <a
              href={result.generalReference.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-ui text-caption text-olive hover:underline"
            >
              {result.generalReference.isAbstract ? 'Abstract from ' : 'From '}
              {result.generalReference.sourceName}
            </a>
          </div>
        )}
        {result.meshScopeNote && (
          <div>
            <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">MeSH Scope Note</p>
            <p className="mt-1 font-body text-body text-ink-primary">{result.meshScopeNote.text}</p>
            <a
              href={result.meshScopeNote.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-ui text-caption text-olive hover:underline"
            >
              {result.meshScopeNote.sourceName}
            </a>
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
      <p className="font-body text-caption text-ink-tertiary">Not part of Cellfie's curated content lookup yet — check current external sources.</p>
      <Button variant="secondary" size="small" icon={<CaretRight size={16} />} onClick={runSearch}>
        Search online knowledge for “{title}”
      </Button>
    </div>
  )
}
