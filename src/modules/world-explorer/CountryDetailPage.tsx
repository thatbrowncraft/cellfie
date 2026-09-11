import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, EmptyState } from '@/shared/components'
import { getGlobeCountryById } from '@/core/world-explorer/countries'
import { getCountryProfile } from '@/core/world-explorer/registry'
import {
  CountryExamFocusView,
  CountryLessonView,
  CountryMemoryHookView,
  CountryQuickRevisionView,
  EducationalUseNotice
} from './components/CountryLessonView'

/**
 * World Explorer — country detail page. One reusable page renders
 * every country: the "At a Glance" header comes from the lightweight
 * `GlobeCountry` list (always available), and the deep sections /
 * quick revision / exam focus come from `core/world-explorer/registry.ts`
 * ONLY where a curated `CountryProfile` JSON exists for that id — see
 * that file's doc comment for why not every plotted country has one yet
 * (brief §10: quality over volume). A country with no deep profile
 * still gets a real, useful page — just a shorter one — rather than a
 * broken link or invented content.
 */
export function CountryDetailPage() {
  const { countryId } = useParams<{ countryId: string }>()
  const navigate = useNavigate()

  const country = useMemo(() => (countryId ? getGlobeCountryById(countryId) : undefined), [countryId])
  const profile = useMemo(() => (countryId ? getCountryProfile(countryId) : undefined), [countryId])

  if (!country) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Country not found"
          description="This country isn't in World Explorer's list yet."
          action={
            <Button variant="secondary" onClick={() => navigate('/exam-prep/world-explorer')}>
              Back to the globe
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
        <span className="font-medium text-ink-primary">{country.name}</span>
      </nav>

      <Button
        variant="tertiary"
        size="small"
        icon={<ArrowLeft size={16} />}
        onClick={() => navigate('/exam-prep/world-explorer')}
        className="mb-4"
      >
        Back to the globe
      </Button>

      <header className="mb-6">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{country.continent}</p>
        <h1 className="mt-1 font-display text-display font-semibold text-ink-primary">
          {country.flagEmoji} {country.name}
        </h1>
        {country.officialName && country.officialName !== country.name && (
          <p className="mt-1 font-body text-body text-ink-secondary">{country.officialName}</p>
        )}
        {profile?.genZNote && <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{profile.genZNote}</p>}
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-5 sm:grid-cols-4">
        <p className="col-span-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary sm:col-span-4">🌍 At a glance</p>
        <AtAGlanceItem label="Capital" value={country.capital} />
        <AtAGlanceItem label="Continent" value={country.continent} />
        <AtAGlanceItem label="Currency" value={country.currency} />
        <AtAGlanceItem label="Language(s)" value={country.languages.join(', ')} />
      </section>

      {profile ? (
        <div className="flex flex-col gap-6">
          <CountryLessonView profile={profile} />
          <CountryQuickRevisionView title={profile.name} quickRevision={profile.quickRevision} />
          <CountryExamFocusView title={profile.name} examFocus={profile.examFocus} />
          <CountryMemoryHookView genZNote={profile.genZNote} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <EducationalUseNotice />
          <EmptyState
            icon={<WarningCircle size={32} />}
            title="Deeper profile coming soon"
            description={`${country.name} is on the globe with its core facts above, but its full Geography / Culture / Government / India-relations profile hasn't been curated yet.`}
          />
        </div>
      )}
    </div>
  )
}

function AtAGlanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="font-body text-body font-medium text-ink-primary">{value}</p>
    </div>
  )
}
