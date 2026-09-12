import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, CaretRight } from '@phosphor-icons/react'
import { Button, Card, CardBody, EmptyState, SearchField } from '@/shared/components'
import { GLOBE_COUNTRIES, searchGlobeCountries } from '@/core/world-explorer/countries'
import { countCountryProfiles, getCountryProfile } from '@/core/world-explorer/registry'
import { TOPIC_CATALOG } from '@/core/world-explorer/sectionMeta'
import { DEFAULT_GLOBE_STYLE, type GlobeStyleId } from '@/core/world-explorer/globeStyle'
import { getSavedGlobeStyle, saveGlobeStyle } from '@/core/world-explorer/globeStylePreference'
import { Globe } from './components/Globe'
import { GlobeStyleSelector } from './components/GlobeStyleSelector'
import { MaritimeCrossLinks } from './maritime/components/MaritimeCrossLinks'
import {
  CountryExamFocusView,
  CountryLessonView,
  CountryMemoryHookView,
  CountryQuickRevisionView,
  EducationalUseNotice
} from './components/CountryLessonView'

/**
 * World Explorer — landing page. The globe is the primary entry point
 * (brief §3: "do not make the user navigate through a giant
 * alphabetical list before they can explore the globe"); the search
 * field below it is a secondary, optional shortcut for finding one
 * specific country quickly rather than the main way in.
 */
export function WorldExplorerPage() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [globeStyle, setGlobeStyle] = useState<GlobeStyleId>(DEFAULT_GLOBE_STYLE)

  // Load the last-saved Globe Style once on mount. Not blocking — the
  // globe renders immediately in the default 'dark' style and swaps
  // over the moment the saved preference resolves, rather than holding
  // up the page behind a Dexie read.
  useEffect(() => {
    let cancelled = false
    getSavedGlobeStyle().then((style) => {
      if (!cancelled) setGlobeStyle(style)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleStyleChange(style: GlobeStyleId) {
    setGlobeStyle(style)
    void saveGlobeStyle(style)
  }

  const selected = useMemo(() => GLOBE_COUNTRIES.find((c) => c.id === selectedId) ?? null, [selectedId])
  const selectedProfile = useMemo(() => (selected ? getCountryProfile(selected.id) : undefined), [selected])
  const searchResults = useMemo(() => searchGlobeCountries(query).slice(0, 8), [query])
  const deepProfileCount = countCountryProfiles()

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/exam-prep')} className="hover:text-ink-secondary hover:underline">
          Exam Prep
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">World Explorer</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate('/exam-prep')} className="mb-4">
        Back to Exam Prep
      </Button>

      <header className="mb-6">
        <h1 className="font-display text-display font-semibold text-ink-primary">🌍 World Explorer</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">
          Drag the globe, tap a country, learn something you can actually use in an exam.
        </p>
      </header>

      <div className="mb-6">
        <EducationalUseNotice />
      </div>

      <Card>
        <CardBody className="flex flex-col items-center gap-4">
          <GlobeStyleSelector value={globeStyle} onChange={handleStyleChange} />
          <Globe selectedCountryId={selectedId} onSelectCountry={setSelectedId} style={globeStyle} />

          <div className="w-full max-w-sm">
            <SearchField placeholder="Or find a country by name…" onChange={setQuery} />
            {query && (
              <div className="mt-2 flex flex-col gap-1">
                {searchResults.length === 0 ? (
                  <p className="px-1 font-body text-caption text-ink-tertiary">No countries match "{query}" yet.</p>
                ) : (
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex items-center justify-between rounded-sm px-2 py-1.5 text-left transition-colors duration-micro hover:bg-surface-raised"
                    >
                      <span className="font-body text-body text-ink-primary">
                        {c.flagEmoji} {c.name}
                      </span>
                      <span className="font-ui text-micro text-ink-tertiary">{c.continent}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Topic-first browsing — the flip side of the country-first globe flow above. Pick "Economy" once and see it for every curated country at once, instead of tapping through 58 country pages. */}
      <section className="mt-6">
        <h2 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">📚 Or browse by topic, across every country</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOPIC_CATALOG.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => navigate(`/exam-prep/world-explorer/topic/${topic.id}`)}
              className="rounded-md border border-border bg-surface px-3 py-3 text-left font-ui text-caption font-medium text-ink-primary transition-colors duration-micro hover:bg-surface-raised"
            >
              {topic.label}
            </button>
          ))}
        </div>
      </section>

      {/* Entry point into the "Oceans & Maritime World" educational layer — an
          extension of World Explorer (oceans, seas, chokepoints, routes,
          marine ecology), not a separate app. See core/world-explorer/maritime/. */}
      <section className="mt-4">
        <button
          type="button"
          onClick={() => navigate('/exam-prep/world-explorer/maritime')}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-micro hover:bg-surface-raised"
        >
          <span className="font-ui text-caption font-medium text-ink-primary">🌊 Explore Oceans & Maritime World</span>
          <CaretRight size={16} className="text-ink-tertiary" aria-hidden />
        </button>
      </section>

      <div className="mt-6">
        {selected ? (
          <div className="flex flex-col gap-4">
            {/* Selected-country header — identity strip, not a navigation card. Learning content now lives right below instead of behind a tap-through. */}
            <Card>
              <CardBody className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{selected.continent}</p>
                  <p className="font-display text-h3 font-medium text-ink-primary">
                    {selected.flagEmoji} {selected.name}
                  </p>
                  {selectedProfile?.genZNote && (
                    <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{selectedProfile.genZNote}</p>
                  )}
                </div>
                <Button
                  variant="tertiary"
                  size="small"
                  icon={<ArrowSquareOut size={16} />}
                  onClick={() => navigate(`/exam-prep/world-explorer/${selected.id}`)}
                >
                  Full page
                </Button>
              </CardBody>
            </Card>

            <section className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-5 sm:grid-cols-4">
              <p className="col-span-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary sm:col-span-4">
                🌍 At a glance
              </p>
              <AtAGlanceItem label="Capital" value={selected.capital} />
              <AtAGlanceItem label="Continent" value={selected.continent} />
              <AtAGlanceItem label="Currency" value={selected.currency} />
              <AtAGlanceItem label="Language(s)" value={selected.languages.join(', ')} />
            </section>

            {selectedProfile ? (
              <>
                <CountryLessonView profile={selectedProfile} />
                {selectedProfile.maritime && <MaritimeCrossLinks maritime={selectedProfile.maritime} />}
                <CountryQuickRevisionView title={selectedProfile.name} quickRevision={selectedProfile.quickRevision} />
                <CountryExamFocusView title={selectedProfile.name} examFocus={selectedProfile.examFocus} />
                <CountryMemoryHookView genZNote={selectedProfile.genZNote} />
              </>
            ) : (
              <EmptyState
                title="Deeper profile coming soon"
                description={`${selected.name} is on the globe with its core facts above, but its full Geography / Culture / Government / India-relations profile hasn't been curated yet.`}
              />
            )}
          </div>
        ) : (
          <p className="px-1 text-center font-body text-caption text-ink-tertiary">
            Tap a country on the globe to explore it here.
          </p>
        )}
      </div>

      <p className="mt-6 text-center font-ui text-micro text-ink-tertiary">
        {GLOBE_COUNTRIES.length} countries on the globe · {deepProfileCount} with a full curated profile so far
      </p>
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
