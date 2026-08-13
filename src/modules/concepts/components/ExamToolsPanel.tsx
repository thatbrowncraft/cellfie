import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowSquareOut, CaretDown, Check, ListChecks, NotePencil, Ruler } from '@phosphor-icons/react'
import { EmptyState, Button } from '@/shared/components'
import type { Concept, ConceptRelation } from '@/core/db'
import { fetchOnlineKnowledge, updateConceptMemoryAid, type ExamTools, type OnlineKnowledgeSection } from '@/core/concepts'

interface ExamToolsPanelProps {
  concept: Concept
  examTools: ExamTools
  relatedEntries: { concept: Concept; relation: ConceptRelation }[]
  onlineSections: OnlineKnowledgeSection[]
}

/**
 * Exam Tools tab — Concept 2.0 §10. Every block below either comes
 * straight from `buildExamTools` (core/concepts/examTools.ts — real
 * source excerpts and real relationship data, never invented) or is
 * 100% written by the person themselves (the memory aid, the choice of
 * what to compare). A block that has nothing real to show simply
 * doesn't render, matching every other tab in this app.
 */
export function ExamToolsPanel({ concept, examTools, relatedEntries, onlineSections }: ExamToolsPanelProps) {
  const hasAnything = examTools.keyPoints.length > 0 || examTools.importantValues.length > 0 || examTools.quickQuestions.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!hasAnything && (
        <EmptyState
          icon={<ListChecks size={32} />}
          title="Not enough source material yet"
          description="Once the Scientific overview on the Learn tab has real content for this concept, exam points and questions will build themselves from it."
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

      {examTools.quickQuestions.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Quick questions</h3>
          <ul className="flex flex-col gap-2">
            {examTools.quickQuestions.map((q, i) => (
              <QuestionCard key={i} question={q} />
            ))}
          </ul>
        </div>
      )}

      <ComparePanel concept={concept} onlineSections={onlineSections} relatedEntries={relatedEntries} />

      <MemoryAidPanel concept={concept} />
    </div>
  )
}

function QuestionCard({ question }: { question: ExamTools['quickQuestions'][number] }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left font-ui text-body font-medium text-ink-primary"
      >
        {question.question}
        <CaretDown size={14} className={`shrink-0 text-ink-tertiary transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5">
          <p className="whitespace-pre-line font-body text-body text-ink-primary">{question.answer}</p>
          {question.sourceUrl && (
            <a
              href={question.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
            >
              Source: {question.sourceName}
              <ArrowSquareOut size={12} />
            </a>
          )}
        </div>
      )}
    </li>
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
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

/** §10 "Memory aid" — 100% user-authored, never auto-generated or suggested. */
function MemoryAidPanel({ concept }: { concept: Concept }) {
  const [text, setText] = useState(concept.memoryAid ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateConceptMemoryAid(concept.id, text)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        <NotePencil size={14} aria-hidden />
        Memory aid
      </h3>
      <p className="mb-3 font-ui text-caption text-ink-secondary">Your own mnemonic for {concept.name} — never suggested automatically.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. a mnemonic that helps you remember this…"
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" size="small" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 font-ui text-caption text-ink-tertiary">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
    </div>
  )
}
