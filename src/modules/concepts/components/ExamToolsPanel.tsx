import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Ruler } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components'
import { useBreakpointClass } from '@/shared/hooks/useMediaQuery'
import type { Concept, ConceptRelation } from '@/core/db'
import { fetchOnlineKnowledge, type ExamTools, type OnlineKnowledgeSection } from '@/core/concepts'

interface ExamToolsPanelProps {
  concept: Concept
  examTools: ExamTools
  relatedEntries: { concept: Concept; relation: ConceptRelation }[]
  onlineSections: OnlineKnowledgeSection[]
}

/**
 * Exam Focus study-mode content (mounted inside the Learn tab, not on
 * its own Level-1 tab — see ConceptDetailPage.tsx). Every block below
 * comes straight from `buildExamTools` (core/concepts/examTools.ts —
 * real source excerpts, never invented) or is the person's own choice
 * of what to compare. A block that has nothing real to show simply
 * doesn't render, matching every other tab in this app. Memory aid is
 * intentionally NOT part of this component — see
 * components/MemoryAidCard.tsx, mounted independently in the Learn tab
 * so it never depends on Exam Focus content existing.
 *
 * Third Refinement §14: the old "Quick questions" block ("What is X,
 * according to <source>?") is gone — it read as a source lookup, not
 * exam prep. This is the fallback panel for concepts without a curated
 * lesson yet; a curated lesson's own hand-authored possible-questions
 * (real conceptual questions) render separately, via
 * CuratedExamFocusView — see ConceptDetailPage.tsx.
 */
export function ExamToolsPanel({ concept, examTools, relatedEntries, onlineSections }: ExamToolsPanelProps) {
  const hasAnything = examTools.keyPoints.length > 0 || examTools.importantValues.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!hasAnything && relatedEntries.length === 0 && (
        <EmptyState
          icon={<ListChecks size={32} />}
          title="Not enough source material yet"
          description="Once the Scientific overview on the Learn tab has real content for this concept, exam points will build themselves from it."
        />
      )}

      {examTools.keyPoints.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <ListChecks size={14} aria-hidden />
            Key exam points
          </h3>
          <ul className="flex flex-col gap-3">
            {examTools.keyPoints.map((point, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="font-body text-body text-ink-primary">{point.text}</p>
                <span className="font-ui text-micro text-ink-tertiary">Source: {point.sourceName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {examTools.importantValues.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <Ruler size={14} aria-hidden />
            Important values
          </h3>
          <ul className="flex flex-col gap-3">
            {examTools.importantValues.map((v, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="font-body text-body text-ink-primary">{v.text}</p>
                <span className="font-ui text-micro text-ink-tertiary">Source: {v.sourceName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ComparePanel concept={concept} onlineSections={onlineSections} relatedEntries={relatedEntries} />
    </div>
  )
}

/**
 * §10 "Compare". Deliberately doesn't try to auto-detect which pairs are
 * commonly confused (see examTools.ts's header comment for why) — the
 * person picks a concept they're already connected to, and the two
 * concepts' own real Scientific overview sections render side by side so
 * they can draw the comparison themselves.
 */
function ComparePanel({
  concept,
  onlineSections,
  relatedEntries
}: {
  concept: Concept
  onlineSections: OnlineKnowledgeSection[]
  relatedEntries: { concept: Concept; relation: ConceptRelation }[]
}) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState('')
  const [otherSections, setOtherSections] = useState<OnlineKnowledgeSection[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  // PWA layout-isolation fix — was `grid-cols-1 sm:grid-cols-2`; see
  // `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass({
    mobile: 'grid-cols-1',
    tablet: 'grid-cols-2',
    desktop: 'grid-cols-2',
    wide: 'grid-cols-2'
  })

  if (relatedEntries.length === 0) return null

  async function handleSelect(id: string) {
    setSelectedId(id)
    setOtherSections(undefined)
    const other = relatedEntries.find((e) => e.concept.id === id)?.concept
    if (!other) return
    setLoading(true)
    try {
      setOtherSections(await fetchOnlineKnowledge(other.name))
    } finally {
      setLoading(false)
    }
  }

  const other = relatedEntries.find((e) => e.concept.id === selectedId)?.concept

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Compare</h3>
      <select
        value={selectedId}
        onChange={(e) => void handleSelect(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 font-ui text-body text-ink-primary"
      >
        <option value="">Compare {concept.name} with…</option>
        {relatedEntries.map((e) => (
          <option key={e.concept.id} value={e.concept.id}>
            {e.concept.name}
          </option>
        ))}
      </select>

      {other && (
        <div className={`mt-4 grid gap-4 ${gridColsClass}`}>
          <div>
            <button
              type="button"
              onClick={() => navigate(`/concepts/${concept.id}`)}
              className="mb-2 font-ui text-caption font-semibold uppercase tracking-wide text-ink-secondary hover:text-olive"
            >
              {concept.name}
            </button>
            <CompareColumn sections={onlineSections} />
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate(`/concepts/${other.id}`)}
              className="mb-2 font-ui text-caption font-semibold uppercase tracking-wide text-ink-secondary hover:text-olive"
            >
              {other.name}
            </button>
            {loading && <p className="font-ui text-caption text-ink-tertiary">Checking reliable scientific sources…</p>}
            {!loading && otherSections && <CompareColumn sections={otherSections} />}
          </div>
        </div>
      )}
    </div>
  )
}

function CompareColumn({ sections }: { sections: OnlineKnowledgeSection[] }) {
  if (sections.length === 0) {
    return <p className="font-ui text-caption text-ink-tertiary">No reliable scientific source found yet.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {sections.map((s, i) => (
        <div key={i}>
          {s.heading && <p className="font-ui text-micro font-medium text-ink-secondary">{s.heading}</p>}
          <p className="font-body text-caption text-ink-primary">{s.text}</p>
        </div>
      ))}
    </div>
  )
}
