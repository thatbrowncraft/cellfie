import { useState } from 'react'
import { Books, Globe, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { Button, Dropdown, EmptyState, type DropdownOption } from '@/shared/components'
import { db, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { lookupOrganismOnline, knowledgeSourceModeLabels, type KnowledgeLayerLookupStatus, type KnowledgeSourceMode } from '@/core/organisms'

interface KnowledgeLayerSearchPanelProps {
  query: string
  onFound: (organismId: string) => void
}

const SOURCE_MODE_OPTIONS: DropdownOption[] = (['trusted', 'my-sources', 'specific-source'] as KnowledgeSourceMode[]).map((mode) => ({
  value: mode,
  label: knowledgeSourceModeLabels[mode]
}))

/**
 * Knowledge Layer + Source Library brief, §Phase 2, §4-6, §19-20, §42.
 * Shown only when a search finds nothing in the curated local library
 * AND the query looks like it could be an organism name (never for a
 * filter/category phrase — see `looksLikeOrganismQuery`). Retrieval
 * only ever happens from the explicit tap below, never automatically
 * from typing (§42) — this component does nothing on mount.
 *
 * Source defaults to "Trusted Scientific Sources" every time this
 * component mounts — the default never remembers a previous "My
 * Sources"/specific-book choice across searches, so a user can never be
 * surprised by their books being searched without having picked that
 * for *this* search (§Phase 4).
 */
export function KnowledgeLayerSearchPanel({ query, onFound }: KnowledgeLayerSearchPanelProps) {
  const [status, setStatus] = useState<'idle' | 'searching' | KnowledgeLayerLookupStatus>('idle')
  const [sourceMode, setSourceMode] = useState<KnowledgeSourceMode>('trusted')
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | undefined>(undefined)
  const [searchedSourceName, setSearchedSourceName] = useState<string | undefined>(undefined)

  const libraryItems = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const bookOptions: DropdownOption[] = libraryItems.map((item) => ({ value: item.id, label: item.title }))

  async function runSearch(mode: KnowledgeSourceMode) {
    setStatus('searching')
    const result = await lookupOrganismOnline(query, { mode, libraryItemId: mode === 'specific-source' ? selectedLibraryItemId : undefined })
    if (result.status === 'found' && result.profile) {
      onFound(result.profile.id)
      return
    }
    setSearchedSourceName(result.searchedSourceName)
    setStatus(result.status)
  }

  function handleSearch() {
    void runSearch(sourceMode)
  }

  /** §Phase 6 — the explicit fallback offered after a specific-book search comes up empty; never triggered automatically. */
  function handleSearchTrustedInstead() {
    setSourceMode('trusted')
    void runSearch('trusted')
  }

  const sourceSelector = (
    <div className="flex flex-col gap-2 sm:max-w-xs">
      <Dropdown
        label="Source"
        options={SOURCE_MODE_OPTIONS}
        value={sourceMode}
        onChange={(value) => {
          setSourceMode(value as KnowledgeSourceMode)
          if (value !== 'specific-source') setSelectedLibraryItemId(undefined)
        }}
      />
      {sourceMode === 'specific-source' &&
        (bookOptions.length > 0 ? (
          <Dropdown
            label="Book"
            options={bookOptions}
            value={selectedLibraryItemId}
            onChange={setSelectedLibraryItemId}
            placeholder="Choose a book…"
          />
        ) : (
          <p className="font-body text-micro text-ink-tertiary">No books in your Library yet — add one from the Library tab first.</p>
        ))}
    </div>
  )

  if (status === 'searching') {
    const searchingLabel =
      sourceMode === 'trusted' ? 'Searching trusted scientific sources…' : sourceMode === 'my-sources' ? 'Searching your sources…' : 'Searching this source…'
    return <EmptyState icon={<Globe size={32} />} title={searchingLabel} description={`Looking up “${query}”.`} />
  }

  if (status === 'offline') {
    return (
      <EmptyState
        icon={<WifiSlash size={32} />}
        title="You're offline"
        description="Trusted scientific sources need a connection. Your curated and saved organisms still work offline."
        action={
          <Button variant="secondary" size="small" onClick={handleSearch}>
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
        title="Couldn't retrieve this organism right now"
        description="Something went wrong reaching trusted scientific sources."
        action={
          <Button variant="secondary" size="small" onClick={handleSearch}>
            Try again
          </Button>
        }
      />
    )
  }

  if (status === 'timed-out') {
    return (
      <EmptyState
        icon={<WarningCircle size={32} />}
        title="Search is taking longer than expected"
        description="Your library may be large, or a document is slow to read on this device. It's safe to try again."
        action={
          <Button variant="secondary" size="small" onClick={handleSearch}>
            Try again
          </Button>
        }
      />
    )
  }

  if (status === 'not-found-in-source') {
    return (
      <div className="flex flex-col gap-4">
        {sourceSelector}
        <EmptyState
          icon={<Books size={32} />}
          title="Cellfie couldn't find enough information in this source"
          description={searchedSourceName ? `“${query}” wasn't found in ${searchedSourceName}.` : `“${query}” wasn't found in your selected source(s).`}
          action={
            <Button variant="secondary" size="small" onClick={handleSearchTrustedInstead}>
              Search trusted scientific sources instead
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <EmptyState
        title="No organisms found"
        description={`Trusted scientific sources didn't have reliable information for “${query}” either. This doesn't mean the organism doesn't exist scientifically — just that it isn't in Cellfie's library yet.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {sourceSelector}
      <EmptyState
        icon={<Globe size={32} />}
        title="Not in your local library"
        description={`“${query}” isn't part of Cellfie's curated organisms yet.`}
        action={
          <Button
            variant="secondary"
            size="small"
            disabled={sourceMode === 'specific-source' && !selectedLibraryItemId}
            onClick={handleSearch}
          >
            {sourceMode === 'trusted' ? 'Search trusted scientific sources' : sourceMode === 'my-sources' ? 'Search my sources' : 'Search this source'}
          </Button>
        }
      />
    </div>
  )
}
