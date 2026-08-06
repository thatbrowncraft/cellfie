import { Compass, BookOpen, Sparkle } from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { EmptyState } from '../../shared/components'

/**
 * Dashboard — reframed per SDD §8 around continuity and curiosity, not
 * "review debt." Real content (Continue where you left off, Recently
 * added, You might enjoy exploring) arrives with Phase 1+ data; this
 * foundation ships the three-section layout with calm empty states.
 */
export function DashboardPage() {
  return (
    <DashboardLayout title="Welcome back" subtitle="Nothing scheduled, nothing overdue — just pick up where curiosity left off.">
      <section className="rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<Compass size={32} />}
          title="Continue exploring"
          description="Once you've opened a topic or organism entry, it'll pick up right here."
        />
      </section>
      <section className="rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<BookOpen size={32} />}
          title="Recently added"
          description="Import your first PDF, note, or paper to see it appear in this space."
        />
      </section>
      <section className="rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<Sparkle size={32} />}
          title="You might enjoy exploring"
          description="Gentle suggestions will surface here as your Concept Explorer graph grows."
        />
      </section>
    </DashboardLayout>
  )
}
