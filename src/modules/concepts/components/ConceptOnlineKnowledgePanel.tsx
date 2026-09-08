/**
 * ConceptOnlineKnowledgePanel — Concept Online Knowledge Enrichment
 * brief. Reproduces Comparison Studio's proven enrichment interaction
 * (search → sentence-select → "Use for" → Apply → Search Again) for a
 * single Concept, via the shared multi-source pool
 * (core/concepts/knowledgeLayer.ts → core/laboratory/knowledgeLayer.ts
 * → core/knowledge, which already ranks Wikipedia first for a general
 * definitional excerpt — see core/knowledge/rank.ts). Nothing about the
 * retrieval/ranking/caching/"Search Again" mechanism is reimplemented
 * here; only the destination model differs from Comparison Studio's
 * aspect rows: "Use for" lists this Concept's own sections (the three
 * fixed Learn-tab sections, plus any custom sections already created
 * for this concept, plus "+ Create new section").
 *
 * Deliberately single-subject (no A/B side) — a Concept, unlike a
 * comparison, is one topic — so this is simpler than
 * ComparisonEnrichmentPanel, not a copy of it; nothing in
 * comparison-studio is imported or modified by this file.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Check, Globe, Sparkle, WarningCircle, WifiSlash, X } from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, EmptyState, Input, ReferenceOnlyLink, type DropdownOption } from '../../../shared/components'
import { lookupConceptTopicKnowledge, type ConceptKnowledgeLookupResult } from '../../../core/concepts/knowledgeLayer'

type Status = 'idle' | 'searching' | ConceptKnowledgeLookupResult['status']

/** Sentinel dropdown value for "+ Create new section" — never a real section id. */
const CREATE_NEW_SECTION = '__create_new__'

export interface ConceptSectionOption {
  id: string
  label: string
}

export interface AppliedExcerpt {
  sectionId: string
  text: string
  sourceName: string
  sourceUrl: string
  attributionNotice?: string
}

interface ConceptOnlineKnowledgePanelProps {
  conceptName: string
  conceptId: string
  /** Every destination currently available for this concept — the three fixed Learn-tab sections plus any custom sections already created. Never hardcoded here; always passed in from the concept's own live section list. */
  sections: ConceptSectionOption[]
  onApply: (excerpt: AppliedExcerpt) => void
  /** Creates a new custom section and returns its id, so the just-applied excerpt can target it immediately. */
  onCreateSection: (title: string) => Promise<string>
  onClose: () => void
}

/**
 * Splits an excerpt into individually selectable sentences — identical,
 * deliberately simple approach to Comparison Studio's own
 * `splitIntoSentences` (plain regex, not an NLP tokenizer): a sentence
 * boundary landing one word early/late still leaves the text fully
 * selectable, just chunked slightly differently than a human would.
 */
function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
  return (parts ?? [trimmed]).map((s) => s.trim()).filter(Boolean)
}

export function ConceptOnlineKnowledgePanel({ conceptName, conceptId, sections, onApply, onCreateSection, onClose }: ConceptOnlineKnowledgePanelProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ConceptKnowledgeLookupResult | null>(null)
  /** Ids already shown this session — passed back as `excludeIds` so Search Again advances through the shared pool instead of repeating the same result (same fix as Comparison Studio's `shownIdsA`/`shownIdsB`). */
  const [shownIds, setShownIds] = useState<string[]>([])

  async function runSearch(opts?: { freshStart?: boolean }) {
    setStatus('searching')
    setResult(null)
    const excludeIds = opts?.freshStart ? [] : shownIds
    if (opts?.freshStart) setShownIds([])

    const lookup = await lookupConceptTopicKnowledge(conceptName, conceptId, { excludeIds })
    if (lookup.generalReference) setShownIds((prev) => [...prev, lookup.generalReference!.id])
    setResult(lookup)
    setStatus(lookup.status)
  }

  const searching = status === 'searching'
  const settled = status !== 'idle' && status !== 'searching'

  let body: ReactNode = null
  if (status === 'offline') {
    body = <EmptyState icon={<WifiSlash size={24} />} title="You're offline" description="Online Knowledge needs a connection." />
  } else if (status === 'timed-out') {
    body = <EmptyState icon={<WarningCircle size={24} />} title="Taking longer than expected" description="Safe to try again." />
  } else if (status === 'error') {
    body = <EmptyState icon={<WarningCircle size={24} />} title="Couldn't retrieve this right now" description="Something went wrong reaching this source." />
  } else if (status === 'not-found' || status === 'not-found-in-source') {
    body = (
      <EmptyState
        icon={<Globe size={24} />}
        title="No usable excerpt found"
        description="Trusted scientific sources didn't return anything Cellfie can display as an excerpt — a bare title or citation isn't enough to count as found."
        action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
      />
    )
  } else if (status === 'exhausted') {
    body = (
      <EmptyState
        icon={<Globe size={24} />}
        title="No more usable results"
        description="Every trusted source Cellfie checked has either already been shown or has nothing Cellfie can display as an excerpt."
        action={result?.reference ? <ReferenceOnlyLink reference={result.reference} /> : undefined}
      />
    )
  } else if (status === 'found' && result) {
    const excerptText = result.generalReference?.text ?? result.meshScopeNote?.text
    const sourceLabel = result.generalReference ? `⚡ ${result.generalReference.sourceName}` : result.meshScopeNote ? `⚡ ${result.meshScopeNote.sourceName}` : '⚡ Online Knowledge'
    if (excerptText) {
      body = (
        <ExcerptCard
          key={excerptText}
          excerptText={excerptText}
          sourceLabel={sourceLabel}
          attributionNotice={result.generalReference?.attributionNotice}
          sourceName={result.generalReference?.sourceName ?? sourceLabel}
          sourceUrl={result.generalReference?.sourceUrl ?? ''}
          sections={sections}
          onApply={(sectionId, text, sourceName, sourceUrl, attributionNotice) => onApply({ sectionId, text, sourceName, sourceUrl, attributionNotice })}
          onCreateSection={onCreateSection}
        />
      )
    }
  }

  return (
    <Dialog open onClose={onClose} title="Online Knowledge" size="lg">
      <div className="flex flex-col gap-4">
        <p className="font-body text-caption text-ink-tertiary">
          Looking for information about <strong>{conceptName}</strong>. Wikipedia is tried first for a general definition, alongside Europe PMC, NCBI
          Bookshelf, and PubMed.
        </p>

        {!searching && !settled && (
          <Button variant="primary" size="small" icon={<Sparkle size={16} />} onClick={() => void runSearch({ freshStart: true })}>
            Find information for this concept
          </Button>
        )}

        {searching && <EmptyState icon={<Globe size={32} />} title="Searching…" description={`Looking for "${conceptName}".`} />}

        {settled && (
          <div className="flex flex-col gap-3">
            {body}
            <div className="flex gap-2">
              <Button variant="tertiary" size="small" icon={<Sparkle size={16} />} onClick={() => void runSearch()}>
                Search again
              </Button>
              <Button variant="tertiary" size="small" icon={<X size={16} />} onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/**
 * Per-sentence selection card — same interaction as Comparison Studio's
 * `ExcerptCard`: sentences start unselected, tapping toggles selection,
 * "Use for" picks a destination, applying only consumes the sentences
 * ticked at that moment (marked `usedFor`) while every other sentence
 * stays live and reusable for a different section afterward.
 */
function ExcerptCard({
  excerptText,
  sourceLabel,
  sourceName,
  sourceUrl,
  attributionNotice,
  sections,
  onApply,
  onCreateSection
}: {
  excerptText: string
  sourceLabel: string
  sourceName: string
  sourceUrl: string
  attributionNotice?: string
  sections: ConceptSectionOption[]
  onApply: (sectionId: string, text: string, sourceName: string, sourceUrl: string, attributionNotice?: string) => void
  onCreateSection: (title: string) => Promise<string>
}) {
  const sentences = useMemo(() => splitIntoSentences(excerptText), [excerptText])
  const [selected, setSelected] = useState<boolean[]>(() => sentences.map(() => false))
  const [usedFor, setUsedFor] = useState<(string | null)[]>(() => sentences.map(() => null))
  const [targetId, setTargetId] = useState(sections[0]?.id ?? CREATE_NEW_SECTION)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)

  const options: DropdownOption[] = [...sections.map((s) => ({ value: s.id, label: s.label })), { value: CREATE_NEW_SECTION, label: '+ Create new section' }]

  const pendingIndices = selected.map((v, i) => (v && !usedFor[i] ? i : -1)).filter((i) => i !== -1)
  const pendingText = pendingIndices
    .map((i) => sentences[i])
    .join(' ')
    .trim()
  const allUsed = usedFor.every((v) => v !== null)

  function toggle(index: number) {
    if (usedFor[index]) return
    setSelected((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  async function applySelection() {
    if (pendingIndices.length === 0) return
    let destinationId = targetId
    let destinationLabel = options.find((o) => o.value === targetId)?.label ?? 'a section'

    if (targetId === CREATE_NEW_SECTION) {
      const title = newSectionTitle.trim()
      if (!title) return
      setCreatingSection(true)
      try {
        destinationId = await onCreateSection(title)
        destinationLabel = title
      } finally {
        setCreatingSection(false)
      }
      setNewSectionTitle('')
      setTargetId(destinationId)
    }

    onApply(destinationId, pendingText, sourceName, sourceUrl, attributionNotice)
    setUsedFor((prev) => prev.map((v, i) => (pendingIndices.includes(i) ? destinationLabel : v)))
    setSelected((prev) => prev.map((v, i) => (pendingIndices.includes(i) ? false : v)))
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="font-body text-body text-ink-secondary">
        {sentences.map((sentence, i) => {
          const used = usedFor[i]
          if (used) {
            return (
              <span key={i} className="rounded px-0.5 text-ink-tertiary">
                {sentence} <span className="font-ui text-micro font-medium text-olive">(used for {used})</span>{' '}
              </span>
            )
          }
          return (
            <span
              key={i}
              role="checkbox"
              aria-checked={selected[i]}
              tabIndex={0}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle(i)
                }
              }}
              className={
                selected[i]
                  ? 'cursor-pointer rounded px-0.5 text-ink-primary underline decoration-olive decoration-2 underline-offset-2'
                  : 'cursor-pointer rounded px-0.5 text-ink-tertiary hover:text-ink-secondary'
              }
            >
              {sentence}{' '}
            </span>
          )
        })}
      </p>
      <p className="font-ui text-micro text-ink-tertiary">{sourceLabel}</p>
      {attributionNotice && <p className="font-ui text-micro text-ink-tertiary">{attributionNotice}</p>}
      {allUsed ? (
        <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
          <Check size={13} weight="bold" aria-hidden />
          Every sentence from this excerpt has been used.
        </span>
      ) : (
        <>
          <p className="font-ui text-micro text-ink-tertiary">
            Tap the sentence(s) you want, choose where they go, then apply — sentences already used stay marked but everything else stays available to
            pick for another section afterward.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Dropdown label="Use for" options={options} value={targetId} onChange={setTargetId} />
            {targetId === CREATE_NEW_SECTION && (
              <Input
                label="New section title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g. DNA Replication"
                className="max-w-[220px]"
              />
            )}
            <Button
              variant="tertiary"
              size="small"
              icon={<Check size={14} />}
              disabled={!pendingText || creatingSection || (targetId === CREATE_NEW_SECTION && !newSectionTitle.trim())}
              onClick={() => void applySelection()}
            >
              {creatingSection ? 'Creating section…' : 'Use selected text'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
