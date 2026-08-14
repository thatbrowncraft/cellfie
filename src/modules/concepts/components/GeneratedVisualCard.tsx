import { useState } from 'react'
import { ArrowSquareOut, CaretDown, CaretUp } from '@phosphor-icons/react'
import type { GeneratedVisual } from '@/core/concepts'

interface GeneratedVisualCardProps {
  visual: GeneratedVisual
}

/**
 * Visuals tab's native-illustration fallback (Mind Map / Visuals
 * redesign, §10/§11). Deliberately NOT the Study Map: a flat radial
 * "hub and labeled parts" figure (numbered satellites around a center
 * hub), not a branching flowchart, with no tap-to-drill node
 * interaction — this reads as a labeled scientific diagram, not the
 * Mind Map re-rendered in a smaller box. The source data used is
 * shown in a single expandable list per §11 ("show the source data
 * used"), not scattered as N separate tappable dialogs.
 */
export function GeneratedVisualCard({ visual }: GeneratedVisualCardProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const n = visual.parts.length
  const cx = 150
  const cy = 130
  const radius = 92

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Generated illustration</h4>
      </div>
      <p className="font-ui text-caption text-ink-tertiary">
        Drawn from this concept's own verified structured data — not a fetched image.
      </p>

      <div className="mx-auto w-full max-w-[300px]">
        <svg viewBox="0 0 300 260" className="w-full" role="img" aria-label={`Diagram of ${visual.title}`}>
          {visual.parts.map((part, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2
            const x = cx + radius * Math.cos(angle)
            const y = cy + radius * Math.sin(angle)
            return <line key={`line-${part.id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border-strong)" strokeWidth={1} />
          })}
          <circle cx={cx} cy={cy} r={44} fill="var(--color-highlight-terracotta)" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-canvas font-ui" fontSize={11} fontWeight={600}>
            {visual.title.length > 16 ? `${visual.title.slice(0, 15)}…` : visual.title}
          </text>
          {visual.parts.map((part, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2
            const x = cx + radius * Math.cos(angle)
            const y = cy + radius * Math.sin(angle)
            return (
              <g key={`node-${part.id}`}>
                <circle cx={x} cy={y} r={16} fill="var(--color-bg-surface-raised)" stroke="var(--color-accent-olive)" strokeWidth={1.5} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current text-ink-primary font-ui" fontSize={11} fontWeight={600}>
                  {i + 1}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <ol className="flex flex-col gap-1.5">
        {visual.parts.map((part, i) => (
          <li key={part.id} className="flex gap-2 font-ui text-caption text-ink-secondary">
            <span className="shrink-0 font-medium text-ink-primary">{i + 1}.</span>
            <span className="line-clamp-2">{part.detail}</span>
          </li>
        ))}
      </ol>

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
