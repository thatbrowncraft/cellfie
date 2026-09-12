import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/shared/components'
import {
  getAllMaritimeProfiles,
  getAllPorts,
  getIndiaMaritimeProfile
} from '@/core/world-explorer/maritime/registry'
import type { MaritimeCategory, MaritimeProfile } from '@/core/world-explorer/maritime/types'

const CATEGORY_META: Record<MaritimeCategory, { label: string; emoji: string; blurb: string }> = {
  ocean: { label: 'Major Oceans', emoji: '🌊', blurb: 'The five oceans and what connects to each of them.' },
  sea: { label: 'Important Seas', emoji: '🌐', blurb: 'The seas that link countries and carry regional trade.' },
  chokepoint: { label: 'Straits & Chokepoints', emoji: '🚨', blurb: 'The narrow points where a huge share of world trade has to pass through.' },
  route: { label: 'Major Maritime Routes', emoji: '🛳️', blurb: "How goods actually move from one region to another by sea." },
  ecosystem: { label: 'Marine Ecology', emoji: '🐠', blurb: 'Coral reefs, mangroves, seagrass and the open ocean itself.' },
  'india-maritime': { label: 'India & the Oceans', emoji: '🇮🇳', blurb: '' }
}

const CATEGORY_ORDER: MaritimeCategory[] = ['ocean', 'sea', 'chokepoint', 'route', 'ecosystem']

/**
 * "Oceans & Maritime World" hub — an extension of World Explorer, not a
 * separate app (per the brief). Reachable from the World Explorer
 * landing page's own entry point. Every card here routes into
 * `MaritimeEntityDetailPage`, which reuses the exact same lesson
 * rendering as a country page (see `core/world-explorer/maritime/types.ts`
 * for why that reuse is safe).
 */
export function MaritimeWorldPage() {
  const navigate = useNavigate()
  const indiaMaritime = useMemo(() => getIndiaMaritimeProfile(), [])
  const ports = useMemo(() => getAllPorts(), [])
  const categoryLists = useMemo(() => {
    const map = new Map<MaritimeCategory, MaritimeProfile[]>()
    for (const category of CATEGORY_ORDER) {
      map.set(category, getAllMaritimeProfiles(category))
    }
    return map
  }, [])

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
        <span className="font-medium text-ink-primary">Oceans & Maritime World</span>
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
        <h1 className="font-display text-display font-semibold text-ink-primary">🌊 Oceans & Maritime World</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">
          Countries aren't isolated — oceans, seas, ports and shipping routes connect them. Here's how.
        </p>
      </header>

      {indiaMaritime && (
        <section className="mb-8">
          <button
            type="button"
            onClick={() => navigate('/exam-prep/world-explorer/maritime/india-maritime/india-maritime')}
            className="flex w-full flex-col gap-1 rounded-md border border-terracotta/40 bg-terracotta/5 p-5 text-left transition-colors duration-micro ease-standard hover:bg-terracotta/10"
          >
            <span className="font-ui text-micro font-medium uppercase tracking-wide text-terracotta">Spotlight</span>
            <span className="font-display text-title font-semibold text-ink-primary">🇮🇳 {indiaMaritime.name}</span>
            <span className="font-body text-body text-ink-secondary">{indiaMaritime.genZNote}</span>
          </button>
        </section>
      )}

      <div className="flex flex-col gap-8">
        {CATEGORY_ORDER.map((category) => {
          const list = categoryLists.get(category) ?? []
          if (list.length === 0) return null
          const meta = CATEGORY_META[category]
          return (
            <section key={category}>
              <h2 className="font-display text-title font-semibold text-ink-primary">
                {meta.emoji} {meta.label}
              </h2>
              <p className="mt-1 font-body text-body text-ink-secondary">{meta.blurb}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => navigate(`/exam-prep/world-explorer/maritime/${category}/${entry.id}`)}
                    className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4 text-left transition-colors duration-micro ease-standard hover:border-terracotta/40 hover:bg-terracotta/5"
                  >
                    <span className="font-ui text-ui font-semibold text-ink-primary">{entry.name}</span>
                    <span className="line-clamp-2 font-body text-caption text-ink-tertiary">{entry.quickRevision.oneLineDefinition}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {ports.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-title font-semibold text-ink-primary">⚓ Major Ports</h2>
          <p className="mt-1 font-body text-body text-ink-secondary">
            A curated set of geographically and economically significant ports — not an exhaustive list.
          </p>
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] border-collapse font-body text-caption">
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left">
                  <th className="p-3 font-ui font-medium uppercase tracking-wide text-ink-tertiary">Port</th>
                  <th className="p-3 font-ui font-medium uppercase tracking-wide text-ink-tertiary">Country</th>
                  <th className="p-3 font-ui font-medium uppercase tracking-wide text-ink-tertiary">Waters</th>
                  <th className="p-3 font-ui font-medium uppercase tracking-wide text-ink-tertiary">Main Function</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((port) => (
                  <tr key={port.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium text-ink-primary">{port.name}</td>
                    <td className="p-3 text-ink-secondary">{port.country}</td>
                    <td className="p-3 text-ink-secondary">{port.nearbyWater}</td>
                    <td className="p-3 text-ink-secondary">{port.mainFunction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
