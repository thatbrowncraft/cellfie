import { useEffect, useMemo, useState } from 'react'
import { GitBranch, Plus, ShareNetwork } from '@phosphor-icons/react'
import { db, type Concept, type ConceptSource } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { buildKnowledgeGraph, runFullExtraction, type KnowledgeGraphData } from '@/core/concepts'
import { DashboardLayout } from '@/shared/layouts'
import { Button, Dropdown, EmptyState, SearchField, Tabs } from '@/shared/components'
import { ConceptCard } from './components/ConceptCard'
import { ConceptFormDialog } from './components/ConceptFormDialog'
import { ConceptGraphView } from './components/ConceptGraphView'

type FilterId = 'all' | 'recent' | 'most-referenced' | 'books' | 'notes' | 'highlights' | 'user-created'

const filterOptions: { value: FilterId; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: 'Recently used' },
  { value: 'most-referenced', label: 'Most referenced' },
  { value: 'books', label: 'Books' },
  { value: 'notes', label: 'Notes' },
  { value: 'highlights', label: 'Highlights' },
  { value: 'user-created', label: 'User-created' }
]

/**
 * Concept Explorer — Sprint 3 §6/§7/§18. Local, instant search over
 * name/aliases/tags; filters derived entirely from stored ConceptSource
 * rows (never hardcoded counts); manual "+ New Concept"; and a graph tab
 * built from `core/concepts/graph.ts`. Replaces the Sprint-2-era
 * placeholder tabs (Simple/I'm New/Scientific/Explorer) that previewed a
 * Learn module this sprint doesn't implement — Sprint 3 is scoped to the
 * deterministic Knowledge Layer described in the brief, not AI-authored
 * explanations.
 */
export function ConceptsPage() {
  const concepts = useLiveQuery<Concept[]>(() => db.concepts.toArray(), [], [])
  const sources = useLiveQuery<ConceptSource[]>(() => db.conceptSources.toArray(), [], [])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractMessage, setExtractMessage] = useState<string | undefined>(undefined)

  const sourceCountByConcept = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sources) map.set(s.conceptId, (map.get(s.conceptId) ?? 0) + 1)
    return map
  }, [sources])

  const sourceTypesByConcept = useMemo(() => {
    const map = new Map<string, Set<ConceptSource['sourceType']>>()
    for (const s of sources) {
      const set = map.get(s.conceptId) ?? new Set<ConceptSource['sourceType']>()
      set.add(s.sourceType)
      map.set(s.conceptId, set)
    }
    return map
  }, [sources])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = concepts.filter((c) => {
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)) || c.tags.some((t) => t.includes(q))
    })

    switch (filter) {
      case 'recent':
        list = [...list].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        break
      case 'most-referenced':
        list = [...list].sort((a, b) => (sourceCountByConcept.get(b.id) ?? 0) - (sourceCountByConcept.get(a.id) ?? 0))
        break
      case 'books':
        list = list.filter((c) => sourceTypesByConcept.get(c.id)?.has('pdf') || sourceTypesByConcept.get(c.id)?.has('metadata'))
        break
      case 'notes':
        list = list.filter((c) => sourceTypesByConcept.get(c.id)?.has('note'))
        break
      case 'highlights':
        list = list.filter((c) => sourceTypesByConcept.get(c.id)?.has('highlight'))
        break
      case 'user-created':
        list = list.filter((c) => c.manuallyCreated)
        break
      default:
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }

    return list
  }, [concepts, query, filter, sourceCountByConcept, sourceTypesByConcept])

  async function handleRebuild() {
    setExtracting(true)
    setExtractMessage(undefined)
    try {
      const result = await runFullExtraction()
      setExtractMessage(
        result.conceptsCreated + result.conceptsUpdated === 0
          ? 'No new concepts found in your tags or highlights.'
          : `Found ${result.conceptsCreated} new concept${result.conceptsCreated === 1 ? '' : 's'} and linked ${result.sourcesLinked} source${result.sourcesLinked === 1 ? '' : 's'}.`
      )
    } finally {
      setExtracting(false)
    }
  }

  const listContent =
    concepts.length === 0 ? (
      <EmptyState
        icon={<GitBranch size={32} />}
        title="No concepts yet"
        description="Your knowledge map is empty. Add concepts from your books, highlights, or notes to start building it."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              New concept
            </Button>
            <Button variant="secondary" onClick={() => void handleRebuild()} disabled={extracting}>
              {extracting ? 'Scanning your library…' : 'Build from tags & highlights'}
            </Button>
          </div>
        }
      />
    ) : filtered.length === 0 ? (
      <EmptyState title="Nothing matches" description="Try a different search term or filter." />
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {filtered.map((concept) => (
          <ConceptCard key={concept.id} concept={concept} sourceCount={sourceCountByConcept.get(concept.id) ?? 0} />
        ))}
      </div>
    )

  return (
    <DashboardLayout title="Concepts" subtitle="Every concept here traces back to something you actually read, highlighted, or wrote.">
      <div className="col-span-full flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <SearchField placeholder="Search concepts…" onChange={setQuery} />
          </div>
          <Dropdown
            label="Filter"
            options={filterOptions.map((f) => ({ value: f.value, label: f.label }))}
            value={filter}
            onChange={(v) => setFilter(v as FilterId)}
          />
          <Button variant="secondary" onClick={() => void handleRebuild()} disabled={extracting}>
            {extracting ? 'Scanning…' : 'Build from tags & highlights'}
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New concept
          </Button>
        </div>
        {extractMessage && <p className="font-ui text-caption text-ink-secondary">{extractMessage}</p>}

        <Tabs
          tabs={[
            { id: 'list', label: `List${concepts.length ? ` (${concepts.length})` : ''}`, content: listContent },
            { id: 'graph', label: 'Graph', content: <GraphTab /> }
          ]}
        />
      </div>

      <ConceptFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </DashboardLayout>
  )
}

/** Lazily builds the whole-library graph only once its tab is actually shown (§21 — no reason to compute it on every Concepts page visit). */
function GraphTab() {
  const [data, setData] = useState<KnowledgeGraphData>({ nodes: [], edges: [] })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void buildKnowledgeGraph().then((result) => {
      if (!cancelled) {
        setData(result)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded) {
    return (
      <EmptyState
        icon={<ShareNetwork size={32} />}
        title="Loading graph…"
        description="Building the graph from your concepts and their sources."
      />
    )
  }

  return <ConceptGraphView data={data} />
}
