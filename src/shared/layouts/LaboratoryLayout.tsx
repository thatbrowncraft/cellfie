import { useState, type ReactNode } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { useBreakpointClass } from '../hooks/useMediaQuery'

interface LaboratoryLayoutProps {
  title: string
  sidebar: ReactNode
  children: ReactNode
}

/**
 * Stable preference key for the Laboratory section-nav collapse state.
 * Same plain-localStorage pattern already used by core/theme and
 * core/reader-settings (`cellfie:` prefix, read synchronously on mount) —
 * no new state-management dependency, this is a UI preference only and
 * never touches Laboratory content itself.
 */
const COLLAPSE_STORAGE_KEY = 'cellfie:laboratory-sections-collapsed'

function getPersistedCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
}

function setPersistedCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  if (collapsed) window.localStorage.setItem(COLLAPSE_STORAGE_KEY, '1')
  else window.localStorage.removeItem(COLLAPSE_STORAGE_KEY)
}

/**
 * Laboratory Layout — a persistent left index (protocols/equipment list)
 * beside the active content, matching the "unified section" design of the
 * Laboratory module (SDD §2).
 *
 * The section list collapses behind the "Sections" heading — tap it to
 * hide/show the list. The collapsed/expanded state now persists across
 * refresh (plain localStorage, read synchronously on mount so there's no
 * flash of the wrong state) — previously this was local `useState` only,
 * so a refresh always re-opened the sections regardless of what the user
 * had just chosen.
 */
export function LaboratoryLayout({ title, sidebar, children }: LaboratoryLayoutProps) {
  const [collapsed, setCollapsed] = useState(getPersistedCollapsed)
  // PWA layout-isolation fix — was a raw `md:flex-row`/`md:w-64` breakpoint;
  // see `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why that
  // stayed "desktop" on an installed Android PWA.
  const flexDirectionClass = useBreakpointClass({
    mobile: 'flex-col',
    tablet: 'flex-col',
    desktop: 'flex-row',
    wide: 'flex-row'
  })
  const sidebarWidthClass = useBreakpointClass({
    mobile: '',
    tablet: '',
    desktop: 'w-64',
    wide: 'w-64'
  })

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      setPersistedCollapsed(next)
      return next
    })
  }

  return (
    <div className={`mx-auto flex max-w-content gap-6 px-4 py-8 sm:px-6 md:px-8 ${flexDirectionClass}`}>
      <aside className={`shrink-0 ${sidebarWidthClass}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="mb-3 flex w-full items-center justify-between gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary"
        >
          <span>{title}</span>
          {collapsed ? <CaretDown size={14} aria-hidden /> : <CaretUp size={14} aria-hidden />}
        </button>
        {!collapsed && <nav className="flex flex-col gap-1">{sidebar}</nav>}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
