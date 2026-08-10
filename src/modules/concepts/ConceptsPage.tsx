import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, GitBranch, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { db, type Concept, type ConceptSource } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import {
  findConceptByNameOrAlias,
  promoteConceptCandidate,
  searchLibraryForTerm,
  type LibraryTermMatch
} from '@/core/concepts'
import { DashboardLayout } from '@/shared/layouts'
import { Button, Dropdown, EmptyState, SearchField } from '@/shared/components'
import { ConceptCard } from './components/ConceptCard'
import { ConceptFormDialog } from './components/ConceptFormDialog'

type FilterId = 'all' | 'recent' | 'most-referenced' | 'books' | 'notes' | 'highlights'

const filterOptions: { value: FilterId; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: 'Recently used' },
  { value: 'most-referenced', label: 'Most referenced' },
  { value: 'books', label: 'Books' },
  { value: 'notes', label: 'Notes' },
  { value: 'highlights', label: 'Highlights' }
]

const SEARCH_DEBOUNCE_MS = 500

/**
 * Concept Explorer — Knowledge Model Correction. "Concepts are
 * USER-SELECTED objects": the list below shows only concepts the person
 * has explicitly created or promoted (every remaining concept is
 * `manuallyCreated: true` — see `runAutoConceptCleanup`). Typing a term
 * that isn't a concept yet doesn't just come up empty: it triggers a
 * read-only search of the local PDF library (`searchLibraryForTerm`) and
 * offers an explicit "Add to Concepts" action — the only way PDF text
 * becomes a Concept record now, alongside "+ New Concept" itself. The
 * previous whole-library auto-generated Graph tab has been removed
 * (§15) — it was showing exactly the kind of noise this correction
 * exists to eliminate.
 */
export function ConceptsPage() {
  const navigate = useNavigate()
  const concepts = useLiveQuery<Concept[]>(() => db.concepts.toArray(), [], [])
  const sources = useLiveQuery<ConceptSource[]>(() => db.conceptSources.toArray(), [], [])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [createOpen, setCreateOpen] = useState(false)

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
      default:
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }

    return list
  }, [concepts, query, filter, sourceCountByConcept, sourceTypesByConcept])

  const listContent =
    concepts.length === 0 ? (
      <EmptyState
        icon={<GitBranch size={32} />}
        title="No concepts yet."
        description="Build your personal knowledge map by searching your library or adding concepts manually."
        action={
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New concept
          </Button>
        }
      />
    ) : filtered.length === 0 && query.trim().length < 2 ? (
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
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New concept
          </Button>
        </div>

        {query.trim().length >= 2 && <LibrarySearchPanel query={query} onOpenConcept={(id) => navigate(`/concepts/${id}`)} />}

        {listContent}
      </div>

      <ConceptFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </DashboardLayout>
  )
}

/**
 * Knowledge Model Correction §3/§5 — the "search, then explicitly
 * promote" panel. Debounced so it doesn't open every PDF in the library
 * on every keystroke; a match here is never written to the database
 * until the person clicks "Add to Concepts".
 */
function LibrarySearchPanel({ query, onOpenConcept }: { query: string; onOpenConcept: (conceptId: string) => void }) {
  const [results, setResults] = useState<LibraryTermMatch[] | undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [existing, setExisting] = useState<Concept | undefined>(undefined)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSearching(true)
    setResults(undefined)

    const handle = setTimeout(() => {
      void Promise.all([searchLibraryForTerm(query), findConceptByNameOrAlias(query)]).then(([matches, existingConcept]) => {
        if (cancelled) return
        setResults(matches)
        setExisting(existingConcept)
        setSearching(false)
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  async function handleAdd() {
    if (!results || results.length === 0) return
    setPromoting(true)
    try {
      const evidence = results.flatMap((m) => m.pages.map((pageNumber) => ({ libraryItemId: m.item.id, pageNumber })))
      const concept = await promoteConceptCandidate({ name: query.trim(), evidence })
      onOpenConcept(concept.id)
    } finally {
      setPromoting(false)
    }
  }

  const totalPages = results?.reduce((sum, m) => sum + m.pages.length, 0) ?? 0

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        <MagnifyingGlass size={14} />
        Found in your library
      </div>

      {searching ? (
        <p className="font-ui text-caption text-ink-secondary">Searching “{query.trim()}”…</p>
      ) : !results || results.length === 0 ? (
        <p className="font-ui text-caption text-ink-secondary">
          No occurrences of “{query.trim()}” found in your local library text.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-body text-body text-ink-primary">
                “{query.trim()}” found in {results.length} book{results.length === 1 ? '' : 's'} · {totalPages} page
                {totalPages === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {results.slice(0, 5).map((m) => (
                  <li key={m.item.id} className="flex items-center gap-1.5 font-ui text-micro text-ink-tertiary">
                    <BookOpen size={12} />
                    {m.item.title} · {m.pages.length} page{m.pages.length === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </div>
            {existing ? (
              <Button variant="secondary" size="small" onClick={() => onOpenConcept(existing.id)}>
                Open concept
              </Button>
            ) : (
              <Button size="small" disabled={promoting} onClick={() => void handleAdd()}>
                {promoting ? 'Adding…' : 'Add to Concepts'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
