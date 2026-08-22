import { cn } from '@/shared/utils/cn'

export interface GroupChipOption {
  id: string
  label: string
  count: number
}

interface GroupChipRowProps {
  title?: string
  hint?: string
  options: GroupChipOption[]
  activeId: string | undefined
  onChange: (id: string | undefined) => void
}

/**
 * A row of tappable group chips — the Organism Explorer redesign's
 * "useful ways to narrow the collection" (§4/§5/§19), shown as
 * horizontally-scrolling pills so it stays compact on mobile (§21)
 * rather than a tall stack of checkboxes. Only ever receives options
 * that already have at least one matching organism (§5 "only show
 * grouping options that actually have organisms") — filtering empty
 * groups out is the caller's job, this component just renders what
 * it's given. Tapping the active chip again clears it.
 */
export function GroupChipRow({ title, hint, options, activeId, onChange }: GroupChipRowProps) {
  if (options.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {title && <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</h4>}
      {hint && <p className="font-body text-caption text-ink-tertiary">{hint}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => {
          const isActive = activeId === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(isActive ? undefined : option.id)}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
                isActive
                  ? 'border-olive bg-olive text-canvas'
                  : 'border-border-strong bg-canvas text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {option.label} ({option.count})
            </button>
          )
        })}
      </div>
    </div>
  )
}
