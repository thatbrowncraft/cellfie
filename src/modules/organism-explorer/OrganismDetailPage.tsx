import { useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, GitBranch, Sparkle } from '@phosphor-icons/react'
import { Button, CalloutBox, EmptyState, IllustrationFrame } from '@/shared/components'
import { EmptyStateLayout } from '@/shared/layouts'
import {
  gramReactionLabels,
  getOrganismById,
  getRelatedOrganisms,
  organismCategoryLabels,
  type OrganismProfile
} from '@/core/organisms'
import { recordOrganismViewed } from '@/core/organisms/recentlyViewed'

/** A single label/value row — used across Classification, Habitat, and Lab Identification. Renders nothing when the value is absent, per Sprint 4 §6 ("do not show empty labels"). */
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</dt>
      <dd className="font-body text-body text-ink-primary sm:text-right">{value}</dd>
    </div>
  )
}

/** A compact chip for Morphology — deliberately small so a full set of structural fields never turns into a wall of huge cards (§7). */
function MorphologyChip({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="rounded-sm border border-border bg-surface-raised px-3 py-2">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="font-body text-caption text-ink-primary">{value}</p>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h2 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</h2>
      {children}
    </div>
  )
}

function BulletList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <ul className="list-disc space-y-1.5 pl-5 font-body text-body text-ink-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Organism Detail — Sprint 4 §5-§13. A single scrollable specimen
 * profile rather than a tabbed interface — this keeps the "field guide"
 * feel the spec asks for (§4) and matches how a printed atlas entry
 * reads: identity up top, then classification, morphology, habitat, lab
 * identification, recognition clues, clinical importance, and exam
 * facts in that order. Every section is conditionally rendered — a
 * field a content author hasn't filled in simply doesn't show up.
 */
export function OrganismDetailPage() {
  const { organismId } = useParams<{ organismId: string }>()
  const navigate = useNavigate()
  const organism = organismId ? getOrganismById(organismId) : undefined
  const relatedOrganisms = useMemo(() => (organism ? getRelatedOrganisms(organism) : []), [organism])

  // Dashboard "Saved organisms" support (requested dashboard change #4) —
  // records that this organism was opened, via the existing appSettings
  // table (see core/organisms/recentlyViewed.ts). Purely additive; does
  // not affect anything rendered on this page.
  useEffect(() => {
    if (organism) {
      void recordOrganismViewed(organism.id)
    }
  }, [organism])

  if (!organism) {
    return (
      <EmptyStateLayout>
        <EmptyState
          title="Organism not found"
          description="This organism may have been removed, or the link is out of date."
          action={
            <Button variant="secondary" onClick={() => navigate('/organisms')}>
              Back to Organism Explorer
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  const { classification, morphology, habitat, labIdentification, clinicalImportance, examFacts } = organism

  const headerBadges = [
    organismCategoryLabels[organism.category],
    morphology.gramReaction && morphology.gramReaction !== 'not-applicable' ? gramReactionLabels[morphology.gramReaction] : undefined,
    morphology.acidFast ? 'Acid-fast' : undefined,
    morphology.shape,
    classification.order
  ].filter((b): b is string => Boolean(b))

  const hasClassification = Object.values(classification).some(Boolean)
  const hasHabitat = habitat && Object.values(habitat).some(Boolean)
  const hasMicroscopy = labIdentification?.microscopy && Object.values(labIdentification.microscopy).some(Boolean)
  const hasCulture = labIdentification?.culture && Object.values(labIdentification.culture).some(Boolean)
  const hasBiochemTests = (labIdentification?.biochemicalTests?.length ?? 0) > 0
  const hasLabId = hasMicroscopy || hasCulture || hasBiochemTests
  const hasClinical = Boolean(
    clinicalImportance &&
      (clinicalImportance.diseases?.length ||
        clinicalImportance.virulenceFactors?.length ||
        clinicalImportance.toxins?.length ||
        clinicalImportance.transmission ||
        clinicalImportance.epidemiology ||
        clinicalImportance.labSignificance)
  )
  const hasExamFacts = Object.values(examFacts).some(Boolean)

  return (
    <div className="mx-auto w-full min-w-0 max-w-content overflow-x-hidden px-4 py-8 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate('/organisms')}
        className="mb-4 flex items-center gap-1.5 font-ui text-caption font-medium text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft size={16} />
        Organism Explorer
      </button>

      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <IllustrationFrame
          src={organism.image}
          alt={`Illustration of ${organism.scientificName}`}
          caption={organism.commonName ?? organism.scientificName}
          className="w-full shrink-0 sm:w-56"
        />
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="font-display text-display font-semibold italic text-ink-primary">{organism.scientificName}</h1>
            {organism.commonName && <p className="mt-1 font-ui text-body text-ink-tertiary">{organism.commonName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {headerBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro font-medium text-ink-secondary"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {hasClassification && (
          <SectionCard title="Classification">
            <dl>
              <InfoRow label="Domain" value={classification.domain} />
              <InfoRow label="Kingdom" value={classification.kingdom} />
              <InfoRow label="Phylum" value={classification.phylum} />
              <InfoRow label="Class" value={classification.class} />
              <InfoRow label="Order" value={classification.order} />
              <InfoRow label="Family" value={classification.family} />
              <InfoRow label="Genus" value={classification.genus} />
              <InfoRow label="Species" value={classification.species} />
            </dl>
          </SectionCard>
        )}

        <SectionCard title="Morphology">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MorphologyChip label="Shape" value={morphology.shape} />
            <MorphologyChip label="Arrangement" value={morphology.arrangement} />
            <MorphologyChip
              label="Gram reaction"
              value={morphology.gramReaction ? gramReactionLabels[morphology.gramReaction] : undefined}
            />
            {morphology.acidFast !== undefined && <MorphologyChip label="Acid-fast" value={morphology.acidFast ? 'Yes' : 'No'} />}
            <MorphologyChip label="Size" value={morphology.size} />
            {morphology.sporeForming !== undefined && (
              <MorphologyChip label="Spore" value={morphology.sporeForming ? 'Spore-forming' : 'Non-spore-forming'} />
            )}
            <MorphologyChip label="Capsule" value={morphology.capsule} />
            <MorphologyChip label="Motility" value={morphology.motility} />
            <MorphologyChip label="Oxygen requirement" value={morphology.oxygenRequirement} />
          </div>
          {morphology.notes && <p className="mt-3 font-body text-caption text-ink-secondary">{morphology.notes}</p>}
        </SectionCard>

        {hasHabitat && (
          <SectionCard title="Habitat">
            <dl>
              <InfoRow label="Natural habitat" value={habitat?.naturalHabitat} />
              <InfoRow label="Host association" value={habitat?.hostAssociation} />
              <InfoRow label="Environmental occurrence" value={habitat?.environmentalOccurrence} />
              <InfoRow label="Reservoir" value={habitat?.reservoir} />
            </dl>
          </SectionCard>
        )}

        {hasLabId && (
          <SectionCard title="Lab identification">
            <div className="flex flex-col gap-5">
              {hasMicroscopy && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Microscopy</h3>
                  <dl>
                    <InfoRow label="Stain" value={labIdentification?.microscopy?.stain} />
                    <InfoRow label="Appearance" value={labIdentification?.microscopy?.appearance} />
                    <InfoRow label="Arrangement" value={labIdentification?.microscopy?.arrangement} />
                  </dl>
                </div>
              )}

              {hasCulture && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Culture</h3>
                  <dl>
                    <InfoRow label="Media" value={labIdentification?.culture?.media} />
                    <InfoRow label="Growth characteristics" value={labIdentification?.culture?.growthCharacteristics} />
                    <InfoRow label="Colony morphology" value={labIdentification?.culture?.colonyMorphology} />
                    <InfoRow label="Pigmentation" value={labIdentification?.culture?.pigmentation} />
                    <InfoRow label="Hemolysis" value={labIdentification?.culture?.hemolysis} />
                  </dl>
                </div>
              )}

              {hasBiochemTests && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Biochemical tests</h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[280px] border-collapse">
                      <thead>
                        <tr className="bg-surface-raised">
                          <th scope="col" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-secondary">
                            Test
                          </th>
                          <th scope="col" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-primary">
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {labIdentification?.biochemicalTests?.map((t, i) => (
                          <tr key={`${t.test}-${i}`} className="border-t border-border">
                            <th scope="row" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-secondary">
                              {t.test}
                            </th>
                            <td className="px-4 py-2.5 font-body text-body text-ink-primary">{t.result}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {organism.identificationClues.length > 0 && (
          <CalloutBox type="tip" title="How to recognize it">
            <ul className="list-disc space-y-1 pl-4">
              {organism.identificationClues.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ul>
          </CalloutBox>
        )}

        {hasClinical && (
          <SectionCard title="Clinical & microbiological importance">
            <div className="flex flex-col gap-4">
              {clinicalImportance?.diseases && clinicalImportance.diseases.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Associated diseases/conditions</h3>
                  <BulletList items={clinicalImportance.diseases} />
                </div>
              )}
              {clinicalImportance?.virulenceFactors && clinicalImportance.virulenceFactors.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Virulence factors</h3>
                  <BulletList items={clinicalImportance.virulenceFactors} />
                </div>
              )}
              {clinicalImportance?.toxins && clinicalImportance.toxins.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Toxins</h3>
                  <BulletList items={clinicalImportance.toxins} />
                </div>
              )}
              <dl>
                <InfoRow label="Transmission" value={clinicalImportance?.transmission} />
                <InfoRow label="Epidemiology" value={clinicalImportance?.epidemiology} />
                <InfoRow label="Laboratory significance" value={clinicalImportance?.labSignificance} />
              </dl>
            </div>
          </SectionCard>
        )}

        {hasExamFacts && (
          <div className="rounded-md border border-terracotta/40 bg-surface-raised p-5">
            <h2 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              <Sparkle size={14} className="text-terracotta" aria-hidden />
              Exam quick facts
            </h2>
            <dl>
              <InfoRow label="Gram reaction" value={examFacts.gramReaction} />
              <InfoRow label="Shape" value={examFacts.shape} />
              <InfoRow label="Key biochemical reaction" value={examFacts.keyBiochemicalReaction} />
              <InfoRow label="Important disease" value={examFacts.importantDisease} />
              <InfoRow label="Important test" value={examFacts.importantTest} />
              <InfoRow label="Distinguishing feature" value={examFacts.distinguishingFeature} />
            </dl>
          </div>
        )}

        {relatedOrganisms.length > 0 && (
          <SectionCard title="Related organisms">
            <div className="flex flex-col gap-1">
              <div className="mb-1 flex items-center gap-1.5 font-ui text-caption text-ink-tertiary">
                <GitBranch size={14} aria-hidden />
                Same genus, similar morphology, or commonly confused
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedOrganisms.map((related: OrganismProfile) => (
                  <button
                    key={related.id}
                    type="button"
                    onClick={() => navigate(`/organisms/${related.id}`)}
                    className="rounded-full border border-border-strong bg-canvas px-3 py-1.5 font-ui text-caption font-medium italic text-ink-primary hover:bg-surface-raised"
                  >
                    {related.scientificName}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {organism.sources.length > 0 && (
          <SectionCard title="Sources this profile is informed by">
            <div className="flex flex-col gap-2">
              {organism.sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="font-body text-caption text-ink-secondary">
                    {source.name}
                    <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                      {source.kind === 'educational' ? 'Educational' : 'Scientific'}
                    </span>
                  </span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex shrink-0 items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                    >
                      Visit <ArrowSquareOut size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
