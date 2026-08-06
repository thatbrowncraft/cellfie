import { useEffect, useState, type ReactNode } from 'react'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { PageTransition } from './PageTransition'
import { UniversalSearch } from '../shared/components/SearchField'
import { QuickCaptureFab } from '../shared/components/QuickCaptureFab'
import { useBreakpoint } from '../shared/hooks'

interface AppShellProps {
  children: ReactNode
}

/**
 * App Shell — the persistent frame around every route.
 * Responsive behavior (Design System §4.3):
 *   Mobile   (<640px):  bottom tab bar, sidebar becomes a drawer
 *   Tablet   (640–1024): collapsible icon-rail sidebar
 *   Desktop  (1024–1440): full 280px sidebar
 *   Wide     (>1440px): same as desktop, content stays capped
 */
export function AppShell({ children }: AppShellProps) {
  const breakpoint = useBreakpoint()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const railOnly = breakpoint === 'tablet'

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [])

  // Close the mobile drawer automatically when the viewport grows past mobile.
  useEffect(() => {
    if (breakpoint !== 'mobile') setDrawerOpen(false)
  }, [breakpoint])

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} railOnly={railOnly} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          onMenuClick={() => setDrawerOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          showMenuButton={breakpoint === 'mobile'}
        />

        <main id="main-content" className="min-w-0 flex-1 pb-20 sm:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>

        <BottomNav />
      </div>

      <QuickCaptureFab />
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
