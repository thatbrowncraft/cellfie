import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { PageTransition } from './PageTransition'
import { UniversalSearch } from '../shared/components/SearchField'
import { QuickCaptureFab } from '../shared/components/QuickCaptureFab'
import { useBreakpoint } from '../shared/hooks'
import { searchEverything, type SearchResultGroup } from '../core/search'
import { runAutoConceptCleanup, purgeAutomaticScientificRelations } from '../core/concepts'
import { NoteEditorDialog } from '../modules/notes/components/NoteEditorDialog'

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
 *
 * Sprint 2 additions: the Cmd/Ctrl+K overlay now actually searches
 * (core/search, §7) instead of rendering an empty state forever, and the
 * Quick Capture FAB opens a real note editor (§3) instead of being inert.
 */
export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const breakpoint = useBreakpoint()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchGroups, setSearchGroups] = useState<SearchResultGroup[]>([])
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)

  const railOnly = breakpoint === 'tablet'

  // Knowledge Model Correction §18 — one-time cleanup of concepts that
  // were silently auto-created from raw PDF text before this correction.
  // Gated by an appSettings flag internally, so this is safe to call on
  // every app boot regardless of which page loads first.
  useEffect(() => {
    void runAutoConceptCleanup()
  }, [])

  // Concept Hub Refinement §3/§15 — one-time cleanup that deletes any
  // 'scientific'-origin ConceptRelation rows written by the now-removed
  // automatic literature co-occurrence discovery (see
  // core/concepts/service.ts's purgeAutomaticScientificRelations for
  // why this is a real deletion, not just a read-time filter). Same
  // gated-by-appSettings-flag, safe-on-every-boot pattern as the
  // cleanup right above it.
  useEffect(() => {
    void purgeAutomaticScientificRelations()
  }, [])

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // "N" for a new note — same spirit as the FAB, but keyboard-first.
      // Skipped while typing in any field so it doesn't hijack normal text entry.
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key.toLowerCase() === 'n' && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setQuickCaptureOpen(true)
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [])

  // Close the mobile drawer automatically when the viewport grows past mobile.
  useEffect(() => {
    if (breakpoint !== 'mobile') setDrawerOpen(false)
  }, [breakpoint])

  async function handleSearchQueryChange(query: string) {
    const groups = await searchEverything(query)
    setSearchGroups(
      groups.map((g) => ({
        label: g.label,
        results: g.results
      }))
    )
  }

  function handleSelectResult(result: { path?: string }) {
    if (result.path) navigate(result.path)
  }

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

      <QuickCaptureFab onClick={() => setQuickCaptureOpen(true)} />
      <UniversalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        groups={searchGroups}
        onQueryChange={(q) => void handleSearchQueryChange(q)}
        onSelectResult={handleSelectResult}
      />
      <NoteEditorDialog open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
    </div>
  )
}
