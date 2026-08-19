import { useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Bookmarks,
  Bug,
  Clock,
  Fire,
  Flask,
  GitBranch,
  Highlighter,
  NotePencil,
  Scales,
  Stack
} from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { Button, Card, CardBody, EmptyState } from '../../shared/components'
import { db, type Concept, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../../core/db'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { getTotalReadingSeconds } from '../../core/db/reading-time'
import { computeStatsFromRecords } from '../../core/stats'
import { getRecentlyUsedConcepts } from '../../core/concepts'
import { getOrganismById, type OrganismProfile } from '../../core/organisms'
import { getRecentlyViewedOrganismIds } from '../../core/organisms/recentlyViewed'
import { useLocalStorage } from '../../shared/hooks'
import { pickDashboardQuote } from '../../core/dashboard/quotes'
import { DASHBOARD_HUMOR } from '../../core/dashboard/humor'
import { FloatingScienceLayer } from './components/FloatingScienceLayer'

/** Dashboard never shows more than this many items in any recent/saved preview row (requested change #8). */
const MAX_PREVIEW_ITEMS = 4

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  /** Dashboard-only subtle Gen Z micro-copy (requested change #3) — never passed by any other page, since StatCard itself is local to this file. */
  humor?: string
  onClick?: () => void
}

function StatCard({ icon, label, value, hint, humor, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left transition-transform active:scale-95 ${onClick ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
    >
      <Card>
        <CardBody className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-olive" aria-hidden>
            {icon}
          </span>
          <span className="flex flex-col">
            <span className="font-display text-h2 font-semibold text-ink-primary">{value}</span>
            <span className="font-ui text-caption text-ink-secondary">{label}</span>
            {hint && <span className="mt-0.5 font-ui text-micro text-ink-tertiary">{hint}</span>}
            {humor && <span className="mt-1 font-ui text-micro italic text-ink-tertiary/80">{humor}</span>}
          </span>
        </CardBody>
      </Card>
    </button>
  )
}

interface PreviewItem {
  key: string
  title: string
  subtitle?: string
  onClick: () => void
}

/**
 * PreviewSection — the shared shape behind "Saved organisms" (#4), "Saved
 * lab items" (#5), and "Saved comparisons" (#6). Local to the Dashboard
 * only. Always renders at most MAX_PREVIEW_ITEMS items — the Dashboard is
 * a summary, never a database browser (requested change #8) — with a
 * clear "Open [section]" action, and a tasteful empty state when a
 * section has nothing to show yet.
 */
function PreviewSection({
  title,
  humor,
  openLabel,
  onOpen,
  items,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction
}: {
  title: string
  humor: string
  openLabel: string
  onOpen: () => void
  items: PreviewItem[]
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
}) {
  return (
    <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</h2>
        <button
          type="button"
          onClick={onOpen}
          className="whitespace-nowrap font-ui text-caption font-medium text-olive hover:underline"
        >
          {openLabel}
        </button>
      </div>
      <p className="mb-4 font-body text-caption italic text-ink-tertiary">{humor}</p>

      {items.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            emptyActionLabel && onEmptyAction ? (
              <Button size="small" variant="secondary" onClick={onEmptyAction}>
                {emptyActionLabel}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="flex w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-sm border border-border p-4 text-left transition-colors duration-micro hover:bg-surface-raised"
            >
              <span className="w-full min-w-0 truncate font-display text-h3 font-medium text-ink-primary">
                {item.title}
              </span>
              {item.subtitle && (
                <span className="w-full min-w-0 truncate font-ui text-caption text-ink-tertiary">{item.subtitle}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
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
 * Dashboard — Sprint 2 §9, the Reading Dashboard, extended by the
 * Dashboard Vitality pass. Every number is still derived live from the
 * same Dexie tables the rest of the app writes to (`useLiveQuery`), so
 * it updates the moment a highlight, note, bookmark, or organism visit
 * happens — no separate analytics pipeline. "Continue reading" keeps the
 * dashboard's original continuity focus (SDD §8) front and center above
 * the numbers.
 *
 * Dashboard Vitality pass adds: a capped (max 4) "Continue reading" row,
 * a rotating curated study quote in place of the old static streak
 * line, subtle dashboard-only Gen Z micro-copy, capped "Saved organisms"
 * (backed by core/organisms/recentlyViewed.ts — the only genuinely new
 * persisted data this pass introduces, stored in the existing
 * `appSettings` table), and Lab/Comparison Studio preview sections.
 * Lab and Comparison Studio do not yet persist any protocols or
 * comparisons anywhere in Cellfie (see LaboratoryPage.tsx /
 * ComparisonStudioPage.tsx — both are still empty-state stubs), so
 * those two sections honestly render their real empty state and link to
 * the real destination rather than inventing sample data.
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
  const recentOrganismIds = useLiveQuery<string[]>(
    () => getRecentlyViewedOrganismIds(MAX_PREVIEW_ITEMS),
    [],
    []
  )

  const stats = useMemo(
    () => computeStatsFromRecords(items, highlights, notes, bookmarks, totalReadingSeconds),
    [items, highlights, notes, bookmarks, totalReadingSeconds]
  )

  const continueReading = useMemo(
    () =>
      [...items]
        .filter((i) => i.lastOpenedAt)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, MAX_PREVIEW_ITEMS),
    [items]
  )

  const recentOrganisms = useMemo(
    () =>
      recentOrganismIds
        .map((id) => getOrganismById(id))
        .filter((o): o is OrganismProfile => Boolean(o))
        .slice(0, MAX_PREVIEW_ITEMS),
    [recentOrganismIds]
  )

  // Motivational quote (requested change #2) — picked once per Dashboard
  // visit/mount, avoiding an immediate repeat of whatever was shown last
  // time (persisted client-side only, via localStorage).
  const [lastQuote, setLastQuote] = useLocalStorage<string>('dashboard:lastQuote', '')
  const quote = useMemo(() => pickDashboardQuote(lastQuote || undefined), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLastQuote(quote)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  const hasAnyActivity = stats.booksOpened > 0 || stats.highlightCount > 0 || stats.noteCount > 0

  const subtitle = hasAnyActivity
    ? stats.readingStreakDays > 0
      ? quote
      : 'Nothing scheduled, nothing overdue — just pick up where curiosity left off.'
    : 'Import a PDF from your Library to get started.'

  return (
    <div className="relative overflow-hidden">
      <FloatingScienceLayer />
      <div className="relative z-10">
        <DashboardLayout title="Welcome back" subtitle={subtitle}>
          <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
            <h2 className="mb-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              Continue reading
            </h2>
            <p className="mb-4 font-body text-caption italic text-ink-tertiary">{DASHBOARD_HUMOR.reading}</p>
            {continueReading.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={32} />}
                title="Continue exploring"
                description="Once you've opened a book, it'll pick up right here."
              />
            ) : (
              <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {continueReading.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/library/${item.id}/read`)}
                    className="flex w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-sm border border-border p-4 text-left transition-colors duration-micro hover:bg-surface-raised"
                  >
                    <span className="w-full min-w-0 truncate font-display text-h3 font-medium text-ink-primary">
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
            humor={DASHBOARD_HUMOR.books}
            onClick={() => navigate('/library')}
          />
          <StatCard icon={<BookOpen size={22} />} label="Pages read" value={stats.pagesRead.toLocaleString()} onClick={() => navigate('/library')} />
          <StatCard
            icon={<Highlighter size={22} />}
            label="Highlights"
            value={String(stats.highlightCount)}
            humor={DASHBOARD_HUMOR.highlights}
            onClick={() => navigate('/highlights')}
          />
          <StatCard
            icon={<NotePencil size={22} />}
            label="Notes"
            value={String(stats.noteCount)}
            humor={DASHBOARD_HUMOR.notes}
            onClick={() => navigate('/notes')}
          />
          <StatCard
            icon={<Bookmarks size={22} />}
            label="Bookmarks"
            value={String(stats.bookmarkCount)}
            humor={DASHBOARD_HUMOR.bookmarks}
            onClick={() => navigate('/bookmarks')}
          />
          <StatCard icon={<Fire size={22} />} label="Reading streak" value={`${stats.readingStreakDays} day${stats.readingStreakDays === 1 ? '' : 's'}`} />
          <StatCard icon={<Clock size={22} />} label="Time spent reading" value={formatDuration(stats.totalReadingSeconds)} hint="Tracked while a book is open" />

          <section className="rounded-md border border-border bg-surface p-6 md:col-span-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Knowledge</h2>
              <button
                type="button"
                onClick={() => navigate('/concepts')}
                className="font-ui text-caption font-medium text-olive hover:underline"
              >
                Open Concepts
              </button>
            </div>
            <p className="mb-4 font-body text-caption italic text-ink-tertiary">{DASHBOARD_HUMOR.concepts}</p>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <button type="button" onClick={() => navigate('/concepts')} className="flex items-center gap-3 text-left hover:opacity-80">
                <GitBranch size={20} className="text-olive" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-display text-h3 font-semibold text-ink-primary">{conceptCount}</span>
                  <span className="font-ui text-micro text-ink-tertiary">Concepts</span>
                </div>
              </button>
              <button type="button" onClick={() => navigate('/notes')} className="flex items-center gap-3 text-left hover:opacity-80">
                <NotePencil size={20} className="text-olive" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-display text-h3 font-semibold text-ink-primary">{stats.noteCount}</span>
                  <span className="font-ui text-micro text-ink-tertiary">Notes</span>
                </div>
              </button>
              <button type="button" onClick={() => navigate('/highlights')} className="flex items-center gap-3 text-left hover:opacity-80">
                <Highlighter size={20} className="text-olive" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-display text-h3 font-semibold text-ink-primary">{stats.highlightCount}</span>
                  <span className="font-ui text-micro text-ink-tertiary">Highlights</span>
                </div>
              </button>
              <button type="button" onClick={() => navigate('/library')} className="flex items-center gap-3 text-left hover:opacity-80">
                <Stack size={20} className="text-olive" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-display text-h3 font-semibold text-ink-primary">{stats.booksInLibrary}</span>
                  <span className="font-ui text-micro text-ink-tertiary">Books</span>
                </div>
              </button>
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

          <PreviewSection
            title="Organisms"
            humor={DASHBOARD_HUMOR.organisms}
            openLabel="Open Organisms"
            onOpen={() => navigate('/organisms')}
            items={recentOrganisms.map((organism) => ({
              key: organism.id,
              title: organism.scientificName,
              subtitle: organism.commonName,
              onClick: () => navigate(`/organisms/${organism.id}`)
            }))}
            emptyIcon={<Bug size={32} />}
            emptyTitle="No organisms explored yet"
            emptyDescription="Open a profile in Organism Explorer and it'll show up here next time."
            emptyActionLabel="Browse organisms"
            onEmptyAction={() => navigate('/organisms')}
          />

          <PreviewSection
            title="Lab"
            humor={DASHBOARD_HUMOR.lab}
            openLabel="Open Lab"
            onOpen={() => navigate('/laboratory')}
            items={[]}
            emptyIcon={<Flask size={32} />}
            emptyTitle="No saved lab items yet"
            emptyDescription="Protocols, media prep, and reference tools you save will show up here."
            emptyActionLabel="Open Lab"
            onEmptyAction={() => navigate('/laboratory')}
          />

          <PreviewSection
            title="Comparisons"
            humor={DASHBOARD_HUMOR.comparisons}
            openLabel="Open Comparison Studio"
            onOpen={() => navigate('/comparison')}
            items={[]}
            emptyIcon={<Scales size={32} />}
            emptyTitle="No saved comparisons yet"
            emptyDescription="Comparisons you build or favorite in Comparison Studio will show up here."
            emptyActionLabel="Open Comparison Studio"
            onEmptyAction={() => navigate('/comparison')}
          />
        </DashboardLayout>
      </div>
    </div>
  )
}
