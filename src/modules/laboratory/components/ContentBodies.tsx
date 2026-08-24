import type { ReactNode } from 'react'
import { ShieldWarning } from '@phosphor-icons/react'
import { CalloutBox, Card, CardBody } from '@/shared/components'
import type { BiochemicalTest, BiosafetyTopic, Equipment, Formula, LabConcept, Media, Protocol } from '@/core/laboratory/types'

/**
 * Category-specific body renderers, extracted out of LaboratoryDetailPage
 * so the Laboratory Clinical Expansion's ClinicalDetailPage can reuse the
 * exact same rendering for Protocol/Concept/Equipment/Formula (the four
 * categories the clinical registry actually uses — see
 * core/laboratory/clinicalRegistry.ts's header) without duplicating this
 * markup a second time. Media and Biosafety bodies stay here too so the
 * main detail page's import surface doesn't change.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-display text-h3 font-medium text-ink-primary">{title}</h2>
      <div className="font-body text-body text-ink-secondary">{children}</div>
    </div>
  )
}

export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-ink-tertiary">None recorded.</p>
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

export function ProtocolBody({ item }: { item: Protocol }) {
  return (
    <>
      <Section title="Purpose">{item.purpose}</Section>
      <Section title="Principle">{item.principle}</Section>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Section title="Required Materials">
          <BulletList items={item.requiredMaterials} />
        </Section>
        <Section title="Required Reagents">
          <BulletList items={item.requiredReagents} />
        </Section>
      </div>
      <Section title="Procedure">
        <ol className="space-y-3">
          {item.procedure.map((step) => (
            <li key={step.step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive font-ui text-caption font-medium text-canvas">
                {step.step}
              </span>
              <div>
                <p>{step.instruction}</p>
                {step.note && <p className="mt-1 font-ui text-caption text-ink-tertiary">{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Observations">{item.observations}</Section>
      <Section title="Interpretation">{item.interpretation}</Section>
      {item.criticalNotes && item.criticalNotes.length > 0 && (
        <CalloutBox type="tip" title="Critical Notes">
          <BulletList items={item.criticalNotes} />
        </CalloutBox>
      )}
      <Section title="Precautions">
        <BulletList items={item.precautions} />
      </Section>
      <Section title="Limitations">
        <BulletList items={item.limitations} />
      </Section>
      {item.biosafetyNotes && (
        <CalloutBox type="safety" title="Biosafety">
          {item.biosafetyNotes}
        </CalloutBox>
      )}
    </>
  )
}

export function ConceptBody({ item }: { item: LabConcept }) {
  return (
    <>
      <Section title="Summary">{item.summary}</Section>
      <Section title="Explanation">{item.explanation}</Section>
      {item.comparison && item.comparison.length > 0 && (
        <Section title="Comparison">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left font-body text-body">
              <tbody>
                {item.comparison.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="w-1/4 border-r border-border bg-surface-raised p-3 font-ui text-caption font-medium text-ink-primary">{row.aspect}</td>
                    <td className="w-3/8 border-r border-border p-3">{row.left}</td>
                    <td className="w-3/8 p-3">{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {item.commonMisconceptions && item.commonMisconceptions.length > 0 && (
        <CalloutBox type="aside" title="Common Misconceptions">
          <BulletList items={item.commonMisconceptions} />
        </CalloutBox>
      )}
      {item.examples && item.examples.length > 0 && (
        <Section title="Examples">
          <BulletList items={item.examples} />
        </Section>
      )}
    </>
  )
}

export function ReferencedValueNote({ label, rv }: { label: string; rv: { value: string; dependsOn: string; unverified?: boolean } }) {
  if (rv.unverified) {
    return (
      <CalloutBox type="warning" title={`${label} — reference needed`}>
        A confident value could not be sourced yet for this field. It depends on: {rv.dependsOn}.
      </CalloutBox>
    )
  }
  return (
    <Section title={label}>
      <p>{rv.value}</p>
      <p className="mt-1 font-ui text-caption text-ink-tertiary">Depends on: {rv.dependsOn}</p>
    </Section>
  )
}

export function MediaBody({ item }: { item: Media }) {
  return (
    <>
      <Section title="Purpose">{item.purpose}</Section>
      <div className="flex flex-wrap gap-2">
        {item.classifications.map((c) => (
          <span key={c} className="rounded-full border border-border-strong px-3 py-1 font-ui text-micro uppercase tracking-wide text-ink-secondary">
            {c}
          </span>
        ))}
      </div>
      <Section title="Target Organisms">
        <BulletList items={item.targetOrganisms} />
      </Section>
      {item.formulations.map((f, i) => (
        <Section key={i} title={`Formulation: ${f.sourceLabel}`}>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left font-body text-body">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="p-3 font-ui text-caption font-medium text-ink-primary">Ingredient</th>
                  <th className="p-3 font-ui text-caption font-medium text-ink-primary">Amount (per liter)</th>
                </tr>
              </thead>
              <tbody>
                {f.compositionPerLiter.map((c, j) => (
                  <tr key={j} className="border-b border-border last:border-0">
                    <td className="p-3">{c.ingredient}</td>
                    <td className="p-3">{c.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {f.finalPh && <ReferencedValueNote label="Final pH" rv={f.finalPh} />}
        </Section>
      ))}
      <Section title="Preparation">{item.preparationSummary}</Section>
      {item.sterilization && <ReferencedValueNote label="Sterilization" rv={item.sterilization} />}
      <Section title="Storage">{item.storage}</Section>
      {item.shelfLife && <ReferencedValueNote label="Shelf Life" rv={item.shelfLife} />}
      <Section title="Expected Appearance">{item.expectedAppearance}</Section>
      {item.qualityControl && <Section title="Quality Control">{item.qualityControl}</Section>}
      {item.reactions && item.reactions.length > 0 && (
        <Section title="Reactions">
          <ul className="space-y-2">
            {item.reactions.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-ink-primary">{r.organismOrGroup}:</span> {r.reaction}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {item.manufacturerNotes && (
        <CalloutBox type="aside" title="Manufacturer Notes">
          {item.manufacturerNotes}
        </CalloutBox>
      )}
    </>
  )
}

export function BiochemicalTestBody({ item }: { item: BiochemicalTest }) {
  return (
    <>
      <Section title="Purpose">{item.purpose}</Section>
      <Section title="Principle">{item.principle}</Section>
      <Section title="Reagents">
        <BulletList items={item.reagents} />
      </Section>
      <Section title="Procedure">
        <ol className="space-y-3">
          {item.procedure.map((step) => (
            <li key={step.step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive font-ui text-caption font-medium text-canvas">
                {step.step}
              </span>
              <div>
                <p>{step.instruction}</p>
                {step.note && <p className="mt-1 font-ui text-caption text-ink-tertiary">{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Section title="Positive Result">{item.positiveResult}</Section>
        <Section title="Negative Result">{item.negativeResult}</Section>
      </div>
      <Section title="Interpretation">{item.interpretation}</Section>
      {item.controls && item.controls.length > 0 && (
        <Section title="Controls">
          <ul className="space-y-1">
            {item.controls.map((c, i) => (
              <li key={i}>
                <span className="font-medium capitalize text-ink-primary">{c.type} control:</span> {c.organism}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Precautions">
        <BulletList items={item.precautions} />
      </Section>
      <Section title="Limitations">
        <BulletList items={item.limitations} />
      </Section>
      {item.exampleOrganisms && item.exampleOrganisms.length > 0 && (
        <Section title="Example Organisms">
          <ul className="space-y-1">
            {item.exampleOrganisms.map((e, i) => (
              <li key={i}>
                {e.organism} — <span className="capitalize">{e.typicalResult}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

export function BiosafetyBody({ item }: { item: BiosafetyTopic }) {
  return (
    <>
      <Section title="Summary">{item.summary}</Section>
      <Section title="Explanation">{item.explanation}</Section>
      <Section title="Key Practices">
        <BulletList items={item.keyPractices} />
      </Section>
      {item.commonMistakes && item.commonMistakes.length > 0 && (
        <CalloutBox type="warning" title="Common Mistakes">
          <BulletList items={item.commonMistakes} />
        </CalloutBox>
      )}
      {item.scopeCaveat && (
        <CalloutBox type="safety" title="Scope">
          <span className="flex items-start gap-2">
            <ShieldWarning size={16} className="mt-0.5 shrink-0" aria-hidden />
            {item.scopeCaveat}
          </span>
        </CalloutBox>
      )}
    </>
  )
}

export function EquipmentBody({ item }: { item: Equipment }) {
  return (
    <>
      <Section title="Purpose">{item.purpose}</Section>
      {item.operatingPrinciple && <Section title="Operating Principle">{item.operatingPrinciple}</Section>}
      {item.basicOperation && item.basicOperation.length > 0 && (
        <Section title="Basic Operation">
          <BulletList items={item.basicOperation} />
        </Section>
      )}
      {item.importantSettings && item.importantSettings.length > 0 && (
        <Section title="Important Settings">
          <BulletList items={item.importantSettings} />
        </Section>
      )}
      {item.calibration && <Section title="Calibration">{item.calibration}</Section>}
      {item.maintenance && item.maintenance.length > 0 && (
        <Section title="Maintenance">
          <BulletList items={item.maintenance} />
        </Section>
      )}
      {item.commonErrors && item.commonErrors.length > 0 && (
        <Section title="Troubleshooting">
          <div className="flex flex-col gap-3">
            {item.commonErrors.map((e, i) => (
              <Card key={i} className="p-4">
                <CardBody className="flex flex-col gap-1 p-0">
                  <p className="font-ui text-ui font-medium text-ink-primary">{e.problem}</p>
                  <p className="font-body text-caption text-ink-secondary">
                    <span className="font-medium">Cause:</span> {e.cause}
                  </p>
                  <p className="font-body text-caption text-ink-secondary">
                    <span className="font-medium">Fix:</span> {e.fix}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {item.safety && item.safety.length > 0 && (
        <CalloutBox type="safety" title="Safety">
          <BulletList items={item.safety} />
        </CalloutBox>
      )}
    </>
  )
}

export function FormulaBody({ item }: { item: Formula }) {
  return (
    <>
      <div className="rounded-md border border-border bg-surface-raised p-5">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Expression</p>
        <p className="mt-1 font-display text-h2 font-medium text-olive">{item.expression}</p>
      </div>
      <Section title="Explanation">{item.explanation}</Section>
      <Section title="Variables">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left font-body text-body">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="p-3 font-ui text-caption font-medium text-ink-primary">Symbol</th>
                <th className="p-3 font-ui text-caption font-medium text-ink-primary">Meaning</th>
                <th className="p-3 font-ui text-caption font-medium text-ink-primary">Unit</th>
              </tr>
            </thead>
            <tbody>
              {item.variables.map((v, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-ink-primary">{v.symbol}</td>
                  <td className="p-3">{v.meaning}</td>
                  <td className="p-3 text-ink-tertiary">{v.unit ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Worked Example">
        <div className="flex flex-col gap-2">
          <p>{item.workedExample.scenario}</p>
          <p className="font-ui text-caption text-ink-tertiary">{item.workedExample.substitution}</p>
          <p className="font-ui text-ui font-medium text-ink-primary">{item.workedExample.result}</p>
        </div>
      </Section>
      {item.commonMistakes && item.commonMistakes.length > 0 && (
        <CalloutBox type="warning" title="Common Mistakes">
          <BulletList items={item.commonMistakes} />
        </CalloutBox>
      )}
    </>
  )
}
