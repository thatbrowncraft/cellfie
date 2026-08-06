import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navigation'
import { cn } from '../shared/utils/cn'

/**
 * Bottom Navigation — mobile only (<640px), per Design System §4.3.
 * Shows the five most-used destinations (navItems flagged inBottomNav);
 * everything else (Laboratory, Comparison Studio, Settings) is reachable
 * via the drawer, opened from the top nav's menu button.
 */
export function BottomNav() {
  const items = navItems.filter((item) => item.inBottomNav)

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 font-ui text-micro font-medium transition-colors duration-micro',
                isActive ? 'text-olive' : 'text-ink-tertiary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                <span>{item.label === 'Organism Explorer' ? 'Organisms' : item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
