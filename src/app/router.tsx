import { Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from '../modules/dashboard/DashboardPage'
import { LibraryPage } from '../modules/library/LibraryPage'
import { ReaderPage } from '../modules/library/reader/ReaderPage'
import { ConceptsPage } from '../modules/concepts/ConceptsPage'
import { ConceptDetailPage } from '../modules/concepts/ConceptDetailPage'
import { OrganismExplorerPage } from '../modules/organism-explorer/OrganismExplorerPage'
import { LaboratoryPage } from '../modules/laboratory/LaboratoryPage'
import { ComparisonStudioPage } from '../modules/comparison-studio/ComparisonStudioPage'
import { NotesPage } from '../modules/notes/NotesPage'
import { SettingsPage } from '../modules/settings/SettingsPage'
import { NotFoundPage } from '../modules/not-found/NotFoundPage'

function HighlightsPage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-h1 font-bold text-ink-primary">Highlights</h1>
      <p className="mt-1 font-ui text-body text-ink-secondary">
        All your saved key passages and highlighted text across your books.
      </p>
    </div>
  )
}

function BookmarksPage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-h1 font-bold text-ink-primary">Bookmarks</h1>
      <p className="mt-1 font-ui text-body text-ink-secondary">
        All your saved bookmarks and reading location markers.
      </p>
    </div>
  )
}

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/:id/read" element={<ReaderPage />} />
        <Route path="/concepts" element={<ConceptsPage />} />
        <Route path="/concepts/:id" element={<ConceptDetailPage />} />
        <Route path="/organisms" element={<OrganismExplorerPage />} />
        <Route path="/laboratory" element={<LaboratoryPage />} />
        <Route path="/comparison" element={<ComparisonStudioPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/highlights" element={<HighlightsPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
