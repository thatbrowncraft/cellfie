import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Bookmarks,
  Clock,
  Fire,
  GitBranch,
  Highlighter,
  NotePencil,
  Stack
} from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { Card, CardBody, EmptyState } from '../../shared/components'
import { db, type Concept, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../../core/db'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { getTotalReadingSeconds } from '../../core/db/reading-time'
import { computeStatsFromRecords } from '../../core/stats'
import { getRecentlyUsedConcepts } from '../../core/concepts'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-olive" aria-hidden>
          {icon}
        </span>
        <span className="flex flex-col">
          <span className="font-display text-h2 font-semibold text-ink-primary">{value}</span>
          <span className="font-ui text-caption text-ink-secondary">{label}</span>
          {hint && <span className="mt-0.5 font-ui text-micro text-ink-tertiary">{hint}</span>}
        </span>
      </CardBody>
    </Card>
  )
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return '< 1 min'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return `${hours}h ${minutes}m`
}

/**
 * Dashboard — Sprint 2 §9, the Reading Dashboard. Every number is derived
 * live from the same Dexie tables the rest of the app writes to
 * (`useLiveQuery`, matching the pattern used everywhere else), so it
 * updates the moment a highlight, note, or bookmark is added — no
 * separate analytics pipeline. "Continue reading" keeps the dashboard's
 * original continuity focus (SDD §8) front and center above the numbers.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.toArray(), [], [])
  const highlights = useLiveQuery<Highlight[]>(() => db.highlights.toArray(), [], [])
  const notes = useLiveQuery<Note[]>(() => db.notes.toArray(), [], [])
  const bookmarks = useLiveQuery<ReaderBookmark[]>(() => db.readerBookmarks.toArray(), [], [])
  const totalReadingSeconds = useLiveQuery<number>(() => getTotalReadingSeconds(), [], 0)
  const conceptCount = useLiveQuery<number>(() => db.concepts.count(), [], 0)
  const recentlyExplored = useLiveQuery<Concept[]>(() => getRecentlyUsedConcepts(6), [], [])

  const stats = useMemo(
    () => computeStatsFromRecords(items, highlights, notes, bookmarks, totalReadingSeconds),
    [items, highlights, notes, bookmarks, totalReadingSeconds]
  )

  const continueReading = useMemo(
    () =>
      [...items]
        .filter((i) => i.lastOpenedAt)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, 3),
    [items]
  )

  const hasAnyActivity = stats.booksOpened > 0 || stats.highlightCount > 0 || stats.noteCount > 0

  const subtitle = hasAnyActivity
    ? stats.readingStreakDays > 0
      ? `${stats.readingStreakDays}-day reading streak — keep it going.`
      : 'Nothing scheduled, nothing overdue — just pick up where curiosity left off.'
    : 'Import a PDF from your Library to get started.'

  return (
    <DashboardLayout title="Welcome back" subtitle={subtitle}>
      <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
        <h2 className="mb-4 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Continue reading</h2>
        {continueReading.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="Continue exploring"
            description="Once you've opened a book, it'll pick up right here."
          />
        ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 w-full">
            {continueReading.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/library/${item.id}/read`)}
                className="flex flex-col items-start gap-1 rounded-sm border border-border p-4 text-left transition-colors hover:border-ink-secondary w-full min-w-0"
              >
                <span className="w-full min-w-0 break-words font-display text-h3 font-medium text-ink-primary">
                  {item.title}
                </span>
                <span className="font-ui text-caption text-ink-tertiary">
                  {item.lastPageRead ? `Page ${item.lastPageRead}` : 'Not started yet'}
                </span>
              </button>
            ))}
          </div>

          </div>
        )}
      </section>

      <StatCard icon={<Stack size={22} />} label="Books in library" value={String(stats.booksInLibrary)} hint={`${stats.booksOpened} opened`} />
      <StatCard icon={<BookOpen size={22} />} label="Pages read" value={stats.pagesRead.toLocaleString()} />
      <StatCard icon={<Highlighter size={22} />} label="Highlights" value={String(stats.highlightCount)} />
      <StatCard icon={<NotePencil size={22} />} label="Notes" value={String(stats.noteCount)} />
      <StatCard icon={<Bookmarks size={22} />} label="Bookmarks" value={String(stats.bookmarkCount)} />
      <StatCard icon={<Fire size={22} />} label="Reading streak" value={`${stats.readingStreakDays} day${stats.readingStreakDays === 1 ? '' : 's'}`} />
      <StatCard icon={<Clock size={22} />} label="Time spent reading" value={formatDuration(stats.totalReadingSeconds)} hint="Tracked while a book is open" />

      <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Knowledge</h2>
          <button
            type="button"
            onClick={() => navigate('/concepts')}
            className="font-ui text-caption font-medium text-olive hover:underline"
          >
            Open Concepts
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <GitBranch size={20} className="text-olive" aria-hidden />
            <div className="flex flex-col">
              <span className="font-display text-h3 font-semibold text-ink-primary">{conceptCount}</span>
              <span className="font-ui text-micro text-ink-tertiary">Concepts</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotePencil size={20} className="text-olive" aria-hidden />
            <div className="flex flex-col">
              <span className="font-display text-h3 font-semibold text-ink-primary">{stats.noteCount}</span>
              <span className="font-ui text-micro text-ink-tertiary">Notes</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Highlighter size={20} className="text-olive" aria-hidden />
            <div className="flex flex-col">
              <span className="font-display text-h3 font-semibold text-ink-primary">{stats.highlightCount}</span>
              <span className="font-ui text-micro text-ink-tertiary">Highlights</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Stack size={20} className="text-olive" aria-hidden />
            <div className="flex flex-col">
              <span className="font-display text-h3 font-semibold text-ink-primary">{stats.booksInLibrary}</span>
              <span className="font-ui text-micro text-ink-tertiary">Books</span>
            </div>
          </div>
        </div>

        {recentlyExplored.length > 0 && (
          <div>
            <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              Recently explored
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentlyExplored.map((concept) => (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => navigate(`/concepts/${concept.id}`)}
                  className="rounded-full border border-border bg-canvas px-3 py-1.5 font-ui text-caption text-ink-primary hover:bg-surface-raised"
                >
                  {concept.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}
