import { Star, Sparkle } from '@phosphor-icons/react'
import { Card, CardBody } from '../../../shared/components'
import { cn } from '../../../shared/utils/cn'
import { COMPARISON_DIFFICULTY_LABELS, COMPARISON_DOMAIN_LABELS, COMPARISON_FREQUENCY_LABELS } from '../../../core/comparison/types'
import type { ComparisonDifficulty, ComparisonDomain, ComparisonFrequency } from '../../../core/comparison/types'

interface ComparisonCardProps {
  itemAName: string
  itemBName: string
  domain: ComparisonDomain
  difficulty?: ComparisonDifficulty
  frequency?: ComparisonFrequency
  favorite?: boolean
  sourceType?: 'curated' | 'custom'
  onClick: () => void
  className?: string
}

/**
 * One comparison entry, used across the discovery list, Saved
 * Comparisons, Favorites, My Comparisons, and Dashboard's "Recently
 * Visited Comparisons" preview (brief §14/§15/§22). Kept intentionally
 * plain — a title, a couple of quiet metadata chips, and a favorite
 * star — so the discovery experience doesn't become an overloaded
 * filter/card dashboard (brief §22).
 */
export function ComparisonCard({ itemAName, itemBName, domain, difficulty, frequency, favorite, sourceType, onClick, className }: ComparisonCardProps) {
  return (
    <Card interactive onClick={onClick} className={cn('flex flex-col gap-2', className)}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-h3 font-medium text-ink-primary">
            {itemAName} <span className="text-ink-tertiary">vs</span> {itemBName}
          </h3>
          {favorite && <Star size={16} weight="fill" className="mt-1 shrink-0 text-terracotta" aria-hidden />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-micro text-ink-tertiary">
          <span>{COMPARISON_DOMAIN_LABELS[domain]}</span>
          {difficulty && (
            <>
              <span aria-hidden>·</span>
              <span>{COMPARISON_DIFFICULTY_LABELS[difficulty]}</span>
            </>
          )}
          {frequency && (
            <>
              <span aria-hidden>·</span>
              <span>{COMPARISON_FREQUENCY_LABELS[frequency]}</span>
            </>
          )}
          {sourceType === 'custom' && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 text-olive">
                <Sparkle size={11} aria-hidden /> Yours
              </span>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
