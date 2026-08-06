import { Scales } from '@phosphor-icons/react'
import { ComparisonLayout } from '../../shared/layouts'
import { EmptyState, Button, ComparisonTable } from '../../shared/components'

/**
 * Comparison Studio — build/browse visual side-by-side comparisons
 * (SDD §2). Demonstrates the ComparisonTable primitive with a structural
 * example (labeled as such) rather than real content.
 */
export function ComparisonStudioPage() {
  return (
    <ComparisonLayout
      title="Comparison Studio"
      left={
        <EmptyState
          icon={<Scales size={28} />}
          title="No comparisons yet"
          description="Build your first side-by-side comparison — like ELISA vs. PCR — from Comparison Studio or inline from a topic."
          action={<Button size="small">New comparison</Button>}
        />
      }
      right={
        <div>
          <p className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Structure preview
          </p>
          <ComparisonTable
            itemA="Item A"
            itemB="Item B"
            rows={[
              { aspect: 'Aspect', valueA: '—', valueB: '—' },
              { aspect: 'Aspect', valueA: '—', valueB: '—', differs: true }
            ]}
          />
        </div>
      }
    />
  )
}
