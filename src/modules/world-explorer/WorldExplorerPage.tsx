import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CaretRight } from '@phosphor-icons/react'
import { Button, Card, CardBody, SearchField } from '@/shared/components'
import { GLOBE_COUNTRIES, searchGlobeCountries } from '@/core/world-explorer/countries'
import { countCountryProfiles } from '@/core/world-explorer/registry'
import { DEFAULT_GLOBE_STYLE, type GlobeStyleId } from '@/core/world-explorer/globeStyle'
import { getSavedGlobeStyle, saveGlobeStyle } from '@/core/world-explorer/globeStylePreference'
import { Globe } from './components/Globe'
import { GlobeStyleSelector } from './components/GlobeStyleSelector'
import { EducationalUseNotice } from './components/CountryLessonView'

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

      <div className="mt-4">
        {selected ? (
          <Card interactive onClick={() => navigate(`/exam-prep/world-explorer/${selected.id}`)}>
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{selected.continent}</p>
                <p className="font-display text-h3 font-medium text-ink-primary">
                  {selected.flagEmoji} {selected.name}
                </p>
                <p className="font-body text-caption text-ink-secondary">
                  Capital: {selected.capital} · {selected.currency}
                </p>
              </div>
              <Button variant="secondary" size="small">
                View profile
              </Button>
            </CardBody>
          </Card>
        ) : (
          <p className="px-1 text-center font-body text-caption text-ink-tertiary">
            Tap a country on the globe to preview it here.
          </p>
        )}
      </div>

      <p className="mt-6 text-center font-ui text-micro text-ink-tertiary">
        {GLOBE_COUNTRIES.length} countries on the globe · {deepProfileCount} with a full curated profile so far
      </p>
    </div>
  )
}
