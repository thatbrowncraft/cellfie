import { cn } from '../utils/cn'

interface SkeletonProps {
  className?: string
}

/**
 * Loading Skeleton — Design System §12.
 * Calm skeleton placeholders in surface-raised tone, preferred over
 * spinners. Pulses gently; collapses to a static tone under
 * prefers-reduced-motion via the .animate-pulse override in index.css
 * (Tailwind's animate-pulse already respects reduced-motion globally
 * through the app-wide media query in index.css).
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-sm bg-surface-raised', className)} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-5', className)} aria-hidden="true">
      <Skeleton className="mb-4 h-32 w-full rounded-md" />
      <Skeleton className="mb-2 h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}
