import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navigation'
import { cn } from '../shared/utils/cn'

/**
 * Bottom Navigation — mobile only (<640px), per Design System §4.3.
 *
 * Navigation Parity Correction — this shows all 8 sections (every
 * `navItems` entry, same set/order as the hamburger `Sidebar`), not a
 * 5-item subset with the rest hamburger-only. 8 labeled icons don't
 * comfortably fit at equal width on a typical phone screen, so this is
 * a horizontally scrollable icon strip (`overflow-x-auto`).
 *
 * Mobile nav collision fix — this previously combined `flex-1` (grow
 * AND shrink, basis 0%) with `shrink-0` on the same element. Those
 * fight each other: the resulting basis-0%-but-no-shrink box doesn't
 * reserve a real width up front, so in a scrolling flex row the browser
 * can still lay items out narrower than their label needs, and because
 * only the inner `<span>` (not the item itself) had `whitespace-nowrap`,
 * a label that didn't fit its item's box spilled visually into the next
 * icon instead of wrapping or scrolling with it. Each item now gets a
 * fixed, non-shrinking, non-growing width (`w-20 shrink-0`, no
 * `flex-1`) sized for the longest label in the set, with `overflow-hidden`
 * as a hard backstop — so items can reserve their own space and can
 * never visually collide, and the strip simply scrolls horizontally past
 * `w-20 * 8` instead. Active styling (olive icon/text, filled icon)
 * matches the sidebar exactly, and `NavLink`'s own active state keeps
 * both interfaces in sync automatically — whichever route is current
 * highlights in both.
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
                'flex w-20 shrink-0 flex-col items-center gap-1 overflow-hidden py-2.5 font-ui text-micro font-medium transition-colors duration-micro',
                isActive ? 'text-olive' : 'text-ink-tertiary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                <span className="w-full truncate text-center leading-tight">{item.navLabel ?? item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
