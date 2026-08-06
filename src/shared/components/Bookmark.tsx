import { useState } from 'react'
import { Bookmark as BookmarkIcon } from '@phosphor-icons/react'
import { cn } from '../utils/cn'

interface BookmarkToggleProps {
  initialBookmarked?: boolean
  onToggle?: (bookmarked: boolean) => void
  label?: string
  className?: string
}

/**
 * Bookmark — Design System §10.15.
 * Outlined olive ribbon by default, fills terracotta when active. Toggle
 * fills in over motion.duration.micro, no confirmation dialog needed.
 */
export function BookmarkToggle({ initialBookmarked = false, onToggle, label = 'Bookmark', className }: BookmarkToggleProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)

  function handleClick() {
    const next = !bookmarked
    setBookmarked(next)
    onToggle?.(next)
  }

  return (
    <button
      type="button"
      aria-pressed={bookmarked}
      aria-label={bookmarked ? `Remove bookmark: ${label}` : `Bookmark: ${label}`}
      onClick={handleClick}
      className={cn('transition-transform duration-micro ease-standard active:scale-90', className)}
    >
      <BookmarkIcon
        size={20}
        weight={bookmarked ? 'fill' : 'regular'}
        className={cn('transition-colors duration-micro', bookmarked ? 'text-terracotta' : 'text-olive')}
      />
    </button>
  )
}
