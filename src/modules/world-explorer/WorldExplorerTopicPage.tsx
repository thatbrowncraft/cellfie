import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretDown, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, EmptyState } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import { getGlobeCountryById } from '@/core/world-explorer/countries'
import { getAllCountryProfiles } from '@/core/world-explorer/registry'
import { getTopicCatalogEntry } from '@/core/world-explorer/sectionMeta'
import type { CountryProfile, GlobeCountry, LessonSection } from '@/core/world-explorer/types'
import { SectionBody } from './components/CountryLessonView'

interface TopicCountryEntry {
  country: GlobeCountry
  profile: CountryProfile
}

/**
 * World Explorer — "browse by topic" view. The landing page's globe
 * flow is country-first (pick a country, see every topic about it);
 * this route flips that around — pick a topic once, see that one
 * topic across every curated country, grouped by continent, so a
 * student can revise "how government works" or "what everyone
 * exports" as a single pass instead of clicking through 58 country
 * pages one at a time.
 *
 * Reuses the exact same section data every country page already
 * has — `CountryProfile.sections` via `getAllCountryProfiles()` — so
 * there's no second content system to keep in sync. A topic only
 * shows the countries that actually have that section curated; the
 * rest are just not listed yet rather than shown empty.
 */
export function WorldExplorerTopicPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const topic = topicId ? getTopicCatalogEntry(topicId) : undefined

  const allProfiles = useMemo(() => getAllCountryProfiles(), [])

  const entries = useMemo<TopicCountryEntry[]>(() => {
    if (!topic) return []
    return allProfiles
      .map((profile) => {
        const country = getGlobeCountryById(profile.id)
        if (!country) return null
        return resolveTopicContent(profile, topic.id) ? { country, profile } : null
      })
      .filter((e): e is TopicCountryEntry => e !== null)
  }, [topic, allProfiles])

  const grouped = useMemo(() => {
    const byContinent = new Map<string, TopicCountryEntry[]>()
    for (const entry of entries) {
      const list = byContinent.get(entry.country.continent) ?? []
      list.push(entry)
      byContinent.set(entry.country.continent, list)
    }
    for (const list of byContinent.values()) {
      list.sort((a, b) => a.country.name.localeCompare(b.country.name))
    }
    return Array.from(byContinent.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [entries])

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!topic) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Topic not found"
          description="This isn't one of World Explorer's topics."
          action={
            <Button variant="secondary" onClick={() => navigate('/exam-prep/world-explorer')}>
              Back to World Explorer
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
        <span className="font-medium text-ink-primary">{topic.label}</span>
      </nav>

      <Button
        variant="tertiary"
        size="small"
        icon={<ArrowLeft size={16} />}
        onClick={() => navigate('/exam-prep/world-explorer')}
        className="mb-4"
      >
        Back to World Explorer
      </Button>

      <header className="mb-6">
        <h1 className="font-display text-display font-semibold text-ink-primary">{topic.label}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">One topic, every country — revise it in a single pass.</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          title="Not curated yet"
          description="No country has this topic written up yet — check back as World Explorer's profiles grow."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([continent, list]) => (
            <section key={continent}>
              <h2 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                {continent} · {list.length} {list.length === 1 ? 'country' : 'countries'}
              </h2>
              <div className="flex flex-col gap-3">
                {list.map(({ country, profile }) => (
                  <TopicCountryCard
                    key={country.id}
                    country={country}
                    profile={profile}
                    topicId={topic.id}
                    isOpen={openIds.has(country.id)}
                    onToggle={() => toggle(country.id)}
                    onOpenCountry={() => navigate(`/exam-prep/world-explorer/${country.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-center font-ui text-micro text-ink-tertiary">
        {entries.length} of {allProfiles.length} curated countries have this topic written up so far
      </p>
    </div>
  )
}

function TopicCountryCard({
  country,
  profile,
  topicId,
  isOpen,
  onToggle,
  onOpenCountry
}: {
  country: GlobeCountry
  profile: CountryProfile
  topicId: string
  isOpen: boolean
  onToggle: () => void
  onOpenCountry: () => void
}) {
  const content = resolveTopicContent(profile, topicId)
  if (!content) return null

  return (
    <div className="rounded-md border border-border bg-surface">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`topic-country-${country.id}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="font-ui text-ui font-semibold text-ink-primary">
          {country.flagEmoji} {country.name}
        </span>
        <CaretDown
          size={18}
          className={cn('shrink-0 text-ink-tertiary transition-transform duration-micro ease-standard', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      {isOpen && (
        <div id={`topic-country-${country.id}`} className="flex flex-col gap-3 px-4 pb-4">
          {content}
          <button type="button" onClick={onOpenCountry} className="self-start font-ui text-micro font-medium text-terracotta hover:underline">
            Open {country.name}'s full page →
          </button>
        </div>
      )}
    </div>
  )
}

/** Resolves a topic id to renderable content for one country — a normal `LessonSection` for most topics, or the special quick-revision / exam-focus / memory-hook summaries for the other three. */
function resolveTopicContent(profile: CountryProfile, topicId: string) {
  if (topicId === 'quick-revision') {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-body text-body font-medium text-ink-primary">{profile.quickRevision.oneLineDefinition}</p>
        {profile.quickRevision.keyFacts.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
            {profile.quickRevision.keyFacts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (topicId === 'exam-focus') {
    return (
      <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
        {profile.examFocus.highYieldFacts.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    )
  }

  if (topicId === 'memory-hook') {
    return <p className="font-ui text-body italic text-ink-primary">{profile.genZNote}</p>
  }

  const section: LessonSection | undefined = profile.sections.find((s) => s.id === topicId)
  if (!section) return null
  return <SectionBody section={section} />
}
