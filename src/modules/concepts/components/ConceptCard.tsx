import { useNavigate } from 'react-router-dom'
import { Tag, UserCircle } from '@phosphor-icons/react'
import { Card, CardBody } from '@/shared/components'
import type { Concept } from '@/core/db'

interface ConceptCardProps {
  concept: Concept
  sourceCount: number
}

export function ConceptCard({ concept, sourceCount }: ConceptCardProps) {
  const navigate = useNavigate()

  return (
    <Card interactive onClick={() => navigate(`/concepts/${concept.id}`)}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-h3 font-medium text-ink-primary">{concept.name}</h3>
          {concept.manuallyCreated && (
            <span className="shrink-0 text-ink-tertiary" title="Manually created">
              <UserCircle size={16} aria-hidden />
            </span>
          )}
        </div>

        <p className="font-body text-caption text-ink-secondary line-clamp-2">
          {concept.description ?? 'No description saved yet.'}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-ui text-micro text-ink-tertiary">
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </span>
          {concept.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro text-ink-secondary">
              <Tag size={11} aria-hidden />
              {tag}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
