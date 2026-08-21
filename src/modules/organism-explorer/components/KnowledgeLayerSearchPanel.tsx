import { useState } from 'react'
import { Globe, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/shared/components'
import { lookupOrganismOnline, type KnowledgeLayerLookupStatus } from '@/core/organisms'

interface KnowledgeLayerSearchPanelProps {
  query: string
  onFound: (organismId: string) => void
}

/**
 * Knowledge Layer Integration §2, §19, §20, §42. Shown only when a
 * search finds nothing in the curated local library AND the query
 * looks like it could be an organism name (never for a filter/category
 * phrase — see `looksLikeOrganismQuery`). Retrieval only ever happens
 * from the explicit tap below, never automatically from typing (§42) —
 * this component does nothing on mount.
 */
export function KnowledgeLayerSearchPanel({ query, onFound }: KnowledgeLayerSearchPanelProps) {
  const [status, setStatus] = useState<'idle' | 'searching' | KnowledgeLayerLookupStatus>('idle')

  async function handleSearch() {
    setStatus('searching')
    const result = await lookupOrganismOnline(query)
    if (result.status === 'found' && result.profile) {
      onFound(result.profile.id)
      return
    }
    setStatus(result.status)
  }

  if (status === 'searching') {
    return <EmptyState icon={<Globe size={32} />} title="Searching trusted scientific sources…" description={`Looking up “${query}”.`} />
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

  if (status === 'not-found') {
    return (
      <EmptyState
        title="No organisms found"
        description={`Trusted scientific sources didn't have reliable information for “${query}” either. This doesn't mean the organism doesn't exist scientifically — just that it isn't in Cellfie's library yet.`}
      />
    )
  }

  return (
    <EmptyState
      icon={<Globe size={32} />}
      title="Not in your local library"
      description={`“${query}” isn't part of Cellfie's curated organisms yet.`}
      action={
        <Button variant="secondary" size="small" onClick={handleSearch}>
          Search trusted scientific sources
        </Button>
      }
    />
  )
}
