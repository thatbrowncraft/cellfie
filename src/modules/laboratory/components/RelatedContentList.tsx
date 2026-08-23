import { useNavigate } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { Card, CardBody, Micro } from '@/shared/components'
import { CATEGORY_LABELS } from '@/core/laboratory/registry'
import type { LaboratoryContent } from '@/core/laboratory/types'

interface RelatedContentListProps {
  title: string
  items: LaboratoryContent[]
}

/**
 * Renders a resolved set of cross-linked Laboratory items (brief §14) as
 * a compact clickable list, grouped under a heading like "Related
 * Protocols" or "Related Media". Used repeatedly across every detail
 * page rather than each category inventing its own related-content UI.
 */
export function RelatedContentList({ title, items }: RelatedContentListProps) {
  const navigate = useNavigate()
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <Micro as="h3">{title}</Micro>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Card
            key={item.id}
            interactive
            className="p-3"
            onClick={() => navigate(`/laboratory/${item.category}/${item.id}`)}
          >
            <CardBody className="flex items-center justify-between gap-2 p-0">
              <div className="min-w-0">
                <p className="truncate font-ui text-ui font-medium text-ink-primary">{item.title}</p>
                <p className="font-ui text-micro uppercase tracking-wide text-ink-tertiary">{CATEGORY_LABELS[item.category]}</p>
              </div>
              <CaretRight size={16} className="shrink-0 text-ink-tertiary" aria-hidden />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
