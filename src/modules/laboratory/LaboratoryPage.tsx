import { LaboratoryLayout } from '../../shared/layouts'
import { EmptyState, Accordion } from '../../shared/components'
import { Flask } from '@phosphor-icons/react'

/**
 * Laboratory — unified section: SOPs, protocols, media prep, biosafety,
 * equipment, calculators, formula hub, unit converter (SDD §2). Sidebar
 * index previews the Accordion pattern this content will use; no protocol
 * data exists yet.
 */
export function LaboratoryPage() {
  const sections = ['Protocols', 'Media Preparation', 'Biosafety', 'Equipment & Glassware', 'Formula Hub', 'Calculators', 'Unit Converter']

  return (
    <LaboratoryLayout
      title="Sections"
      sidebar={sections.map((s) => (
        <span key={s} className="rounded-sm px-3 py-2 font-ui text-ui text-ink-secondary hover:bg-surface-raised hover:text-ink-primary">
          {s}
        </span>
      ))}
    >
      <div className="rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<Flask size={32} />}
          title="Laboratory is empty"
          description="Protocols, safety notes, and reference tools will populate this space, organized the same way across every subject."
        />
        <div className="mt-8 border-t border-border pt-2">
          <Accordion
            items={[
              { id: 'a', title: 'Example: Gram Staining Protocol', content: 'Step-by-step protocols will render here once added.' },
              { id: 'b', title: 'Example: Autoclave Safety Notes', content: 'Safety callouts will render here once added.' }
            ]}
          />
        </div>
      </div>
    </LaboratoryLayout>
  )
}
