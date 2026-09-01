import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from '../modules/dashboard/DashboardPage'
import { NotFoundPage } from '../modules/not-found/NotFoundPage'
import { SkeletonCard } from '../shared/components'
import { LoadingLayout } from '../shared/layouts'
import { useBreakpointClass } from '../shared/hooks/useMediaQuery'

/**
 * Route-level code splitting (bundle-size remediation, stage 1).
 *
 * These are the feature areas that pull in the heaviest content/logic —
 * most importantly Organism Explorer/Detail and the Laboratory pages,
 * which sit on top of the large `core/organisms` and `core/laboratory`
 * content registries (see those files' doc comments). Splitting them
 * into their own chunks means a visit to, say, `/notes` no longer has
 * to download and parse that content up front.
 *
 * `DashboardPage` (the default route) stays eagerly imported since it's
 * what renders on first paint anyway — lazy-loading it would only add
 * an extra Suspense flash with no bundle-size benefit. Highlights and
 * Bookmarks are no longer separate routes here — they're sections of
 * `/notes` now (see NotesPage.tsx's header comment for why).
 *
 * Named exports are wrapped with `.then(m => ({ default: m.X }))` so the
 * page components themselves don't need to change to default exports.
 */
const LibraryPage = lazy(() => import('../modules/library/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const ReaderPage = lazy(() =>
  import('../modules/library/reader/ReaderPage').then((m) => ({ default: m.ReaderPage }))
)
const ConceptsPage = lazy(() =>
  import('../modules/concepts/ConceptsPage').then((m) => ({ default: m.ConceptsPage }))
)
const ConceptDetailPage = lazy(() =>
  import('../modules/concepts/ConceptDetailPage').then((m) => ({ default: m.ConceptDetailPage }))
)
const OrganismExplorerPage = lazy(() =>
  import('../modules/organism-explorer/OrganismExplorerPage').then((m) => ({ default: m.OrganismExplorerPage }))
)
const OrganismDetailPage = lazy(() =>
  import('../modules/organism-explorer/OrganismDetailPage').then((m) => ({ default: m.OrganismDetailPage }))
)
const LaboratoryPage = lazy(() =>
  import('../modules/laboratory/LaboratoryPage').then((m) => ({ default: m.LaboratoryPage }))
)
const LaboratoryDetailPage = lazy(() =>
  import('../modules/laboratory/LaboratoryDetailPage').then((m) => ({ default: m.LaboratoryDetailPage }))
)
const ClinicalLaboratoryPage = lazy(() =>
  import('../modules/laboratory/ClinicalLaboratoryPage').then((m) => ({ default: m.ClinicalLaboratoryPage }))
)
const ClinicalDetailPage = lazy(() =>
  import('../modules/laboratory/ClinicalDetailPage').then((m) => ({ default: m.ClinicalDetailPage }))
)
const CalculatorDetailPage = lazy(() =>
  import('../modules/laboratory/CalculatorDetailPage').then((m) => ({ default: m.CalculatorDetailPage }))
)
const UnitConverterPage = lazy(() =>
  import('../modules/laboratory/UnitConverterPage').then((m) => ({ default: m.UnitConverterPage }))
)
const ComparisonStudioPage = lazy(() =>
  import('../modules/comparison-studio/ComparisonStudioPage').then((m) => ({ default: m.ComparisonStudioPage }))
)
const ExploreComparisonsPage = lazy(() =>
  import('../modules/comparison-studio/ExploreComparisonsPage').then((m) => ({ default: m.ExploreComparisonsPage }))
)
const NewComparisonPage = lazy(() =>
  import('../modules/comparison-studio/NewComparisonPage').then((m) => ({ default: m.NewComparisonPage }))
)
const ComparisonWorkspacePage = lazy(() =>
  import('../modules/comparison-studio/ComparisonWorkspacePage').then((m) => ({ default: m.ComparisonWorkspacePage }))
)
const NotesPage = lazy(() => import('../modules/notes/NotesPage').then((m) => ({ default: m.NotesPage })))
const SettingsPage = lazy(() =>
  import('../modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

function RouteFallback() {
  // PWA layout-isolation fix — see `useBreakpointClass` in
  // shared/hooks/useMediaQuery.ts for why this can't be `sm:`/`lg:` classes.
  const gridColsClass = useBreakpointClass({
    mobile: 'grid-cols-1',
    tablet: 'grid-cols-2',
    desktop: 'grid-cols-3',
    wide: 'grid-cols-3'
  })
  return (
    <LoadingLayout>
      <div className={`grid gap-4 ${gridColsClass}`}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </LoadingLayout>
  )
}

export function AppRouter() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id/read" element={<ReaderPage />} />
          <Route path="/concepts" element={<ConceptsPage />} />
          <Route path="/concepts/:id" element={<ConceptDetailPage />} />
          <Route path="/organisms" element={<OrganismExplorerPage />} />
          <Route path="/organisms/:organismId" element={<OrganismDetailPage />} />
          <Route path="/laboratory" element={<LaboratoryPage />} />
          <Route path="/laboratory/unit-converter" element={<UnitConverterPage />} />
          <Route path="/laboratory/calculators/:calculatorId" element={<CalculatorDetailPage />} />
          <Route path="/laboratory/clinical" element={<ClinicalLaboratoryPage />} />
          <Route path="/laboratory/clinical/:category/:id" element={<ClinicalDetailPage />} />
          <Route path="/laboratory/:category/:id" element={<LaboratoryDetailPage />} />
          <Route path="/comparison" element={<ComparisonStudioPage />} />
          <Route path="/comparison/new" element={<NewComparisonPage />} />
          <Route path="/comparison/explore" element={<ExploreComparisonsPage />} />
          <Route path="/comparison/:id" element={<ComparisonWorkspacePage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
