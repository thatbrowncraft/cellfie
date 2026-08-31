import { NavLink } from 'react-router-dom'
import { X } from '@phosphor-icons/react'
import { navItems } from '../config/navigation'
import { cn } from '../shared/utils/cn'

interface SidebarProps {
  /**
   * Whether to render the mobile drawer variant instead of the static
   * tablet/desktop sidebar. Comes from `useBreakpoint()` (via AppShell),
   * NOT a raw `sm:`/`md:` CSS breakpoint — see the note below on why.
   */
  isMobile: boolean
  /** Mobile-only: drawer open state */
  drawerOpen: boolean
  onCloseDrawer: () => void
  /** Tablet: collapse to a 64px icon rail instead of full 280px sidebar */
  railOnly: boolean
}

/**
 * Sidebar — Design System §10.6.
 * Desktop: fixed 280px width, full labels.
 * Tablet: collapses to a 64px icon rail.
 * Mobile: becomes a slide-in drawer (bottom nav is primary there instead).
 * Active item: sage-tinted background + olive icon/text + left terracotta
 * indicator bar. Current page is also marked via aria-current, not color alone.
 *
 * PWA layout-isolation fix — static-vs-drawer used to be decided with a
 * raw `sm:block`/`sm:hidden` Tailwind (CSS `min-width`) breakpoint. That
 * media query is evaluated by the browser engine against whatever layout
 * viewport width it currently reports, and on an installed Android PWA
 * that width is NOT trustworthy: Chrome's per-origin "Request desktop
 * site" setting also applies to the installed WebAPK, forcing a ~980px
 * layout viewport (and ignoring this page's own viewport meta) regardless
 * of the physical phone screen. `useBreakpoint()`/`useIsStandalonePwa()`
 * already correctly detect that case via `display-mode: standalone` and
 * compute `isMobile` — but that JS result was never wired into this
 * component, so the CSS breakpoint kept showing the static desktop
 * sidebar underneath. Now `isMobile` (from AppShell) is the only thing
 * that decides static-sidebar vs. drawer; the `sm:hidden` on the drawer
 * overlay itself is left as pure defensive CSS since the drawer is only
 * ever mounted when `isMobile` is already true.
 */
export function Sidebar({ isMobile, drawerOpen, onCloseDrawer, railOnly }: SidebarProps) {
  const content = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 py-6">
      <div className={cn('mb-4 flex items-center justify-between px-4', railOnly && 'justify-center px-0')}>
        {!railOnly && <span className="font-display text-h3 font-semibold text-ink-primary">Cellfie</span>}
        {isMobile && (
          <button onClick={onCloseDrawer} aria-label="Close menu" className="rounded-sm p-1 text-ink-secondary hover:bg-surface-raised">
            <X size={20} />
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                onClick={onCloseDrawer}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-sm px-4 py-3 font-ui text-ui font-medium transition-colors duration-micro',
                    railOnly && 'justify-center px-0 py-3',
                    isActive ? 'wash-sage text-olive' : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-terracotta" aria-hidden />
                    )}
                    <Icon size={20} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                    {!railOnly && <span>{item.navLabel ?? item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <>
      {/* Tablet / desktop: static sidebar (icon rail on tablet, full width on desktop+) */}
      {!isMobile && (
        <div className={cn('shrink-0 border-r border-border bg-surface', railOnly ? 'w-rail' : 'w-sidebar')}>
          {content}
        </div>
      )}

      {/* Mobile: slide-in drawer */}
      {isMobile && drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--scrim)' }} onClick={onCloseDrawer} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] border-r border-border bg-surface shadow-3">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
