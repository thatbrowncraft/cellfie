import { useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Card, CardBody, IllustrationFrame } from '@/shared/components'
import { gramReactionLabels, organismCategoryLabels, removeSavedOrganism, type OrganismProfile } from '@/core/organisms'
import { useOrganismImages } from '../hooks/useOrganismImages'

interface OrganismCardProps {
  organism: OrganismProfile
}

/**
 * Organism Card — Sprint 4 §3, Master Revision §21. The illustrated-
 * profile-first entry point into an organism's detail page. Reuses the
 * existing Card and IllustrationFrame primitives rather than inventing
 * a new visual treatment, so an organism entry looks and feels like the
 * rest of Cellfie's specimen-card language.
 *
 * Image priority (Image Import Bug Fix §9): a user's own custom image
 * (if uploaded from the detail page) always wins; with no custom image,
 * this falls to a trusted external Knowledge Layer image if one exists,
 * and otherwise to IllustrationFrame's own clean "Illustration
 * unavailable" placeholder. The old generated organism SVGs are no
 * longer shown as a default illustration here — never a broken image,
 * a filename, or stale generated artwork, at any point in that chain.
 *
 * A small delete affordance appears on saved (non-curated) organisms
 * only — removing one from the grid was previously only possible from
 * inside its detail page, which people reasonably didn't expect to have
 * to open just to remove something. `stopPropagation` keeps the tap from
 * also triggering the card's own navigate-to-detail click handler.
 */
export function OrganismCard({ organism }: OrganismCardProps) {
  const navigate = useNavigate()
  const { primaryImageUrl } = useOrganismImages(organism.id)
  const badges = [
    organismCategoryLabels[organism.category],
    organism.morphology.gramReaction && organism.morphology.gramReaction !== 'not-applicable'
      ? gramReactionLabels[organism.morphology.gramReaction]
      : undefined,
    organism.morphology.acidFast ? 'Acid-fast' : undefined,
    organism.morphology.shape
  ].filter((b): b is string => Boolean(b))

  const isRemovable = organism.sourceType && organism.sourceType !== 'curated-local'

  async function handleRemove(event: MouseEvent) {
    event.stopPropagation()
    if (!window.confirm(`Remove "${organism.scientificName}" from My Organisms? This only removes your saved copy — it won't affect Cellfie's curated library.`)) {
      return
    }
    await removeSavedOrganism(organism.id)
  }

  return (
    <Card interactive onClick={() => navigate(`/organisms/${organism.id}`)}>
      <CardBody className="flex flex-col gap-4">
        <div className="relative">
          <IllustrationFrame
            src={primaryImageUrl ?? organism.externalImage?.imageUrl}
            alt={`Illustration of ${organism.scientificName}`}
            caption={organism.commonName ?? organism.scientificName}
            className="w-full"
          />
          {isRemovable && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Remove ${organism.scientificName} from My Organisms`}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface-base/90 text-ink-tertiary shadow-sm hover:bg-surface-raised hover:text-error"
            >
              <Trash size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-display text-h3 font-medium italic text-ink-primary">{organism.scientificName}</h3>
          {organism.commonName && <p className="font-ui text-caption text-ink-tertiary">{organism.commonName}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-surface-raised px-2.5 py-0.5 font-ui text-micro font-medium text-ink-secondary"
            >
              {badge}
            </span>
          ))}
        </div>

        {organism.quickTags.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {organism.quickTags.slice(0, 2).map((tag) => (
              <li key={tag} className="font-body text-caption text-ink-secondary">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
