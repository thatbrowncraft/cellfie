import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navigation'
import { cn } from '../shared/utils/cn'

/**
 * Bottom Navigation — mobile only (<640px), per Design System §4.3.
 *
 * Navigation Parity Correction — this now shows all 8 sections (every
 * `navItems` entry, same set/order as the hamburger `Sidebar`), not a
 * 5-item subset with the rest hamburger-only. 8 labeled icons don't
 * comfortably fit at equal width on a typical phone screen, so this is
 * a horizontally scrollable icon strip (`overflow-x-auto`) instead of
 * the old `flex-1` equal-division layout — every icon keeps a fixed
 * comfortable min-width and a small label, and the strip scrolls
 * instead of any section being dropped or squeezed unreadable. Active
 * styling (olive icon/text, filled icon) matches the sidebar exactly,
 * and `NavLink`'s own active state keeps both interfaces in sync
 * automatically — whichever route is current highlights in both.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-w-[64px] flex-1 shrink-0 flex-col items-center gap-1 py-2.5 font-ui text-micro font-medium transition-colors duration-micro',
                isActive ? 'text-olive' : 'text-ink-tertiary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                <span className="whitespace-nowrap">{item.label === 'Organism Explorer' ? 'Organisms' : item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
