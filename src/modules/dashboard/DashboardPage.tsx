import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Stack, Highlighter, Note, Bookmark, Flame, Clock } from 'phosphor-react'
import { db } from '../../core/db'
import { getTotalReadingSeconds } from '../../core/db/stats'
import { getRecentlyUsedConcepts } from '../../core/db/concepts'
import { computeStatsFromRecords } from '../../core/stats/computeStats'
import { DashboardLayout } from '../../shared/layouts/DashboardLayout'
import { Card, CardBody } from '../../shared/components/Card'
import { EmptyState } from '../../shared/components/EmptyState'
import { KnowledgeCard } from './KnowledgeCard'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-olive">
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

export function DashboardPage() {
  const navigate = useNavigate()
  const items = useLiveQuery(() => db.libraryItems.toArray(), [], [])
  const highlights = useLiveQuery(() => db.highlights.toArray(), [], [])
  const notes = useLiveQuery(() => db.notes.toArray(), [], [])
  const bookmarks = useLiveQuery(() => db.readerBookmarks.toArray(), [], [])
  const totalReadingSeconds = useLiveQuery(() => getTotalReadingSeconds(), [], 0)
  const conceptCount = useLiveQuery(() => db.concepts.count(), [], 0)
  const recentlyExplored = useLiveQuery(() => getRecentlyUsedConcepts(6), [], [])

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
    ? `${stats.readingStreakDays}-day reading streak — keep it going.`
    : 'Nothing scheduled, nothing overdue — just pick up where curiosity left off.'

  return (
    <DashboardLayout title="Welcome back" subtitle={subtitle}>
      <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
        <h2 className="mb-4 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          Continue reading
        </h2>
        {continueReading.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="Continue exploring"
            description="Once you've opened a book, it'll pick up right here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 w-full min-w-0">
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
        )}
      </section>

      <StatCard
        icon={<Stack size={22} />}
        label="Books in library"
        value={String(stats.booksInLibrary)}
        hint={`${stats.booksOpened} opened`}
      />
      <StatCard
        icon={<BookOpen size={22} />}
        label="Pages read"
        value={stats.pagesRead.toLocaleString()}
      />
      <StatCard
        icon={<Highlighter size={22} />}
        label="Highlights"
        value={String(stats.highlightCount)}
      />
      <StatCard
        icon={<Note size={22} />}
        label="Notes"
        value={String(stats.noteCount)}
      />
      <StatCard
        icon={<Bookmark size={22} />}
        label="Bookmarks"
        value={String(stats.bookmarkCount)}
      />
      <StatCard
        icon={<Flame size={22} />}
        label="Reading streak"
        value={
          stats.readingStreakDays > 0
            ? `${stats.readingStreakDays} day${stats.readingStreakDays > 1 ? 's' : ''}`
            : '0 days'
        }
      />
      <StatCard
        icon={<Clock size={22} />}
        label="Time spent reading"
        value={formatDuration(stats.totalReadingSeconds)}
        hint="tracked while a book is open"
      />

      <KnowledgeCard conceptCount={conceptCount} stats={stats} recentlyExplored={recentlyExplored} />
    </DashboardLayout>
  )
}
