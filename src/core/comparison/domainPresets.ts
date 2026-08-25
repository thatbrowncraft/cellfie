/**
 * core/comparison/domainPresets — hybrid universal schema + domain-specific
 * aspect presets (brief §4/§5).
 *
 * Every comparison starts from the small universal foundation, then adds
 * whichever domain preset matches its detected/selected `ComparisonDomain`.
 * This is metadata only — a list of `{ id, label }` suggestions offered
 * when building a comparison — never a hard-coded UI per domain (brief
 * §4: "do not create a completely separate UI implementation for every
 * scientific category").
 */
import type { ComparisonDomain } from './types'

export interface AspectPresetEntry {
  id: string
  label: string
}

/** Universal foundation — present as suggestions for every domain, including 'custom' (brief §5). */
export const UNIVERSAL_ASPECT_PRESET: AspectPresetEntry[] = [
  { id: 'overview', label: 'Overview / Core Definition' },
  { id: 'key-distinguishing-feature', label: 'Key Distinguishing Feature' },
  { id: 'primary-purpose', label: 'Primary Purpose / Indication' },
  { id: 'limitations', label: 'Limitations / Pitfalls' }
]

/** Domain-specific presets (brief §4). Each list is suggestions only — the user (or a curated JSON author) picks the subset that's actually relevant, avoiding irrelevant rows (brief §5). */
export const DOMAIN_ASPECT_PRESETS: Record<ComparisonDomain, AspectPresetEntry[]> = {
  'laboratory-technique': [
    { id: 'principle', label: 'Principle' },
    { id: 'target', label: 'Target' },
    { id: 'specimen', label: 'Specimen' },
    { id: 'key-reagents', label: 'Key Reagents' },
    { id: 'detection-readout', label: 'Detection / Readout' },
    { id: 'sensitivity', label: 'Sensitivity' },
    { id: 'specificity', label: 'Specificity' },
    { id: 'time-required', label: 'Time Required' },
    { id: 'controls', label: 'Controls' },
    { id: 'interpretation', label: 'Interpretation' },
    { id: 'common-artifacts', label: 'Common Artifacts' },
    { id: 'when-to-choose', label: 'When to Choose' }
  ],
  organism: [
    { id: 'morphology', label: 'Morphology' },
    { id: 'cell-structure', label: 'Cell Structure' },
    { id: 'gram-staining-reaction', label: 'Gram / Staining Reaction' },
    { id: 'biochemical-characteristics', label: 'Biochemical Characteristics' },
    { id: 'habitat-reservoir', label: 'Habitat / Reservoir' },
    { id: 'virulence-factors', label: 'Virulence Factors' },
    { id: 'pathogenicity', label: 'Pathogenicity' },
    { id: 'clinical-significance', label: 'Clinical Significance' },
    { id: 'identification', label: 'Identification' },
    { id: 'treatment-considerations', label: 'Treatment Considerations' }
  ],
  microbiology: [
    { id: 'classification', label: 'Classification' },
    { id: 'clinical-relevance', label: 'Clinical Relevance' },
    { id: 'laboratory-relevance', label: 'Laboratory Relevance' }
  ],
  bacteriology: [
    { id: 'gram-staining-reaction', label: 'Gram / Staining Reaction' },
    { id: 'cell-wall-structure', label: 'Cell Wall Structure' },
    { id: 'growth-requirements', label: 'Growth Requirements' },
    { id: 'identification', label: 'Identification' }
  ],
  virology: [
    { id: 'genome-type', label: 'Genome Type' },
    { id: 'envelope', label: 'Envelope' },
    { id: 'replication-site', label: 'Replication Site' },
    { id: 'transmission', label: 'Transmission' }
  ],
  mycology: [
    { id: 'morphological-type', label: 'Morphological Type' },
    { id: 'clinical-group', label: 'Clinical Group' },
    { id: 'identification', label: 'Identification' }
  ],
  parasitology: [
    { id: 'life-cycle-stage', label: 'Life Cycle Stage' },
    { id: 'transmission-route', label: 'Transmission Route' },
    { id: 'diagnostic-stage', label: 'Diagnostic Stage' }
  ],
  immunology: [
    { id: 'mechanism', label: 'Mechanism' },
    { id: 'cells-involved', label: 'Cells Involved' },
    { id: 'response-timeline', label: 'Response Timeline' },
    { id: 'specificity', label: 'Specificity' }
  ],
  'molecular-biology': [
    { id: 'target-molecule', label: 'Target Molecule' },
    { id: 'mechanism', label: 'Mechanism' },
    { id: 'sensitivity', label: 'Sensitivity' }
  ],
  diagnostics: [
    { id: 'target', label: 'Target' },
    { id: 'turnaround-time', label: 'Turnaround Time' },
    { id: 'sensitivity', label: 'Sensitivity' },
    { id: 'specificity', label: 'Specificity' },
    { id: 'cost-considerations', label: 'Cost Considerations' }
  ],
  'culture-media': [
    { id: 'purpose', label: 'Purpose' },
    { id: 'composition', label: 'Composition' },
    { id: 'target-organisms', label: 'Target Organisms' },
    { id: 'expected-appearance', label: 'Expected Appearance' }
  ],
  'laboratory-equipment': [
    { id: 'principle', label: 'Principle' },
    { id: 'mechanism', label: 'Mechanism' },
    { id: 'temperature-pressure', label: 'Temperature / Pressure' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'duration', label: 'Duration' },
    { id: 'safety', label: 'Safety' },
    { id: 'waste-disposal', label: 'Waste Disposal' },
    { id: 'applications', label: 'Applications' }
  ],
  biosafety: [
    { id: 'risk-level', label: 'Risk Level' },
    { id: 'required-practices', label: 'Required Practices' },
    { id: 'containment-equipment', label: 'Containment Equipment' },
    { id: 'applicable-agents', label: 'Applicable Agents' }
  ],
  'biological-structure': [
    { id: 'composition', label: 'Composition' },
    { id: 'function', label: 'Function' },
    { id: 'location', label: 'Location' }
  ],
  'scientific-concept': [
    { id: 'mechanism', label: 'Mechanism' },
    { id: 'examples', label: 'Examples' },
    { id: 'clinical-laboratory-relevance', label: 'Clinical/Laboratory Relevance' }
  ],
  custom: []
}

/** Combines the universal foundation with a domain's preset, de-duplicated by id — the suggestion list offered when building/editing a comparison (brief §20 "add an aspect"). */
export function getSuggestedAspects(domain: ComparisonDomain): AspectPresetEntry[] {
  const seen = new Set<string>()
  const combined = [...UNIVERSAL_ASPECT_PRESET, ...DOMAIN_ASPECT_PRESETS[domain]]
  return combined.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
}
