import { useState } from 'react'
import { ArrowsLeftRight } from '@phosphor-icons/react'
import { cn } from '../../../shared/utils/cn'

interface RecallCardProps {
  prompt: string
  answer: string
  className?: string
}

/**
 * RecallCard — lightweight tap-to-reveal flashcard (brief §16/§17). Not a
 * quiz engine: no scoring, no session state, just a local `revealed`
 * toggle. Reused across atomic-number→element, element→atomic-number,
 * and symbol→element recall since the interaction is identical in every
 * direction — only the prompt/answer strings change.
 */
export function RecallCard({ prompt, answer, className }: RecallCardProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      aria-pressed={revealed}
      className={cn(
        'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 py-3 text-center transition-colors duration-micro hover:bg-surface-raised',
        className
      )}
    >
      <span className="font-ui text-caption font-medium text-ink-tertiary">{revealed ? 'Answer' : 'Recall'}</span>
      <span className={cn('font-body text-body', revealed ? 'text-olive' : 'text-ink-primary')}>
        {revealed ? answer : prompt}
      </span>
      {!revealed && <ArrowsLeftRight size={12} className="text-ink-tertiary" aria-hidden />}
    </button>
  )
}
