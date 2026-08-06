import { GitBranch } from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { EmptyState, Tabs, type TabItem } from '../../shared/components'

/**
 * Concepts — placeholder home for the SDD's Learn (structured topic pages)
 * and Concept Explorer (relationship graph) modules, condensed into one
 * route for this foundation build (see config/navigation.ts for the full
 * rationale). The tab structure below previews Learn's explanation-depth
 * pattern (§7 component hierarchy) without any topic content or data model.
 */
export function ConceptsPage() {
  const tabs: TabItem[] = [
    { id: 'simple', label: 'Simple', content: <PlaceholderPane label="Simple Explanation" /> },
    { id: 'beginner', label: "I'm New", content: <PlaceholderPane label="Explain Like I'm New" /> },
    { id: 'scientific', label: 'Scientific', content: <PlaceholderPane label="Scientific Explanation" /> },
    { id: 'graph', label: 'Explorer', content: <PlaceholderPane label="Concept relationship graph" /> }
  ]

  return (
    <DashboardLayout title="Concepts" subtitle="A hard topic becomes a diagram before it becomes a paragraph.">
      <div className="col-span-full rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<GitBranch size={32} />}
          title="No topics yet"
          description="Once you write your first topic, its explanations, flowchart, mind map, and related concepts will all live here — and in the graph."
        />
        <div className="mt-8 border-t border-border pt-6">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function PlaceholderPane({ label }: { label: string }) {
  return <p className="font-body text-body text-ink-tertiary">{label} will appear here once a topic exists.</p>
}
