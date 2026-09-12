import { useNavigate } from 'react-router-dom'
import { getMaritimeProfile } from '@/core/world-explorer/maritime/registry'
import type { MaritimeCategory } from '@/core/world-explorer/maritime/types'
import type { CountryProfile } from '@/core/world-explorer/types'

const GROUP_META: { key: keyof NonNullable<CountryProfile['maritime']>; category: MaritimeCategory; label: string }[] = [
  { key: 'oceans', category: 'ocean', label: 'Ocean' },
  { key: 'seas', category: 'sea', label: 'Seas' },
  { key: 'chokepoints', category: 'chokepoint', label: 'Chokepoints' },
  { key: 'routes', category: 'route', label: 'Trade Routes' }
]

/**
 * Renders a country's optional `maritime` cross-link field (see
 * `core/world-explorer/types.ts`) as a small set of tappable chips
 * leading into Maritime World — the answer to brief §20's "which
 * ocean/sea is this country connected to?" without duplicating any
 * ocean/sea content inside the country's own JSON. Renders nothing if
 * the country has no `maritime` field, or if none of its referenced
 * ids actually resolve (defensive — keeps a typo in one country file
 * from breaking that country's whole page).
 */
export function MaritimeCrossLinks({ maritime }: { maritime: NonNullable<CountryProfile['maritime']> }) {
  const navigate = useNavigate()

  const groups = GROUP_META.map((meta) => {
    const ids = maritime[meta.key] ?? []
    const resolved = ids
      .map((id) => getMaritimeProfile(meta.category, id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    return { ...meta, resolved }
  }).filter((g) => g.resolved.length > 0)

  if (groups.length === 0) return null

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">🌊 Maritime & Oceans</p>
      <div className="mt-3 flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="font-ui text-micro font-medium text-ink-tertiary">{group.label}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {group.resolved.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => navigate(`/exam-prep/world-explorer/maritime/${group.category}/${entry.id}`)}
                  className="rounded-full border border-border bg-surface-raised px-3 py-1 font-ui text-micro font-medium text-ink-primary transition-colors duration-micro hover:border-terracotta/40 hover:bg-terracotta/5"
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/exam-prep/world-explorer/maritime')}
        className="mt-3 font-ui text-micro font-medium text-terracotta hover:underline"
      >
        Explore Maritime World →
      </button>
    </div>
  )
}
