import { Warning } from '@phosphor-icons/react'
import { CalloutBox } from '@/shared/components'
import type { CalculatorOutcome } from '@/core/laboratory/calculators'

interface CalculatorResultCardProps {
  outcome: CalculatorOutcome | null
  error: string | null
}

/**
 * The shared result presentation for every Tier 1 calculator — Result,
 * Formula, Calculation (substitution), Interpretation, and any Note/
 * warning — matching the Calculator Result UX described in the brief
 * (§25). Every calculator page renders through this one component so
 * results look and behave identically across the Calculator Hub.
 */
export function CalculatorResultCard({ outcome, error }: CalculatorResultCardProps) {
  if (error) {
    return (
      <CalloutBox type="warning" title="Check your inputs">
        {error}
      </CalloutBox>
    )
  }

  if (!outcome) return null

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-raised p-5">
      <div>
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Result</p>
        <p className="font-display text-h2 font-semibold text-olive">{outcome.result}</p>
      </div>
      <div>
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Formula</p>
        <p className="font-ui text-body text-ink-primary">{outcome.formula}</p>
      </div>
      <div>
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Calculation</p>
        <p className="font-ui text-body text-ink-secondary">{outcome.substitution}</p>
      </div>
      <div>
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Interpretation</p>
        <p className="font-body text-body text-ink-secondary">{outcome.interpretation}</p>
      </div>
      {outcome.warnings?.map((w, i) => (
        <CalloutBox key={i} type="warning" title="Note">
          <span className="flex items-start gap-2">
            <Warning size={16} className="mt-0.5 shrink-0" aria-hidden />
            {w}
          </span>
        </CalloutBox>
      ))}
    </div>
  )
}
