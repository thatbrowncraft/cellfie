import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type CollectionAccent = 'olive' | 'sage' | 'terracotta'

interface CollectionCardProps {
  title: string
  itemCount: number
  icon?: ReactNode
  accent?: CollectionAccent
  onClick?: () => void
  className?: string
}

const accentClasses: Record<CollectionAccent, string> = {
  olive: 'wash-olive text-olive',
  sage: 'wash-sage text-ink-primary',
  terracotta: 'wash-terracotta text-terracotta'
}

/**
 * Collection Card — Design System §10.16.
 * Small cover cards meant to sit in a horizontally-scrollable shelf
 * ("shelf of labeled folders" metaphor). Use within a container with
 * `overflow-x-auto` and `gap-4` (space-4) between cards.
 */
export function CollectionCard({ title, itemCount, icon, accent = 'olive', onClick, className }: CollectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-40 shrink-0 flex-col gap-3 rounded-md border border-border bg-surface p-4 text-left transition-all duration-standard ease-standard hover:shadow-1 hover:-translate-y-0.5',
        className
      )}
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-sm', accentClasses[accent])}>
        {icon}
      </div>
      <div>
        <p className="font-ui text-ui font-medium text-ink-primary line-clamp-2">{title}</p>
        <p className="font-ui text-caption text-ink-tertiary">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>
    </button>
  )
}
