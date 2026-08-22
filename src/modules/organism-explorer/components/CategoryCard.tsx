import { Bug, Flask, GitBranch, Stack } from '@phosphor-icons/react'
import { Card, CardBody } from '@/shared/components'
import type { OrganismCategory } from '@/core/organisms'

interface CategoryCardProps {
  category: OrganismCategory
  label: string
  description: string
  memoryLine?: string
  count: number
  onClick: () => void
}

// §build-fix — the four icons below are only ever picked from names
// already confirmed to actually exist in this repo's installed
// @phosphor-icons/react version (each is imported and building
// successfully elsewhere: Flask in DashboardPage.tsx, Bug in
// DashboardPage.tsx/OrganismExplorerPage.tsx, GitBranch in
// DashboardPage.tsx/CategoryFilters.tsx, Stack in DashboardPage.tsx).
// A prior version of this file guessed at 'Bacteria'/'TestTube'/'Virus'
// based on a grep that turned out to match unrelated identifiers (e.g.
// `BacteriaFilterState`) rather than a real icon import, which broke
// the GitHub Pages build — so this list is deliberately conservative
// rather than reaching for a more thematically perfect icon name.
const CATEGORY_ICONS: Partial<Record<OrganismCategory, typeof Bug>> = {
  bacteria: Flask,
  fungi: Stack,
  protozoa: Bug,
  virus: GitBranch
}

/**
 * One of the four (or six, once Algae/Other have content) major-group
 * cards on the Organism Explorer landing page — the replacement for
 * immediately rendering all 79 organism cards (§1/§20). Tapping a card
 * is what drives into that category's own filters/groups/grid; this
 * component only owns the card itself.
 */
export function CategoryCard({ category, label, description, memoryLine, count, onClick }: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[category] ?? Bug
  return (
    <Card interactive onClick={onClick} className="flex h-full flex-col gap-3">
      <CardBody className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-olive">
            <Icon size={20} weight="duotone" aria-hidden />
          </span>
          <span className="rounded-full bg-surface-raised px-2.5 py-0.5 font-ui text-micro font-medium text-ink-secondary">
            {count} organism{count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-h3 font-medium text-ink-primary">{label}</h3>
          <p className="font-body text-caption text-ink-secondary">{description}</p>
          {memoryLine && <p className="font-ui text-micro italic text-ink-tertiary">{memoryLine}</p>}
        </div>
      </CardBody>
    </Card>
  )
}
