import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { SearchField, EmptyState, Button } from '@/shared/components'
import type { Concept, ConceptRelation, LibraryItem } from '@/core/db'
import {
  addConceptRelation,
  findCandidateConceptsFromKnownPages,
  promoteConceptCandidate,
  removeConceptRelation,
  type CoOccurrenceMatch,
  type SourceCandidate
} from '@/core/concepts'

interface RelatedConceptsPanelProps {
  concept: Concept
  relatedConcepts: Concept[]
  /** Concepts sharing a tag with this one but with no explicit relation yet — shown as suggestions (§10: "shared tags" is a reliable relationship source). */
  sharedTagSuggestions: Concept[]
  /** Concepts that share at least one book+page ConceptSource with this one (Sprint 3 Correction §5A/§7) — the deterministic "found in your local material" relationships. */
  coOccurring: CoOccurrenceMatch[]
  /** Whether this concept has any page-anchored PDF source at all — distinguishes "we looked at your source pages and found nothing to connect" from "no source pages to look at yet" (Knowledge Graph Correction §21). */
  hasPdfPageSources: boolean
  itemsById: Map<string, LibraryItem>
  relations: ConceptRelation[]
  allConcepts: Concept[]
}

export function RelatedConceptsPanel({
  concept,
  relatedConcepts,
  sharedTagSuggestions,
  coOccurring,
  hasPdfPageSources,
  itemsById,
  relations,
  allConcepts
}: RelatedConceptsPanelProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [sourceCandidates, setSourceCandidates] = useState<SourceCandidate[] | undefined>(undefined)
  const [scanningSources, setScanningSources] = useState(false)
  const [promotingKey, setPromotingKey] = useState<string | undefined>(undefined)

  const relatedIds = new Set(relatedConcepts.map((c) => c.id))
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allConcepts
      .filter((c) => c.id !== concept.id && !relatedIds.has(c.id))
      .filter((c) => c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [query, allConcepts, concept.id, relatedIds])

  function relationIdFor(otherId: string): string | undefined {
    const [a, b] = [concept.id, otherId].sort()
    return relations.find((r) => r.conceptAId === a && r.conceptBId === b)?.id
  }

  async function handleAdd(otherId: string) {
    await addConceptRelation(concept.id, otherId)
    setQuery('')
    setAdding(false)
  }

  /** "Prescott's Microbiology · 3 shared pages" style summary (§7), grouped per book since a co-occurrence can span more than one. */
  function sourceSummary(match: CoOccurrenceMatch): string {
    const byBook = new Map<string, number>()
    for (const p of match.sharedPages) {
      const title = itemsById.get(p.libraryItemId)?.title ?? 'Unlinked book'
      byBook.set(title, (byBook.get(title) ?? 0) + 1)
    }
    return Array.from(byBook.entries())
      .map(([title, count]) => `${title} · ${count} shared page${count === 1 ? '' : 's'}`)
      .join(', ')
  }

  const coOccurringNotAlreadyRelated = coOccurring.filter((m) => !relatedIds.has(m.concept.id))

  // Knowledge Model Correction §9/§10/§11 — explicit, on-demand only:
  // reads this concept's own known source pages for candidate phrases
  // that aren't concepts yet. Nothing here writes anything until the
  // person clicks "Add concept" on a specific suggestion.
  async function handleFindSourceCandidates() {
    setScanningSources(true)
    try {
      const found = await findCandidateConceptsFromKnownPages(concept)
      setSourceCandidates(found)
    } finally {
      setScanningSources(false)
    }
  }

  async function handlePromoteCandidate(candidate: SourceCandidate) {
    setPromotingKey(candidate.normalizedName)
    try {
      await promoteConceptCandidate({
        name: candidate.displayText,
        evidence: candidate.pages,
        relateToConceptId: concept.id
      })
      setSourceCandidates((prev) => prev?.filter((c) => c.normalizedName !== candidate.normalizedName))
    } finally {
      setPromotingKey(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-h3 font-medium text-ink-primary">Related concepts</h3>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline"
        >
          <Plus size={15} />
          {adding ? 'Cancel' : 'Add related concept'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2">
          <SearchField placeholder="Search concepts to relate…" onChange={setQuery} />
          {query && candidates.length === 0 && (
            <p className="font-ui text-caption text-ink-tertiary">No matching concepts.</p>
          )}
          {candidates.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-border bg-surface p-1">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void handleAdd(c.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left font-ui text-body text-ink-primary hover:bg-surface-raised"
                  >
                    <Link size={14} className="text-ink-tertiary" aria-hidden />
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {relatedConcepts.length === 0 && coOccurringNotAlreadyRelated.length === 0 ? (
        <EmptyState
          title="No related concepts yet"
          description={
            hasPdfPageSources
              ? 'Insufficient local source text available for deterministic relationship extraction. This concept\u2019s source pages didn\u2019t contain another recognizable concept — add a manual relationship if you know of one.'
              : "Once this concept has source pages and shares one with another concept — or you add a manual relationship — they'll show up here and in the mind map."
          }
        />
      ) : (
        <>
          {relatedConcepts.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {relatedConcepts.map((c) => {
                const relationId = relationIdFor(c.id)
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/concepts/${c.id}`)}
                      className="font-ui text-caption font-medium text-ink-primary hover:text-olive"
                    >
                      {c.name}
                    </button>
                    {relationId && (
                      <button
                        type="button"
                        onClick={() => void removeConceptRelation(relationId)}
                        aria-label={`Remove relation to ${c.name}`}
                        className="text-ink-tertiary hover:text-error"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {coOccurringNotAlreadyRelated.length > 0 && (
            <div>
              <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                Found together in your sources
              </h4>
              <ul className="flex flex-col gap-2">
                {coOccurringNotAlreadyRelated.map((match) => (
                  <li key={match.concept.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/concepts/${match.concept.id}`)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-surface-raised"
                    >
                      <span className="font-ui text-body font-medium text-ink-primary">{match.concept.name}</span>
                      <span className="font-ui text-micro text-ink-tertiary">{sourceSummary(match)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {sharedTagSuggestions.length > 0 && (
        <div>
          <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Shares a tag with
          </h4>
          <ul className="flex flex-wrap gap-2">
            {sharedTagSuggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/concepts/${c.id}`)}
                  className="rounded-full bg-surface-raised px-3 py-1.5 font-ui text-caption text-ink-secondary hover:text-ink-primary"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Related concepts found in your sources
          </h4>
          {!sourceCandidates && (
            <button
              type="button"
              onClick={() => void handleFindSourceCandidates()}
              disabled={scanningSources || !hasPdfPageSources}
              className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:no-underline"
            >
              <MagnifyingGlass size={14} />
              {scanningSources ? 'Scanning your source pages…' : 'Find related concepts'}
            </button>
          )}
        </div>
        <p className="mb-3 font-ui text-caption text-ink-secondary">
          These are candidate terms found on this concept's own source pages — not concepts yet. Adding one is
          explicit; nothing here is created automatically.
        </p>

        {sourceCandidates && sourceCandidates.length === 0 && (
          <p className="font-ui text-caption text-ink-tertiary">
            No additional candidate terms found on this concept's source pages.
          </p>
        )}

        {sourceCandidates && sourceCandidates.length > 0 && (
          <ul className="flex flex-col gap-2">
            {sourceCandidates.map((candidate) => (
              <li
                key={candidate.normalizedName}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div>
                  <p className="font-ui text-body font-medium text-ink-primary">{candidate.displayText}</p>
                  <p className="font-ui text-micro text-ink-tertiary">
                    {candidate.pages.length} shared page{candidate.pages.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={promotingKey === candidate.normalizedName}
                  onClick={() => void handlePromoteCandidate(candidate)}
                >
                  {promotingKey === candidate.normalizedName ? 'Adding…' : 'Add concept'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
