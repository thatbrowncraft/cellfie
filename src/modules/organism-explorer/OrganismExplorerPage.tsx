import { Bug } from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { EmptyState, IllustrationFrame } from '../../shared/components'

/**
 * Organism Explorer — visual-profile-first entries (SDD §2, restructured
 * from "Organism Encyclopedia"). Showcases the signature IllustrationFrame
 * treatment against an empty profile grid; no organism data model yet.
 */
export function OrganismExplorerPage() {
  return (
    <DashboardLayout title="Organism Explorer" subtitle="Visual profiles — classification, morphology, and lab identification at a glance.">
      <div className="col-span-full flex flex-col items-center gap-8 rounded-md border border-border bg-surface p-6">
        <IllustrationFrame alt="Placeholder organism illustration" caption="Fig. 1 — awaiting your first entry" />
        <EmptyState
          icon={<Bug size={32} />}
          title="No organisms added yet"
          description="Organism profiles — classification, morphology, habitat, and lab identification — will appear as illustrated cards here."
        />
      </div>
    </DashboardLayout>
  )
}
