import { useState } from 'react'
import { ArrowSquareOut, CaretDown, CaretUp, ArrowDown } from '@phosphor-icons/react'
import type { GeneratedVisual, GeneratedVisualPart } from '@/core/concepts'

interface GeneratedVisualCardProps {
  visual: GeneratedVisual
}

/**
 * Visuals tab's native-illustration renderer (Concept Hub knowledge-
 * flow correction). Deliberately NOT the Study Map: each `visual.kind`
 * below renders a genuinely different diagram shape — a top-to-bottom
 * flow, a hub-and-spokes structure figure, a two-column comparison, a
 * three-stage mechanism arrow, or a small tree — never the Mind Map's
 * branching relationship graph re-rendered in a smaller box, and never
 * a numbered list of database fields. Source data is shown in one
 * expandable list at the bottom, never scattered as per-node citations
 * that would make MeSH/NCBI labels dominate the figure.
 */
export function GeneratedVisualCard({ visual }: GeneratedVisualCardProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [selected, setSelected] = useState<GeneratedVisualPart | undefined>(undefined)

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          Generated illustration — {visual.subtitle}
        </h4>
      </div>
      <p className="font-ui text-caption text-ink-tertiary">
        Drawn from this concept's own verified structured data — not a fetched image.
      </p>

      {visual.kind === 'process' && visual.parts && <ProcessDiagram parts={visual.parts} onSelect={setSelected} />}
      {visual.kind === 'structure' && visual.parts && <StructureDiagram title={visual.title} parts={visual.parts} onSelect={setSelected} />}
      {visual.kind === 'concept-map' && visual.parts && <StructureDiagram title={visual.title} parts={visual.parts} onSelect={setSelected} flat />}
      {visual.kind === 'comparison' && visual.comparison && <ComparisonDiagram comparison={visual.comparison} />}
      {visual.kind === 'mechanism' && visual.mechanism && <MechanismDiagram mechanism={visual.mechanism} onSelect={setSelected} />}
      {visual.kind === 'hierarchy' && visual.hierarchy && (
        <HierarchyDiagram title={visual.title} hierarchy={visual.hierarchy} onSelect={setSelected} />
      )}

      {selected && (
        <div className="rounded-md border border-border-strong bg-surface-raised px-3 py-2">
          <p className="font-ui text-micro font-medium text-ink-primary">{selected.role ? `Role: ${selected.role}` : selected.label}</p>
          <p className="mt-1 font-body text-caption text-ink-secondary">{selected.detail}</p>
        </div>
      )}

      {visual.sourceRefs.length > 0 && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="flex items-center gap-1 font-ui text-micro font-medium text-ink-tertiary hover:text-ink-secondary"
          >
            Source data used
            {sourcesOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>
          {sourcesOpen && (
            <div className="mt-2 flex flex-col gap-1">
              {visual.sourceRefs.map((ref, i) => (
                <a
                  key={`${ref.sourceUrl}-${i}`}
                  href={ref.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
                >
                  {ref.sourceName}
                  <ArrowSquareOut size={12} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** A top-to-bottom step flow with arrows — each step tappable for its role/detail. */
function ProcessDiagram({ parts, onSelect }: { parts: GeneratedVisualPart[]; onSelect: (p: GeneratedVisualPart) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col items-center gap-1">
      {parts.map((part, i) => (
        <div key={part.id} className="flex w-full flex-col items-center">
          <button
            type="button"
            onClick={() => onSelect(part)}
            className="w-full rounded-md border border-accent-olive bg-olive/10 px-3 py-2 text-left font-ui text-caption font-medium text-ink-primary hover:bg-olive/20"
          >
            {part.label}
            {part.role && <span className="mt-0.5 block font-ui text-micro font-normal italic text-ink-tertiary">{part.role}</span>}
          </button>
          {i < parts.length - 1 && <ArrowDown size={14} className="my-0.5 shrink-0 text-ink-tertiary" aria-hidden />}
        </div>
      ))}
    </div>
  )
}

/** Radial hub-and-spokes — the concept in the center, its parts around it. Used for both 'structure' (bounded, numbered-free labeled spokes) and the flat 'concept-map' fallback. */
function StructureDiagram({
  title,
  parts,
  onSelect,
  flat
}: {
  title: string
  parts: GeneratedVisualPart[]
  onSelect: (p: GeneratedVisualPart) => void
  flat?: boolean
}) {
  const n = parts.length
  const cx = 150
  const cy = 130
  const radius = 92

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <svg viewBox="0 0 300 260" className="w-full" role="img" aria-label={`${flat ? 'Related concepts of' : 'Structure of'} ${title}`}>
        {parts.map((part, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          return <line key={`line-${part.id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border-strong)" strokeWidth={1} />
        })}
        <circle cx={cx} cy={cy} r={44} fill="var(--color-highlight-terracotta)" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-canvas font-ui" fontSize={11} fontWeight={600}>
          {title.length > 16 ? `${title.slice(0, 15)}…` : title}
        </text>
        {parts.map((part, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          return (
            <foreignObject key={`node-${part.id}`} x={x - 46} y={y - 16} width={92} height={32}>
              <button
                type="button"
                onClick={() => onSelect(part)}
                className="flex h-full w-full items-center justify-center rounded-md border border-accent-olive bg-surface-raised px-1 text-center font-ui text-micro font-medium leading-tight text-ink-primary line-clamp-2 hover:bg-olive/10"
              >
                {part.label}
              </button>
            </foreignObject>
          )
        })}
      </svg>
    </div>
  )
}

/** Two side-by-side columns for a genuinely contrasting pair. */
function ComparisonDiagram({ comparison }: { comparison: NonNullable<GeneratedVisual['comparison']> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ComparisonColumn title={comparison.leftTitle} points={comparison.leftPoints} />
      <ComparisonColumn title={comparison.rightTitle} points={comparison.rightPoints} />
    </div>
  )
}

function ComparisonColumn({ title, points }: { title: string; points: { label: string; detail: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-raised p-2.5">
      <p className="font-ui text-caption font-semibold text-ink-primary">{title}</p>
      <ul className="flex flex-col gap-1">
        {points.map((p, i) => (
          <li key={i} className="font-ui text-micro text-ink-secondary">
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Cause → Process → Outcome, left to right, only the stages the source actually names. */
function MechanismDiagram({
  mechanism,
  onSelect
}: {
  mechanism: NonNullable<GeneratedVisual['mechanism']>
  onSelect: (p: GeneratedVisualPart) => void
}) {
  const stages: { label: string; part: GeneratedVisualPart }[] = []
  if (mechanism.cause) stages.push({ label: 'Cause / context', part: mechanism.cause })
  if (mechanism.process) stages.push({ label: 'Process', part: mechanism.process })
  if (mechanism.outcome) stages.push({ label: 'Outcome', part: mechanism.outcome })

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
      {stages.map((s, i) => (
        <div key={s.part.id} className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelect(s.part)}
            className="flex-1 rounded-md border border-sage/50 bg-sage/15 px-2.5 py-2 text-left font-ui text-caption text-ink-primary hover:bg-sage/25"
          >
            <span className="block font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{s.label}</span>
            {s.part.label}
          </button>
          {i < stages.length - 1 && (
            <ArrowDown size={14} className="hidden shrink-0 rotate-[-90deg] text-ink-tertiary sm:block" aria-hidden />
          )}
        </div>
      ))}
    </div>
  )
}

/** A simple parent → concept → children tree. */
function HierarchyDiagram({
  title,
  hierarchy,
  onSelect
}: {
  title: string
  hierarchy: NonNullable<GeneratedVisual['hierarchy']>
  onSelect: (p: GeneratedVisualPart) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {hierarchy.parentLabel && (
        <>
          <div className="rounded-md border border-border bg-surface-raised px-3 py-1.5 font-ui text-caption text-ink-secondary">
            {hierarchy.parentLabel}
          </div>
          <ArrowDown size={14} className="text-ink-tertiary" aria-hidden />
        </>
      )}
      <div className="rounded-md bg-terracotta px-3 py-1.5 font-ui text-caption font-medium text-canvas">{title}</div>
      {hierarchy.children.length > 0 && (
        <>
          <ArrowDown size={14} className="text-ink-tertiary" aria-hidden />
          <div className="flex flex-wrap justify-center gap-1.5">
            {hierarchy.children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child)}
                className="rounded-md border border-accent-olive bg-olive/10 px-2.5 py-1.5 font-ui text-micro font-medium text-ink-primary hover:bg-olive/20"
              >
                {child.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
