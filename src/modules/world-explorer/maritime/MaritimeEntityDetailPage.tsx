import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, EmptyState } from '@/shared/components'
import { getIndiaMaritimeProfile, getMaritimeProfile } from '@/core/world-explorer/maritime/registry'
import type { MaritimeCategory } from '@/core/world-explorer/maritime/types'
import {
  CountryExamFocusView,
  CountryLessonView,
  CountryMemoryHookView,
  CountryQuickRevisionView
} from '../components/CountryLessonView'

const VALID_CATEGORIES: MaritimeCategory[] = ['ocean', 'sea', 'chokepoint', 'route', 'ecosystem', 'india-maritime']

/**
 * Detail page for a single ocean / sea / chokepoint / route / ecosystem,
 * or the dedicated India-maritime profile — one generic page for all
 * six, keyed by the `:category/:entityId` route params.
 *
 * Deliberately reuses `CountryLessonView` and friends unmodified: a
 * `MaritimeProfile` has the exact same shape as `CountryProfile`
 * (see `core/world-explorer/maritime/types.ts`), so there's no new
 * rendering component to build or keep in sync with the country one.
 */
export function MaritimeEntityDetailPage() {
  const { category, entityId } = useParams<{ category: string; entityId: string }>()
  const navigate = useNavigate()

  const isValidCategory = (c: string | undefined): c is MaritimeCategory =>
    !!c && (VALID_CATEGORIES as string[]).includes(c)

  const profile = useMemo(() => {
    if (!isValidCategory(category) || !entityId) return undefined
    if (category === 'india-maritime') return getIndiaMaritimeProfile() ?? undefined
    return getMaritimeProfile(category, entityId)
  }, [category, entityId])

  if (!profile) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Not found"
          description="This ocean, sea, chokepoint, route or ecosystem isn't in Maritime World yet."
          action={
            <Button variant="secondary" onClick={() => navigate('/exam-prep/world-explorer/maritime')}>
              Back to Maritime World
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/exam-prep')} className="hover:text-ink-secondary hover:underline">
          Exam Prep
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate('/exam-prep/world-explorer')}
          className="hover:text-ink-secondary hover:underline"
        >
          World Explorer
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate('/exam-prep/world-explorer/maritime')}
          className="hover:text-ink-secondary hover:underline"
        >
          Maritime World
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{profile.name}</span>
      </nav>

      <Button
        variant="tertiary"
        size="small"
        icon={<ArrowLeft size={16} />}
        onClick={() => navigate('/exam-prep/world-explorer/maritime')}
        className="mb-4"
      >
        Back to Maritime World
      </Button>

      <header className="mb-6">
        <h1 className="font-display text-display font-semibold text-ink-primary">{profile.name}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{profile.genZNote}</p>
      </header>

      <div className="flex flex-col gap-6">
        <CountryLessonView profile={profile} />
        <CountryQuickRevisionView title={profile.name} quickRevision={profile.quickRevision} />
        <CountryExamFocusView title={profile.name} examFocus={profile.examFocus} />
        <CountryMemoryHookView genZNote={profile.genZNote} />
      </div>
    </div>
  )
}
