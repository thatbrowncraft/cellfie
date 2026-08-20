import { Dropdown } from '@/shared/components'
import {
  arrangementCategoryLabels,
  bodyLocationLabels,
  fungalClinicalGroupLabels,
  fungalMorphologicalTypeLabels,
  hyphaeTypeLabels,
  oxygenRequirementCategoryLabels,
  protozoanGroupLabels,
  shapeCategoryLabels,
  transmissionRouteLabels,
  viralEnvelopeLabels,
  viralGenomeStrandednessLabels,
  viralGenomeTypeLabels,
  viralReplicationSiteLabels,
  type ArrangementCategory,
  type BacteriaFilterState,
  type BodyLocation,
  type FungalClinicalGroup,
  type FungalMorphologicalType,
  type FungiFilterState,
  type GramFilterValue,
  type HyphaeType,
  type OxygenRequirementCategory,
  type ProtozoaFilterState,
  type ProtozoanGroup,
  type ShapeCategory,
  type TransmissionRoute,
  type ViralEnvelope,
  type ViralGenomeStrandedness,
  type ViralGenomeType,
  type ViralReplicationSite,
  type VirusFilterState
} from '@/core/organisms'

/**
 * Category-aware filter panels — Sprint 4 Master Revision §4-§9. Each
 * organism category gets its own compact panel of the filters that
 * actually apply to it (§4: "Do NOT show one giant universal filter
 * dropdown containing every possible microbiology characteristic").
 * Every dropdown here reads/writes a normalized enum field, never a
 * free-text substring match (§6), and an "All" option is always the
 * `undefined` value for that dimension so filters can combine freely
 * with search and with each other.
 */

const ALL = 'all'

function toOptions<T extends string>(labels: Record<T, string>): { value: string; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
}

// ---------------------------------------------------------------------------
// Bacteria (§5, §6)
// ---------------------------------------------------------------------------

const gramOptions = [
  { value: ALL, label: 'All' },
  { value: 'positive', label: 'Gram-positive' },
  { value: 'negative', label: 'Gram-negative' },
  { value: 'acid-fast', label: 'Acid-fast' }
]
const shapeOptions = [{ value: ALL, label: 'All' }, ...toOptions(shapeCategoryLabels)]
const arrangementOptions = [{ value: ALL, label: 'All' }, ...toOptions(arrangementCategoryLabels)]
const oxygenOptions = [{ value: ALL, label: 'All' }, ...toOptions(oxygenRequirementCategoryLabels)]
const sporeOptions = [
  { value: ALL, label: 'All' },
  { value: 'true', label: 'Spore-forming' },
  { value: 'false', label: 'Non-spore-forming' }
]
const motileOptions = [
  { value: ALL, label: 'All' },
  { value: 'true', label: 'Motile' },
  { value: 'false', label: 'Non-motile' }
]
const capsuleOptions = [
  { value: ALL, label: 'All' },
  { value: 'true', label: 'Encapsulated' },
  { value: 'false', label: 'Non-encapsulated' }
]

function toBool(v: string): boolean | undefined {
  return v === ALL ? undefined : v === 'true'
}

interface BacteriaFiltersProps {
  filters: BacteriaFilterState
  onChange: (filters: BacteriaFilterState) => void
}

export function BacteriaFilters({ filters, onChange }: BacteriaFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Dropdown
        label="Gram reaction"
        options={gramOptions}
        value={filters.gram ?? ALL}
        onChange={(v) => onChange({ ...filters, gram: v === ALL ? undefined : (v as GramFilterValue) })}
        className="w-40"
      />
      <Dropdown
        label="Shape"
        options={shapeOptions}
        value={filters.shapeCategory ?? ALL}
        onChange={(v) => onChange({ ...filters, shapeCategory: v === ALL ? undefined : (v as ShapeCategory) })}
        className="w-40"
      />
      <Dropdown
        label="Arrangement"
        options={arrangementOptions}
        value={filters.arrangementCategory ?? ALL}
        onChange={(v) => onChange({ ...filters, arrangementCategory: v === ALL ? undefined : (v as ArrangementCategory) })}
        className="w-40"
      />
      <Dropdown
        label="Oxygen"
        options={oxygenOptions}
        value={filters.oxygenRequirementCategory ?? ALL}
        onChange={(v) =>
          onChange({ ...filters, oxygenRequirementCategory: v === ALL ? undefined : (v as OxygenRequirementCategory) })
        }
        className="w-40"
      />
      <Dropdown
        label="Spore"
        options={sporeOptions}
        value={filters.sporeForming === undefined ? ALL : String(filters.sporeForming)}
        onChange={(v) => onChange({ ...filters, sporeForming: toBool(v) })}
        className="w-40"
      />
      <Dropdown
        label="Motility"
        options={motileOptions}
        value={filters.motile === undefined ? ALL : String(filters.motile)}
        onChange={(v) => onChange({ ...filters, motile: toBool(v) })}
        className="w-40"
      />
      <Dropdown
        label="Capsule"
        options={capsuleOptions}
        value={filters.encapsulated === undefined ? ALL : String(filters.encapsulated)}
        onChange={(v) => onChange({ ...filters, encapsulated: toBool(v) })}
        className="w-40"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fungi (§7)
// ---------------------------------------------------------------------------

const fungalTypeOptions = [{ value: ALL, label: 'All' }, ...toOptions(fungalMorphologicalTypeLabels)]
const hyphaeOptions = [{ value: ALL, label: 'All' }, ...toOptions(hyphaeTypeLabels)]
const fungalClinicalGroupOptions = [{ value: ALL, label: 'All' }, ...toOptions(fungalClinicalGroupLabels)]

interface FungiFiltersProps {
  filters: FungiFilterState
  onChange: (filters: FungiFilterState) => void
}

export function FungiFilters({ filters, onChange }: FungiFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Dropdown
        label="Morphological type"
        options={fungalTypeOptions}
        value={filters.morphologicalType ?? ALL}
        onChange={(v) => onChange({ ...filters, morphologicalType: v === ALL ? undefined : (v as FungalMorphologicalType) })}
        className="w-44"
      />
      <Dropdown
        label="Hyphae"
        options={hyphaeOptions}
        value={filters.hyphae ?? ALL}
        onChange={(v) => onChange({ ...filters, hyphae: v === ALL ? undefined : (v as HyphaeType) })}
        className="w-40"
      />
      <Dropdown
        label="Clinical group"
        options={fungalClinicalGroupOptions}
        value={filters.clinicalGroup ?? ALL}
        onChange={(v) => onChange({ ...filters, clinicalGroup: v === ALL ? undefined : (v as FungalClinicalGroup) })}
        className="w-40"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Protozoa (§8)
// ---------------------------------------------------------------------------

const protozoanGroupOptions = [{ value: ALL, label: 'All' }, ...toOptions(protozoanGroupLabels)]
const bodyLocationOptions = [{ value: ALL, label: 'All' }, ...toOptions(bodyLocationLabels)]
const transmissionOptions = [{ value: ALL, label: 'All' }, ...toOptions(transmissionRouteLabels)]

interface ProtozoaFiltersProps {
  filters: ProtozoaFilterState
  onChange: (filters: ProtozoaFilterState) => void
}

export function ProtozoaFilters({ filters, onChange }: ProtozoaFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Dropdown
        label="Group"
        options={protozoanGroupOptions}
        value={filters.group ?? ALL}
        onChange={(v) => onChange({ ...filters, group: v === ALL ? undefined : (v as ProtozoanGroup) })}
        className="w-44"
      />
      <Dropdown
        label="Major location"
        options={bodyLocationOptions}
        value={filters.majorLocation ?? ALL}
        onChange={(v) => onChange({ ...filters, majorLocation: v === ALL ? undefined : (v as BodyLocation) })}
        className="w-40"
      />
      <Dropdown
        label="Transmission"
        options={transmissionOptions}
        value={filters.transmissionRoute ?? ALL}
        onChange={(v) => onChange({ ...filters, transmissionRoute: v === ALL ? undefined : (v as TransmissionRoute) })}
        className="w-40"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Viruses (§9)
// ---------------------------------------------------------------------------

const genomeTypeOptions = [{ value: ALL, label: 'All' }, ...toOptions(viralGenomeTypeLabels)]
const genomeStrandOptions = [{ value: ALL, label: 'All' }, ...toOptions(viralGenomeStrandednessLabels)]
const envelopeOptions = [{ value: ALL, label: 'All' }, ...toOptions(viralEnvelopeLabels)]
const replicationSiteOptions = [{ value: ALL, label: 'All' }, ...toOptions(viralReplicationSiteLabels)]

interface VirusFiltersProps {
  filters: VirusFilterState
  onChange: (filters: VirusFilterState) => void
}

export function VirusFilters({ filters, onChange }: VirusFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Dropdown
        label="Genome"
        options={genomeTypeOptions}
        value={filters.genomeType ?? ALL}
        onChange={(v) => onChange({ ...filters, genomeType: v === ALL ? undefined : (v as ViralGenomeType) })}
        className="w-36"
      />
      <Dropdown
        label="Genome type"
        options={genomeStrandOptions}
        value={filters.genomeStrandedness ?? ALL}
        onChange={(v) => onChange({ ...filters, genomeStrandedness: v === ALL ? undefined : (v as ViralGenomeStrandedness) })}
        className="w-36"
      />
      <Dropdown
        label="Envelope"
        options={envelopeOptions}
        value={filters.envelope ?? ALL}
        onChange={(v) => onChange({ ...filters, envelope: v === ALL ? undefined : (v as ViralEnvelope) })}
        className="w-40"
      />
      <Dropdown
        label="Replication"
        options={replicationSiteOptions}
        value={filters.replicationSite ?? ALL}
        onChange={(v) => onChange({ ...filters, replicationSite: v === ALL ? undefined : (v as ViralReplicationSite) })}
        className="w-40"
      />
      <Dropdown
        label="Transmission"
        options={transmissionOptions}
        value={filters.transmissionRoute ?? ALL}
        onChange={(v) => onChange({ ...filters, transmissionRoute: v === ALL ? undefined : (v as TransmissionRoute) })}
        className="w-40"
      />
    </div>
  )
}
