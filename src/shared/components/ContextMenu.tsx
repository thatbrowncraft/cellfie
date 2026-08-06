import { useRef, useState, type ReactNode } from 'react'
import { DotsThreeVertical } from '@phosphor-icons/react'
import { useClickOutside } from '../hooks/useClickOutside'
import { cn } from '../utils/cn'

export interface ContextMenuAction {
  id: string
  label: string
  icon?: ReactNode
  destructive?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  actions: ContextMenuAction[]
  /** Accessible label for the trigger, e.g. "More actions for Immunology Basics" */
  triggerLabel: string
}

/**
 * Context Menu — Design System §10.21.
 * Right-click/long-press actions on Library items, Notes, Collections.
 * Always also reachable via a visible kebab button with full keyboard
 * support — right-click alone is never the only path (§10.21 a11y note).
 */
export function ContextMenu({ actions, triggerLabel }: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, () => setOpen(false), open)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="rounded-sm p-1.5 text-ink-tertiary hover:bg-surface-raised hover:text-ink-primary"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-sm border border-border bg-surface p-1 shadow-2"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                action.onSelect()
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui',
                action.destructive ? 'text-error hover-wash-error' : 'text-ink-primary hover:bg-surface-raised'
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
