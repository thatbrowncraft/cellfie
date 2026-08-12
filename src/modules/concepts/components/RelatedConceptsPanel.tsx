import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowSquareOut, Flask, Globe, Link, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { SearchField, EmptyState, Button } from '@/shared/components'
import type { Concept, ConceptRelation } from '@/core/db'
import {
  addConceptRelation,
  fetchOnlineRelated,
  findCandidateConceptsFromKnownPages,
  isLikelyOnline,
  promoteConceptCandidate,
  removeConceptRelation,
  verifyCandidateExists,
  type OnlineRelatedItem,
  type SourceCandidate
} from '@/core/concepts'

export interface RelatedConceptEntry {
  concept: Concept
  relation: ConceptRelation
}

interface RelatedConceptsPanelProps {
  concept: Concept
  /** Every real relationship this concept has — both origins, one source of truth (Concept 2.0 Phase 2). */
  relatedEntries: RelatedConceptEntry[]
  /** True while this concept's other concepts are being checked for real scientific-literature evidence (core/concepts/service.ts's discoverScientificRelations). */
  discoveringScience: boolean
  /** Whether this concept has any page-anchored PDF source at all — distinguishes "we looked and found nothing" from "no source pages to look at yet". */
  hasPdfPageSources: boolean
  allConcepts: Concept[]
}

export function RelatedConceptsPanel({
  concept,
  relatedEntries,
  discoveringScience,
  hasPdfPageSources,
  allConcepts
}: RelatedConceptsPanelProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [sourceCandidates, setSourceCandidates] = useState<SourceCandidate[] | undefined>(undefined)
  const [scanningSources, setScanningSources] = useState(false)
  const [verifyingSources, setVerifyingSources] = useState(false)
  const [promotingKey, setPromotingKey] = useState<string | undefined>(undefined)
  const [onlineSuggestions, setOnlineSuggestions] = useState<OnlineRelatedItem[] | undefined>(undefined)
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [onlinePromotingTitle, setOnlinePromotingTitle] = useState<string | undefined>(undefined)

  // Concept 2.0 Phase 2 — "Do NOT consider two concepts related merely
  // because they occur on the same PDF page / share random words." Real
  // relationships only, split by origin so the UI never implies a
  // manual connection is an established scientific fact (§7).
  const scientificEntries = useMemo(
    () => relatedEntries.filter((e) => e.relation.origin === 'scientific'),
    [relatedEntries]
  )
  const manualEntries = useMemo(() => relatedEntries.filter((e) => e.relation.origin !== 'scientific'), [relatedEntries])
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

  // Knowledge Model Correction §9/§10/§11 — explicit, on-demand only:
  // reads this concept's own known source pages for candidate phrases
  // that aren't concepts yet. Nothing here writes anything until the
  // person clicks "Add concept" on a specific suggestion. Each raw
  // text-mined candidate is weakly verified against the same
  // Wikipedia-free source hierarchy used elsewhere (does PubMed or a
  // general reference actually have something for this phrase?) before
  // it's shown — drops OCR fragments and sentence fragments, though a
  // candidate that's a real reference entry but not actually a
  // scientific concept can still slip through; "Suggested scientific
  // concepts" below is the higher-confidence source and should usually
  // be tried first.
  async function handleFindSourceCandidates() {
    setScanningSources(true)
    setSourceCandidates(undefined)
    try {
      const found = await findCandidateConceptsFromKnownPages(concept)
      if (!isLikelyOnline()) {
        setSourceCandidates(found)
        return
      }
      setScanningSources(false)
      setVerifyingSources(true)
      const verified: SourceCandidate[] = []
      for (const candidate of found) {
        // Sequential, not Promise.all — this hits a public API and
        // shouldn't fire a burst of dozens of simultaneous requests.
        if (await verifyCandidateExists(candidate.displayText)) verified.push(candidate)
      }
      setSourceCandidates(verified)
    } finally {
      setScanningSources(false)
      setVerifyingSources(false)
    }
  }

  // Concept 2.0 §6/§14 — concepts reliable online sources associate with
  // this one that AREN'T in the person's library yet. Presented as
  // suggestions only; nothing is created until "Add concept" is clicked,
  // and nothing is auto-added in bulk (§6: "prevents the Concepts
  // library from being filled with hundreds of unwanted entries").
  async function handleFindOnlineSuggestions() {
    setLoadingOnline(true)
    try {
      const found = await fetchOnlineRelated(concept.name)
      setOnlineSuggestions(found.filter((f) => !existingNameKeys.has(f.title.trim().toLowerCase())))
    } finally {
      setLoadingOnline(false)
    }
  }

  async function handlePromoteOnlineSuggestion(item: OnlineRelatedItem) {
    setOnlinePromotingTitle(item.title)
    try {
      await promoteConceptCandidate({ name: item.title, evidence: [], relateToConceptId: concept.id })
      setOnlineSuggestions((prev) => prev?.filter((s) => s.title !== item.title))
    } finally {
      setOnlinePromotingTitle(undefined)
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

      {discoveringScience && (
        <p className="font-ui text-caption text-ink-tertiary">Checking your other concepts for verified scientific relationships…</p>
      )}

      {relatedEntries.length === 0 && !discoveringScience ? (
        <EmptyState
          title="No verified relationship found among your current concepts"
          description="That doesn't mean none exist — check &ldquo;Suggested scientific concepts&rdquo; below, or add a connection of your own."
        />
      ) : (
        <>
          {scientificEntries.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                <Flask size={13} aria-hidden />
                Scientific connections
              </h4>
              <ul className="flex flex-col gap-2">
                {scientificEntries.map(({ concept: c, relation }) => (
                  <li key={c.id} className="rounded-md border border-border bg-surface px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/concepts/${c.id}`)}
                        className="text-left font-ui text-body font-medium text-ink-primary hover:text-olive"
                      >
                        {c.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeConceptRelation(relation.id)}
                        aria-label={`Remove connection to ${c.name}`}
                        className="shrink-0 text-ink-tertiary hover:text-error"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {relation.relationType && (
                      <p className="mt-1 font-ui text-caption text-ink-secondary">{relation.relationType}</p>
                    )}
                    {relation.evidence && (
                      <p className="mt-0.5 whitespace-pre-line font-ui text-caption italic text-ink-tertiary">
                        "{relation.evidence}"
                      </p>
                    )}
                    {relation.sourceUrl && (
                      <a
                        href={relation.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
                      >
                        Source: {relation.sourceName}
                        <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
            Suggested scientific concepts
          </h4>
          {!onlineSuggestions && (
            <button
              type="button"
              onClick={() => void handleFindOnlineSuggestions()}
              disabled={loadingOnline}
              className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:no-underline"
            >
              <MagnifyingGlass size={14} />
              {loadingOnline ? 'Checking online sources…' : 'Find suggestions'}
            </button>
          )}
        </div>
        <p className="mb-3 font-ui text-caption text-ink-secondary">
          Reliable online reference sources associate these with "{concept.name}" — not concepts in your library yet.
          Adding one creates the concept and links it here as your own connection; nothing is added automatically.
        </p>

        {onlineSuggestions && onlineSuggestions.length === 0 && (
          <p className="mb-4 font-ui text-caption text-ink-tertiary">
            {isLikelyOnline()
              ? 'No strong related concepts found.'
              : 'Online knowledge unavailable. Your local library and saved knowledge are still available.'}
          </p>
        )}

        {onlineSuggestions && onlineSuggestions.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {onlineSuggestions.map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div>
                  <p className="font-ui text-body font-medium text-ink-primary">{item.title}</p>
                  <p className="font-ui text-micro text-ink-tertiary">Source: {item.sourceName}</p>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={onlinePromotingTitle === item.title}
                  onClick={() => void handlePromoteOnlineSuggestion(item)}
                >
                  {onlinePromotingTitle === item.title ? 'Adding…' : 'Add concept'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Unverified terms found in your source text
          </h4>
          {!sourceCandidates && (
            <button
              type="button"
              onClick={() => void handleFindSourceCandidates()}
              disabled={scanningSources || verifyingSources || !hasPdfPageSources}
              className="flex items-center gap-1.5 font-ui text-caption font-medium text-olive hover:underline disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:no-underline"
            >
              <MagnifyingGlass size={14} />
              {scanningSources ? 'Scanning your source pages…' : verifyingSources ? 'Checking online sources…' : 'Find related concepts'}
            </button>
          )}
        </div>
        <p className="mb-3 font-ui text-caption text-ink-secondary">
          Repeated capitalized terms from this concept's own source pages, weakly checked against online reference
          sources to drop obvious junk. Not verified as scientifically meaningful — review before adding. Nothing
          here is created automatically.
        </p>

        {sourceCandidates && sourceCandidates.length === 0 && (
          <p className="font-ui text-caption text-ink-tertiary">No strong related concepts found.</p>
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
