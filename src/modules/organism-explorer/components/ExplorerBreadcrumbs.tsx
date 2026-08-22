import { CaretRight } from '@phosphor-icons/react'

export interface BreadcrumbStep {
  label: string
  onClick?: () => void
}

interface ExplorerBreadcrumbsProps {
  steps: BreadcrumbStep[]
}

/**
 * Organism Explorer redesign §13 — a simple text trail showing where
 * the user is (Organism Explorer → Bacteria → Gram-positive → …).
 * Every step but the last is clickable and jumps straight back to that
 * level; the last step is the current view and isn't a link. This is
 * purely a visual aid — browser Back/Forward keeps working on its own
 * because every level already lives in the URL's query params.
 */
export function ExplorerBreadcrumbs({ steps }: ExplorerBreadcrumbsProps) {
  if (steps.length <= 1) return null

  return (
    <nav aria-label="Organism Explorer breadcrumbs" className="flex flex-wrap items-center gap-1 font-ui text-caption text-ink-tertiary">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <span key={`${step.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <CaretRight size={12} aria-hidden />}
            {isLast || !step.onClick ? (
              <span className={isLast ? 'font-medium text-ink-primary' : undefined}>{step.label}</span>
            ) : (
              <button type="button" onClick={step.onClick} className="hover:text-ink-secondary hover:underline">
                {step.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
