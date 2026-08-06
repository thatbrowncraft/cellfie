import { Pencil } from '@phosphor-icons/react'

interface QuickCaptureFabProps {
  onClick?: () => void
}

/**
 * Quick Capture FAB — Design System §10.22.
 * The *only* justified FAB in Cellfie: jot a note/highlight from anywhere.
 * Never the only way to perform its action — also reachable via keyboard
 * shortcut and menu (wired up once Notes exists; this is the affordance).
 */
export function QuickCaptureFab({ onClick }: QuickCaptureFabProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Quick capture a note"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-canvas shadow-2 transition-all duration-standard ease-standard hover:shadow-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary"
    >
      <Pencil size={22} weight="bold" />
    </button>
  )
}
