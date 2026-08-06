import { Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from '../modules/dashboard/DashboardPage'
import { LibraryPage } from '../modules/library/LibraryPage'
import { ConceptsPage } from '../modules/concepts/ConceptsPage'
import { OrganismExplorerPage } from '../modules/organism-explorer/OrganismExplorerPage'
import { LaboratoryPage } from '../modules/laboratory/LaboratoryPage'
import { ComparisonStudioPage } from '../modules/comparison-studio/ComparisonStudioPage'
import { NotesPage } from '../modules/notes/NotesPage'
import { SettingsPage } from '../modules/settings/SettingsPage'
import { NotFoundPage } from '../modules/not-found/NotFoundPage'

/**
 * Router — Task 3 scope: routing + polished placeholders only, per
 * config/navigation.ts. Every module owns its own page component so
 * future phases can add real content/state without touching this file
 * beyond adding new <Route> entries.
 */
export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/concepts" element={<ConceptsPage />} />
        <Route path="/organisms" element={<OrganismExplorerPage />} />
        <Route path="/laboratory" element={<LaboratoryPage />} />
        <Route path="/comparison" element={<ComparisonStudioPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
