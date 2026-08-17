import { NavLink } from 'react-router-dom'
import { X } from '@phosphor-icons/react'
import { navItems } from '../config/navigation'
import { cn } from '../shared/utils/cn'

interface SidebarProps {
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
 */
export function Sidebar({ drawerOpen, onCloseDrawer, railOnly }: SidebarProps) {
  const content = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 py-6">
      <div className={cn('mb-4 flex items-center justify-between px-4', railOnly && 'justify-center px-0')}>
        {!railOnly && <span className="font-display text-h3 font-semibold text-ink-primary">Cellfie</span>}
        <button onClick={onCloseDrawer} aria-label="Close menu" className="rounded-sm p-1 text-ink-secondary hover:bg-surface-raised sm:hidden">
          <X size={20} />
        </button>
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
      <div className={cn('hidden shrink-0 border-r border-border bg-surface sm:block', railOnly ? 'w-rail' : 'w-sidebar')}>
        {content}
      </div>

      {/* Mobile: slide-in drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--scrim)' }} onClick={onCloseDrawer} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] border-r border-border bg-surface shadow-3">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
