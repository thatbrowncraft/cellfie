import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Link, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { SearchField, EmptyState, Button } from '@/shared/components'
import type { Concept, ConceptRelation } from '@/core/db'
import {
  addConceptRelation,
  dedupeByAbbreviation,
  fetchOnlineRelated,
  findCandidateConceptsFromKnownPages,
  isLikelyOnline,
  promoteConceptCandidate,
  removeConceptRelation,
  verifyCandidateExists
} from '@/core/concepts'

export interface RelatedConceptEntry {
  concept: Concept
  relation: ConceptRelation
}

/**
 * Concept Hub Quality Pass §1 — a single, unified shape for every
 * candidate shown in "Suggested concepts", whether it came from an
 * online reference lookup or from text mined on this concept's own
 * source pages. Both kinds must pass the same scientific-verification
 * bar before a candidate is ever constructed, so by the time something
 * is a `VerifiedSuggestion` it's already earned its place — there is no
 * separate "unverified" tier anymore.
 */
interface VerifiedSuggestion {
  key: string
  displayText: string
  sourceLabel: string
  evidencePages: { libraryItemId: string; pageNumber: number }[]
}

interface RelatedConceptsPanelProps {
  concept: Concept
  /** User-created (`origin: 'manual'`) connections only — Concept Hub Refinement §5. Already filtered at the source in ConceptDetailPage.tsx; graph.ts's own independent query applies the same filter for Mind Map. */
  relatedEntries: RelatedConceptEntry[]
  /** Whether this concept has any page-anchored PDF source at all — distinguishes "we looked and found nothing" from "no source pages to look at yet". */
  hasPdfPageSources: boolean
  allConcepts: Concept[]
}

export function RelatedConceptsPanel({ concept, relatedEntries, hasPdfPageSources, allConcepts }: RelatedConceptsPanelProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [promotingKey, setPromotingKey] = useState<string | undefined>(undefined)
  const [suggestions, setSuggestions] = useState<VerifiedSuggestion[] | undefined>(undefined)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingStage, setLoadingStage] = useState<'online' | 'source' | 'verifying' | undefined>(undefined)
  const [verificationUnavailable, setVerificationUnavailable] = useState(false)

  // Concept Hub Refinement §5 — "My Connections" is now the ONLY thing
  // this panel's main list ever shows: relationships the person
  // explicitly created. `relatedEntries` is already filtered to
  // `origin === 'manual'` at its source (ConceptDetailPage.tsx), so
  // this is just the identity — kept as its own name so the JSX below
  // still reads clearly.
  const manualEntries = relatedEntries
  const relatedIds = useMemo(() => new Set(relatedEntries.map((e) => e.concept.id)), [relatedEntries])

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allConcepts
      .filter((c) => c.id !== concept.id && !relatedIds.has(c.id))
      .filter((c) => c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [query, allConcepts, concept.id, relatedIds])

  async function handleAdd(otherId: string) {
    await addConceptRelation(concept.id, otherId)
    setQuery('')
    setAdding(false)
  }

  const existingNameKeys = useMemo(
    () => new Set(allConcepts.flatMap((c) => [c.normalizedName, ...c.aliases.map((a) => a.trim().toLowerCase())])),
    [allConcepts]
  )

  /**
   * Concept Hub Quality Pass §1 — the ONE "Suggested concepts" pipeline.
   * Replaces the old two-panel split (a high-confidence online list plus
   * a separate "unverified terms" list shown with no scientific gate at
   * all when offline). Now every candidate — whether it comes from an
   * online reference lookup or from text mined on this concept's own
   * source pages — must clear the same bar before it is ever placed in
   * state:
   *
   *   1. Online-related lookups (`fetchOnlineRelated`) are already
   *      source-attributed to a real page, so they pass as-is.
   *   2. Page-text-mined phrases (`findCandidateConceptsFromKnownPages`)
   *      are pre-filtered for OCR-fragment shapes (see extraction.ts),
   *      then EACH one must individually clear `verifyCandidateExists`
   *      (a real PubMed/general-reference hit) before it is added to the
   *      list. If the app is offline, text-mined candidates are not
   *      shown at all — a raw, unverified guess is worse than nothing.
   *   3. The combined, verified list is deduplicated by lexical
   *      abbreviation (`dedupeByAbbreviation`) so "Gram pos" and "Gram
   *      positive bacteria" never both appear.
   *
   * If nothing survives, the UI shows "No verified related concepts
   * found yet." — never an empty-looking dead end, and never a pile of
   * weak suggestions just to have something to show.
   */
  async function handleFindSuggestions() {
    setLoadingSuggestions(true)
    setSuggestions(undefined)
    setVerificationUnavailable(false)
    try {
      const collected: VerifiedSuggestion[] = []

      setLoadingStage('online')
      const online = await fetchOnlineRelated(concept.name)
      for (const item of online) {
        const key = item.title.trim().toLowerCase()
        if (existingNameKeys.has(key)) continue
        collected.push({ key, displayText: item.title, sourceLabel: item.sourceName, evidencePages: [] })
      }

      if (hasPdfPageSources) {
        setLoadingStage('source')
        const fromPages = await findCandidateConceptsFromKnownPages(concept)
        if (!isLikelyOnline()) {
          // Cannot verify right now — do not show raw, unverified
          // text-mined candidates. The online-sourced ones above (which
          // may have come from cache) can still stand on their own.
          setVerificationUnavailable(fromPages.length > 0)
        } else {
          setLoadingStage('verifying')
          for (const candidate of fromPages) {
            // Sequential, not Promise.all — this hits a public API and
            // shouldn't fire a burst of dozens of simultaneous requests.
            const verified = await verifyCandidateExists(candidate.displayText)
            if (!verified) continue
            collected.push({
              key: candidate.normalizedName,
              displayText: candidate.displayText,
              sourceLabel: 'your source pages',
              evidencePages: candidate.pages
            })
          }
        }
      }

      setSuggestions(dedupeByAbbreviation(collected, (s) => s.displayText))
    } finally {
      setLoadingSuggestions(false)
      setLoadingStage(undefined)
    }
  }

  async function handlePromoteSuggestion(suggestion: VerifiedSuggestion) {
    setPromotingKey(suggestion.key)
    try {
      await promoteConceptCandidate({
        name: suggestion.displayText,
        evidence: suggestion.evidencePages,
        relateToConceptId: concept.id
      })
      setSuggestions((prev) => prev?.filter((s) => s.key !== suggestion.key))
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
          {adding ? 'Cancel' : 'Add my connection'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2">
          <SearchField placeholder="Search concepts to connect…" onChange={setQuery} />
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

      {relatedEntries.length === 0 ? (
        <EmptyState
          title="No connections yet"
          description="Connect this concept to another concept to build your study network."
        />
      ) : (
        <>
          {manualEntries.length > 0 && (
            <div>
              <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">My connections</h4>
              <ul className="flex flex-wrap gap-2">
                {manualEntries.map(({ concept: c, relation }) => (
                  <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/concepts/${c.id}`)}
                      className="font-ui text-caption font-medium text-ink-primary hover:text-olive"
                    >
                      {c.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeConceptRelation(relation.id)}
                      aria-label={`Remove connection to ${c.name}`}
                      className="text-ink-tertiary hover:text-error"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <Globe size={14} aria-hidden />
            Suggested concepts
          </h4>
          {!suggestions && (
            <button
              type="button"
              onClick={() => void handleFindSuggestions()}
              disabled={loadingSuggestions}
              className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:no-underline"
            >
              <MagnifyingGlass size={14} />
              {loadingStage === 'online' && 'Checking online sources…'}
              {loadingStage === 'source' && 'Scanning your source pages…'}
              {loadingStage === 'verifying' && 'Verifying candidates…'}
              {!loadingStage && 'Find suggestions'}
            </button>
          )}
        </div>
        <p className="mb-3 font-ui text-caption text-ink-secondary">
          Scientifically verified concepts that may be useful to add to your study network — checked against
          reliable reference sources before they're shown. Adding one creates the concept and links it here as your
          own connection; nothing is added automatically.
        </p>

        {suggestions && suggestions.length === 0 && (
          <p className="mb-4 font-ui text-caption text-ink-tertiary">
            {verificationUnavailable
              ? 'No verified related concepts found yet. Some candidates were found in your source text but could not be verified while offline.'
              : 'No verified related concepts found yet.'}
          </p>
        )}

        {suggestions && suggestions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div>
                  <p className="font-ui text-body font-medium text-ink-primary">{s.displayText}</p>
                  <p className="font-ui text-micro text-ink-tertiary">Source: {s.sourceLabel}</p>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={promotingKey === s.key}
                  onClick={() => void handlePromoteSuggestion(s)}
                >
                  {promotingKey === s.key ? 'Adding…' : 'Add concept'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
