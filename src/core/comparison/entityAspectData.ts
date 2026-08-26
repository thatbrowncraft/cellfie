/**
 * core/comparison/entityAspectData — deterministic mapping from a real
 * Cellfie entity (an `OrganismProfile` or a `LaboratoryContent` item) onto
 * comparison aspect values (brief §12/§13: "Basic comparison generation
 * should NOT require AI" / "If both entities exist in Cellfie, Comparison
 * Studio should be capable of creating a basic structured comparison from
 * their existing structured data").
 *
 * This is the piece that was actually missing before this pass. Item
 * resolution (`entitySearch.ts`) and the source panel (`ComparisonSourcesPanel`
 * + `knowledgeLayer.ts`) already worked — but `NewComparisonPage` built
 * every aspect with `valueA: '', valueB: ''` regardless of whether the
 * resolved organism/Laboratory entity already had that exact information
 * in its own curated JSON. That's why searching e.g. "Gram-positive
 * bacteria vs Gram-negative bacteria" found both organisms fine but still
 * landed on a totally blank workspace.
 *
 * Every value returned here is read directly off a field that already
 * exists in the entity's own curated JSON — nothing is summarized,
 * paraphrased, or invented. An aspect this module can't map to a real
 * field on a given entity is left `undefined`, which the workspace
 * already renders as an empty cell with a "Fill from a source" action
 * (brief §12: "do NOT invent them... show No Cellfie information yet").
 */
import { gramReactionLabels, type OrganismProfile } from '../organisms/types'
import type { LaboratoryContent } from '../laboratory/types'
import { getSuggestedAspects } from './domainPresets'
import type { ComparisonAspect, ComparisonAspectSource, ComparisonDomain, ComparisonItemRef } from './types'

function joinList(items?: string[] | null, sep = '; '): string | undefined {
  if (!items || items.length === 0) return undefined
  const filtered = items.filter(Boolean)
  return filtered.length ? filtered.join(sep) : undefined
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => v && v.trim().length > 0)
}

// ---------------------------------------------------------------------------
// Organism → aspect value (brief tests 33: "Staphylococcus aureus vs
// Staphylococcus epidermidis", plus the Gram-positive/negative scenario)
// ---------------------------------------------------------------------------

/** Every field read here already exists on `OrganismProfile` (core/organisms/types.ts) — see that file for what each one means. */
export function organismAspectValue(o: OrganismProfile, aspectId: string): string | undefined {
  switch (aspectId) {
    case 'overview':
      return firstNonEmpty(
        [o.morphology.gramReaction ? gramReactionLabels[o.morphology.gramReaction] : undefined, o.morphology.shape, o.classification.family ? `family ${o.classification.family}` : undefined]
          .filter(Boolean)
          .join(', ') || undefined,
        o.identificationClues[0]
      )
    case 'key-distinguishing-feature':
      return firstNonEmpty(o.examFacts.distinguishingFeature, o.identificationClues[0])
    case 'primary-purpose':
      return undefined
    case 'limitations':
      return undefined
    case 'morphology':
      return joinList([o.morphology.shape, o.morphology.arrangement].filter(Boolean) as string[], ', ')
    case 'cell-structure':
      return joinList(
        [
          o.morphology.capsule ? `Capsule: ${o.morphology.capsule}` : undefined,
          typeof o.morphology.sporeForming === 'boolean' ? (o.morphology.sporeForming ? 'Spore-forming' : 'Non-spore-forming') : undefined,
          o.morphology.notes
        ].filter(Boolean) as string[]
      )
    case 'gram-staining-reaction':
    case 'cell-wall-structure':
      return o.morphology.gramReaction ? gramReactionLabels[o.morphology.gramReaction] : undefined
    case 'biochemical-characteristics':
      return joinList(o.labIdentification?.biochemicalTests?.map((t) => `${t.test}: ${t.result}`))
    case 'habitat-reservoir':
      return firstNonEmpty(o.habitat?.naturalHabitat, o.habitat?.reservoir, o.habitat?.hostAssociation)
    case 'virulence-factors':
      return joinList(o.clinicalImportance?.virulenceFactors)
    case 'pathogenicity':
      return joinList(o.clinicalImportance?.diseases)
    case 'clinical-significance':
      return firstNonEmpty(o.clinicalImportance?.labSignificance, joinList(o.clinicalImportance?.diseases))
    case 'identification':
      return firstNonEmpty(
        joinList([o.labIdentification?.microscopy?.appearance, o.labIdentification?.culture?.colonyMorphology].filter(Boolean) as string[]),
        joinList(o.identificationClues, '; ')
      )
    case 'treatment-considerations':
      return undefined
    case 'growth-requirements':
      return o.morphology.oxygenRequirement
    case 'genome-type':
      return o.virusDetails?.genomeType ? o.virusDetails.genomeType.toUpperCase() : undefined
    case 'envelope':
      return o.virusDetails?.envelope
    case 'replication-site':
      return o.virusDetails?.replicationSite
    case 'transmission':
    case 'transmission-route':
      return firstNonEmpty(o.virusDetails?.transmissionRoute, o.protozoanDetails?.transmissionRoute, o.clinicalImportance?.transmission)
    case 'morphological-type':
      return o.fungalDetails?.morphologicalType
    case 'clinical-group':
      return o.fungalDetails?.clinicalGroup
    case 'life-cycle-stage':
    case 'diagnostic-stage':
      return o.protozoanDetails?.lifeCycleForm
    case 'classification':
      return firstNonEmpty(o.classification.family, o.classification.genus)
    case 'clinical-relevance':
      return joinList(o.clinicalImportance?.diseases)
    case 'laboratory-relevance':
      return o.clinicalImportance?.labSignificance
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Laboratory content → aspect value (brief test 34: "PCR vs qPCR")
// ---------------------------------------------------------------------------

/** Every field read here already exists on one of the `LaboratoryContent` variants (core/laboratory/types.ts). Category is checked first since each variant only carries the fields relevant to that category. */
export function labAspectValue(c: LaboratoryContent, aspectId: string): string | undefined {
  switch (aspectId) {
    case 'overview':
      if (c.category === 'concept') return c.summary
      if (c.category === 'protocol') return c.purpose
      if (c.category === 'biochemical-test') return c.purpose
      if (c.category === 'media') return c.purpose
      if (c.category === 'equipment') return c.purpose
      if (c.category === 'formula') return c.explanation
      if (c.category === 'biosafety') return c.summary
      return undefined
    case 'primary-purpose':
    case 'purpose':
      if (c.category === 'media') return c.purpose
      if (c.category === 'protocol') return c.purpose
      if (c.category === 'equipment') return c.purpose
      if (c.category === 'biochemical-test') return c.purpose
      return undefined
    case 'principle':
      if (c.category === 'protocol') return c.principle
      if (c.category === 'biochemical-test') return c.principle
      if (c.category === 'equipment') return c.operatingPrinciple
      return undefined
    case 'mechanism':
      if (c.category === 'equipment') return c.operatingPrinciple
      if (c.category === 'concept') return c.explanation
      return undefined
    case 'target':
    case 'target-organisms':
      if (c.category === 'media') return joinList(c.targetOrganisms)
      return undefined
    case 'key-reagents':
      if (c.category === 'protocol') return joinList(c.requiredReagents)
      if (c.category === 'biochemical-test') return joinList(c.reagents)
      return undefined
    case 'detection-readout':
      if (c.category === 'biochemical-test') {
        return joinList([c.positiveResult ? `Positive: ${c.positiveResult}` : undefined, c.negativeResult ? `Negative: ${c.negativeResult}` : undefined].filter(Boolean) as string[], ' / ')
      }
      return undefined
    case 'controls':
      if (c.category === 'biochemical-test') return joinList(c.controls?.map((ctrl) => `${ctrl.type}: ${ctrl.organism}`))
      return undefined
    case 'interpretation':
      if (c.category === 'protocol') return c.interpretation
      if (c.category === 'biochemical-test') return c.interpretation
      return undefined
    case 'equipment':
      if (c.category === 'protocol') return joinList(c.equipment)
      return undefined
    case 'composition':
      if (c.category === 'media') return joinList(c.formulations?.[0]?.compositionPerLiter?.map((ing) => `${ing.ingredient} ${ing.amount}`))
      return undefined
    case 'expected-appearance':
      if (c.category === 'media') return c.expectedAppearance
      return undefined
    case 'classification':
      if (c.category === 'media') return joinList(c.classifications)
      return undefined
    case 'safety':
      if (c.category === 'equipment') return joinList(c.safety)
      if (c.category === 'protocol') return c.biosafetyNotes
      return undefined
    case 'required-practices':
      if (c.category === 'biosafety') return joinList(c.keyPractices)
      return undefined
    case 'examples':
      if (c.category === 'concept') return joinList(c.examples)
      return undefined
    case 'clinical-laboratory-relevance':
    case 'clinical-relevance':
    case 'laboratory-relevance':
      if (c.category === 'concept') return c.summary
      return undefined
    case 'limitations':
      if (c.category === 'protocol') return joinList(c.limitations)
      if (c.category === 'biochemical-test') return joinList(c.limitations)
      return undefined
    case 'domain':
      if (c.category === 'formula') return c.domain
      return undefined
    case 'target-molecule':
      if (c.category === 'formula') return joinList(c.variables?.map((v) => `${v.symbol} — ${v.meaning}`))
      return undefined
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Resolution + assembly
// ---------------------------------------------------------------------------

interface ResolvedEntity {
  kind: 'organism' | 'laboratory'
  title: string
  organism?: OrganismProfile
  lab?: LaboratoryContent
}

/** Dynamically imports whichever registry the ref actually needs (never both) — same bundle-size discipline as `entitySearch.ts` (see that file's header comment). Returns undefined for a custom item (no ref) or a dangling ref, exactly like `resolveEntityRef`. */
async function resolveEntity(ref: ComparisonItemRef): Promise<ResolvedEntity | undefined> {
  if (ref.refKind === 'organism' && ref.refId) {
    const { getOrganismById } = await import('../organisms/registry')
    const organism = getOrganismById(ref.refId)
    if (!organism) return undefined
    return { kind: 'organism', title: organism.commonName ?? organism.scientificName, organism }
  }
  if (ref.refKind === 'laboratory' && ref.refId) {
    const { getLabContentById } = await import('../laboratory/registry')
    const content = getLabContentById(ref.refId)
    if (!content) return undefined
    return { kind: 'laboratory', title: content.title, lab: content }
  }
  return undefined
}

function valueFor(entity: ResolvedEntity | undefined, aspectId: string): string | undefined {
  if (!entity) return undefined
  if (entity.kind === 'organism' && entity.organism) return organismAspectValue(entity.organism, aspectId)
  if (entity.kind === 'laboratory' && entity.lab) return labAspectValue(entity.lab, aspectId)
  return undefined
}

/** "🟢 Curated" provenance pointing at the specific Organism/Laboratory record a value was pulled from — distinct from a curated *comparison* JSON's own provenance, but the same badge kind (both mean "shipped Cellfie content, not a source lookup"). */
function sourceFor(entity: ResolvedEntity | undefined): ComparisonAspectSource[] | undefined {
  if (!entity) return undefined
  const moduleName = entity.kind === 'organism' ? 'Organism Explorer' : 'Laboratory'
  return [{ kind: 'curated', label: `Cellfie ${moduleName} — ${entity.title}` }]
}

/**
 * Builds a basic, structured comparison's aspect rows directly from two
 * real Cellfie entities (brief §12/§13/§32-34) — no curated comparison
 * JSON required, no AI call. Every non-blank cell traces to a field that
 * already exists on the organism/Laboratory profile; a blank cell means
 * Cellfie genuinely has no matching structured field for that aspect on
 * that entity, not that Cellfie skipped looking (the workspace's existing
 * "Fill from a source" action on empty cells covers that gap — brief §19).
 *
 * Safe to call for a fully custom pair too (no `refId` on either side):
 * `resolveEntity` returns undefined for both, so every aspect just comes
 * back blank, identical to the previous behavior.
 */
export async function buildAspectsFromEntities(itemA: ComparisonItemRef, itemB: ComparisonItemRef, domain: ComparisonDomain): Promise<ComparisonAspect[]> {
  const [entityA, entityB] = await Promise.all([resolveEntity(itemA), resolveEntity(itemB)])
  const preset = getSuggestedAspects(domain)
  return preset.map((p): ComparisonAspect => {
    const valueA = valueFor(entityA, p.id) ?? ''
    const valueB = valueFor(entityB, p.id) ?? ''
    return {
      id: p.id,
      label: p.label,
      valueA,
      valueB,
      sourcesA: valueA ? sourceFor(entityA) : undefined,
      sourcesB: valueB ? sourceFor(entityB) : undefined
    }
  })
}
