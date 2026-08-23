import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkSimple, CaretRight, ShieldWarning, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '../../shared/layouts'
import { Button, CalloutBox, Card, CardBody, EmptyState } from '../../shared/components'
import { CATEGORY_LABELS, getLabContentById, resolveRelated } from '../../core/laboratory/registry'
import { getItemTagline } from '../../core/laboratory/microcopy'
import { recordLabItemViewed } from '../../core/laboratory/recentlyViewed'
import { isCellfieReferenceSaved, removeSavedLabItem, saveCellfieReference } from '../../core/laboratory/savedItems'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { db } from '../../core/db'
import type {
  BiochemicalTest,
  BiosafetyTopic,
  Equipment,
  Formula,
  LabConcept,
  LaboratoryCategory,
  Media,
  Protocol
} from '../../core/laboratory/types'
import { RelatedContentList } from './components/RelatedContentList'
import { LabSourcesPanel } from './components/LabSourcesPanel'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-display text-h3 font-medium text-ink-primary">{title}</h2>
      <div className="font-body text-body text-ink-secondary">{children}</div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-ink-tertiary">None recorded.</p>
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Laboratory Detail — Tier 1 Foundation (brief §28 Phase E). One
 * reusable page renders every content category rather than seven
 * near-duplicate components; each category's specific shape (Protocol,
 * Media, BiochemicalTest, etc.) is handled by its own render function
 * below, all sharing the same header/breadcrumb/related-content chrome.
 */
export function LaboratoryDetailPage() {
  const { category, id } = useParams<{ category: LaboratoryCategory; id: string }>()
  const navigate = useNavigate()

  const item = useMemo(() => (id ? getLabContentById(id) : undefined), [id])

  // Dashboard "Lab" preview support (brief: recent activity, bounded,
  // separate from Saved Lab Items) — fire-and-forget, never blocks
  // render. Only curated content reaching this branch is ever recorded.
  useEffect(() => {
    if (item && category && item.category === category) {
      void recordLabItemViewed(item.id, category)
    }
  }, [item, category])

  const isSaved = useLiveQuery<boolean>(
    () => (item ? isCellfieReferenceSaved(item.id) : Promise.resolve(false)),
    [item?.id],
    false
  )

  if (!category || !id || !item || item.category !== category) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Content not found"
          description="This Laboratory entry doesn't exist, or its content file couldn't be loaded."
          action={
            <Button variant="secondary" onClick={() => navigate('/laboratory')}>
              Back to Laboratory
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/laboratory')} className="hover:text-ink-secondary hover:underline">
          Laboratory
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate(`/laboratory?section=${category}`)}
          className="hover:text-ink-secondary hover:underline"
        >
          {CATEGORY_LABELS[category]}
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{item.title}</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} className="mb-4">
        Back
      </Button>

      <header className="mb-8">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          {CATEGORY_LABELS[category]}
          {item.subcategory ? ` · ${item.subcategory}` : ''}
        </p>
        <h1 className="mt-1 font-display text-display font-semibold text-ink-primary">{item.title}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{getItemTagline(item.id, category)}</p>
        {item.scientificNotes && <p className="mt-3 font-body text-caption text-ink-tertiary">{item.scientificNotes}</p>}
      </header>

      <div className="flex flex-col gap-8">
        {category === 'protocol' && <ProtocolBody item={item as Protocol} />}
        {category === 'concept' && <ConceptBody item={item as LabConcept} />}
        {category === 'media' && <MediaBody item={item as Media} />}
        {category === 'biochemical-test' && <BiochemicalTestBody item={item as BiochemicalTest} />}
        {category === 'biosafety' && <BiosafetyBody item={item as BiosafetyTopic} />}
        {category === 'equipment' && <EquipmentBody item={item as Equipment} />}
        {category === 'formula' && <FormulaBody item={item as Formula} />}

        <RelatedSections item={item} />

        <SourcesSection item={item} category={category} isSaved={isSaved} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category-specific bodies
// ---------------------------------------------------------------------------

function ProtocolBody({ item }: { item: Protocol }) {
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

function ConceptBody({ item }: { item: LabConcept }) {
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

function MediaBody({ item }: { item: Media }) {
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

function ReferencedValueNote({ label, rv }: { label: string; rv: { value: string; dependsOn: string; unverified?: boolean } }) {
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

function BiochemicalTestBody({ item }: { item: BiochemicalTest }) {
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

function BiosafetyBody({ item }: { item: BiosafetyTopic }) {
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

function EquipmentBody({ item }: { item: Equipment }) {
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

function FormulaBody({ item }: { item: Formula }) {
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

// ---------------------------------------------------------------------------
// Shared related-content + references chrome
// ---------------------------------------------------------------------------

function RelatedSections({ item }: { item: Protocol | LabConcept | Media | BiochemicalTest | BiosafetyTopic | Equipment | Formula }) {
  const groups: { title: string; ids?: string[] }[] = [
    { title: 'Related Protocols', ids: item.relatedProtocols },
    { title: 'Related Concepts', ids: item.relatedConcepts },
    { title: 'Related Media', ids: item.relatedMedia },
    { title: 'Related Biochemical Tests', ids: item.relatedBiochemicalTests },
    { title: 'Related Equipment', ids: item.relatedEquipment },
    { title: 'Related Formulas', ids: item.relatedFormulas },
    { title: 'Related Safety Information', ids: item.relatedSafety }
  ]

  const nonEmpty = groups
    .map((g) => ({ title: g.title, items: resolveRelated(g.ids) }))
    .filter((g) => g.items.length > 0)

  const calcIds = item.relatedCalculators
  const hasCalcLinks = calcIds && calcIds.length > 0

  if (nonEmpty.length === 0 && !hasCalcLinks) return null

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-h3 font-medium text-ink-primary">Related Content</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {nonEmpty.map((g) => (
          <RelatedContentList key={g.title} title={g.title} items={g.items} />
        ))}
        {hasCalcLinks && <RelatedCalculators ids={calcIds!} />}
      </div>
    </div>
  )
}

function RelatedCalculators({ ids }: { ids: string[] }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-2">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Related Calculators</p>
      <div className="flex flex-col gap-2">
        {ids.map((id) => (
          <Card key={id} interactive className="p-3" onClick={() => navigate(`/laboratory/calculators/${id}`)}>
            <CardBody className="flex items-center justify-between gap-2 p-0">
              <span className="font-ui text-ui font-medium text-ink-primary">{id.replace('calc-', '').replace(/-/g, ' ')}</span>
              <CaretRight size={16} className="shrink-0 text-ink-tertiary" aria-hidden />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Laboratory 2.0 brief §18 — the three information layers, always shown
 * distinctly. "Cellfie Reference" is what used to be the standalone
 * References section (Layer 1, always available, never requires a
 * lookup); "My Library" and "Online Knowledge" (Layers 2-3) live in
 * `LabSourcesPanel` and only populate on explicit user action.
 */
function SourcesSection({
  item,
  category,
  isSaved
}: {
  item: Protocol | LabConcept | Media | BiochemicalTest | BiosafetyTopic | Equipment | Formula
  category: LaboratoryCategory
  isSaved: boolean
}) {
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveCellfieReference({ id: item.id, category, title: item.title })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    const existing = await db.savedLabItems.where('labContentId').equals(item.id).first()
    if (existing) await removeSavedLabItem(existing.id)
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-h3 font-medium text-ink-primary">Sources</h2>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Cellfie Reference</p>
          {isSaved ? (
            <span className="flex items-center gap-1.5 font-ui text-micro font-medium text-olive">
              <BookmarkSimple size={14} weight="fill" aria-hidden />
              Saved to Saved Lab Items
              <button type="button" onClick={handleRemove} className="ml-1 text-ink-tertiary underline hover:text-ink-secondary">
                Remove
              </button>
            </span>
          ) : (
            <Button variant="secondary" size="small" icon={<Bookmark size={14} />} disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : 'Save to Saved Lab Items'}
            </Button>
          )}
        </div>
        <ul className="space-y-1 font-body text-caption text-ink-secondary">
          {item.references.map((r, i) => (
            <li key={i}>
              {r.label}
              {r.publisher ? ` — ${r.publisher}` : ''}
              {r.edition ? ` (${r.edition})` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-ui text-micro text-ink-tertiary">
          Source type: {item.sourceType.replace(/-/g, ' ')} · Version {item.version} · Last verified {item.lastVerified}
        </p>
      </div>

      <LabSourcesPanel title={item.title} contentId={item.id} />
    </div>
  )
}
