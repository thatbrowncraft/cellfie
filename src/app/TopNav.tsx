import { List, MagnifyingGlass, WifiSlash, WifiHigh } from '@phosphor-icons/react'
import { ThemeToggle } from '../shared/components/ThemeToggle'
import { Tooltip } from '../shared/components/Tooltip'
import { useOnlineStatus } from '../shared/hooks'

interface TopNavProps {
  onMenuClick?: () => void
  onSearchClick: () => void
  showMenuButton: boolean
}

/**
 * Top Navigation — Design System §10.5.
 * Slim bar, surface background, bottom border only, no shadow. Houses the
 * menu toggle (mobile/tablet), Cmd/Ctrl+K search trigger, offline indicator,
 * and theme toggle. Landmark role="banner" + skip-to-content link.
 */
export function TopNav({ onMenuClick, onSearchClick, showMenuButton }: TopNavProps) {
  const online = useOnlineStatus()

  return (
    <header role="banner" className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="rounded-sm p-2 text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
          >
            <List size={22} />
          </button>
        )}
        <span className="font-display text-h3 font-semibold text-ink-primary">Cellfie</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 rounded-sm border border-border bg-canvas px-3 py-2 text-ink-tertiary hover:border-border-strong"
          aria-label="Open search (Ctrl+K)"
        >
          <MagnifyingGlass size={18} />
          <span className="hidden font-ui text-caption sm:inline">Search</span>
          <kbd className="hidden rounded-sm border border-border-strong px-1.5 py-0.5 font-mono text-micro sm:inline">
            ⌘K
          </kbd>
        </button>

        <Tooltip label={online ? 'Online — Cellfie works offline too' : "You're offline — everything still works"}>
          <span
            tabIndex={0}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-tertiary"
            aria-label={online ? 'Online' : 'Offline mode active'}
          >
            {online ? <WifiHigh size={18} /> : <WifiSlash size={18} />}
          </span>
        </Tooltip>

        <ThemeToggle />
      </div>
    </header>
  )
}
