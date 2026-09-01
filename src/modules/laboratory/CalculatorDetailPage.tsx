import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '../../shared/layouts'
import { useBreakpointClass, GRID_COLS_PRESETS } from '../../shared/hooks/useMediaQuery'
import { Button, EmptyState, Input, Dropdown } from '../../shared/components'
import {
  CalculatorError,
  calculateCfuPerGram,
  calculateCfuPerMl,
  calculateConcentrationFromAbsorbance,
  calculateCumulativeDilution,
  calculateDilutionFactor,
  calculateRbcIndices,
  calculateRcfFromRpm,
  calculateRequiredMass,
  calculateRpmFromRcf,
  calculateStatistics,
  getCalculatorMeta,
  solveC1V1,
  type C1V1Solve,
  type CalculatorOutcome
} from '../../core/laboratory/calculators'
import { getCalculatorTagline } from '../../core/laboratory/microcopy'
import { resolveRelated } from '../../core/laboratory/registry'
import { resolveClinicalRelated } from '../../core/laboratory/clinicalRegistry'
import type { LaboratoryContent } from '../../core/laboratory/types'
import { CalculatorResultCard } from './components/CalculatorResultCard'
import { RelatedContentList } from './components/RelatedContentList'

function useNumberField(initial = '') {
  const [raw, setRaw] = useState(initial)
  const value = raw.trim() === '' ? undefined : Number(raw)
  return { raw, setRaw, value }
}

function runCalculation(compute: () => CalculatorOutcome): { outcome: CalculatorOutcome | null; error: string | null } {
  try {
    return { outcome: compute(), error: null }
  } catch (e) {
    if (e instanceof CalculatorError) return { outcome: null, error: e.message }
    return { outcome: null, error: 'Something went wrong with this calculation. Check your inputs and try again.' }
  }
}

/**
 * Calculator Detail — Tier 1 Foundation (brief §11, §28 Phase F). One
 * page hosts every Tier 1 calculator, switching form fields by
 * `calculatorId`; all seven share the same result presentation via
 * `CalculatorResultCard` (brief §25) and the same input-validation
 * behavior (brief §24 — a human-readable message, never a raw JS error).
 */
export function CalculatorDetailPage() {
  const { calculatorId } = useParams<{ calculatorId: string }>()
  const navigate = useNavigate()
  const meta = calculatorId ? getCalculatorMeta(calculatorId) : undefined

  if (!calculatorId || !meta) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Calculator not found"
          description="This calculator doesn't exist yet."
          action={
            <Button variant="secondary" onClick={() => navigate('/laboratory?section=calculators')}>
              Back to Calculators
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  const relatedFormulas = resolveRelated(meta.relatedFormulas)
  const relatedProtocols = resolveRelated(meta.relatedProtocols)

  // Some Tier-2+ calculators (e.g. RBC Indices, added by the Laboratory
  // Clinical Expansion) link to clin-* ids that only exist in the lazy
  // clinical registry — resolveRelated (main registry only) can't find
  // those synchronously. Resolve any ids the main registry missed via a
  // dynamic import of clinicalRegistry, same bundle-safety pattern used
  // throughout that module (never a static/eager clinical content pull).
  const [clinicalFormulas, setClinicalFormulas] = useState<LaboratoryContent[]>([])
  const [clinicalProtocols, setClinicalProtocols] = useState<LaboratoryContent[]>([])
  useEffect(() => {
    const missingFormulaIds = meta.relatedFormulas.filter((id) => !relatedFormulas.some((f) => f.id === id))
    const missingProtocolIds = meta.relatedProtocols.filter((id) => !relatedProtocols.some((p) => p.id === id))
    let cancelled = false
    if (missingFormulaIds.length > 0) {
      resolveClinicalRelated(missingFormulaIds).then((items) => {
        if (!cancelled) setClinicalFormulas(items)
      })
    } else {
      setClinicalFormulas([])
    }
    if (missingProtocolIds.length > 0) {
      resolveClinicalRelated(missingProtocolIds).then((items) => {
        if (!cancelled) setClinicalProtocols(items)
      })
    } else {
      setClinicalProtocols([])
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatorId])

  const allRelatedFormulas = [...relatedFormulas, ...clinicalFormulas]
  const allRelatedProtocols = [...relatedProtocols, ...clinicalProtocols]

  // PWA layout-isolation fix — was `grid-cols-1 lg:grid-cols-2`; see
  // `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
  const gridColsClass = useBreakpointClass(GRID_COLS_PRESETS.oneTwo)

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/laboratory')} className="hover:text-ink-secondary hover:underline">
          Laboratory
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate('/laboratory?section=calculators')}
          className="hover:text-ink-secondary hover:underline"
        >
          Calculators
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{meta.title}</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} className="mb-4">
        Back
      </Button>

      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">{meta.title}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{getCalculatorTagline(calculatorId)}</p>
        <p className="mt-2 font-body text-body text-ink-secondary">{meta.shortDescription}</p>
      </header>

      <div className={`grid gap-8 ${gridColsClass}`}>
        <div>{renderCalculatorForm(calculatorId)}</div>
        <div className="flex flex-col gap-6">
          {allRelatedFormulas.length > 0 && <RelatedContentList title="Related Formulas" items={allRelatedFormulas} />}
          {allRelatedProtocols.length > 0 && <RelatedContentList title="Related Protocols" items={allRelatedProtocols} />}
        </div>
      </div>
    </div>
  )
}

function renderCalculatorForm(id: string) {
  switch (id) {
    case 'calc-cfu-ml':
      return <CfuMlForm />
    case 'calc-cfu-g':
      return <CfuGForm />
    case 'calc-dilution-factor':
      return <DilutionFactorForm />
    case 'calc-c1v1':
      return <C1V1Form />
    case 'calc-molarity-mass':
      return <MolarityMassForm />
    case 'calc-rcf-rpm':
      return <RcfRpmForm />
    case 'calc-statistics':
      return <StatisticsForm />
    case 'calc-beer-lambert':
      return <BeerLambertForm />
    case 'calc-rbc-indices':
      return <RbcIndicesForm />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// 1. CFU/mL
// ---------------------------------------------------------------------------

function CfuMlForm() {
  const colonyCount = useNumberField()
  const volumePlated = useNumberField('0.1')
  const dilution = useNumberField('1')

  const { outcome, error } = useMemo(() => {
    if (colonyCount.value === undefined || volumePlated.value === undefined || dilution.value === undefined) {
      return { outcome: null, error: null }
    }
    return runCalculation(() =>
      calculateCfuPerMl({ colonyCount: colonyCount.value!, volumePlatedMl: volumePlated.value!, dilutionFactor: dilution.value! })
    )
  }, [colonyCount.value, volumePlated.value, dilution.value])

  return (
    <div className="flex flex-col gap-4">
      <Input label="Colony count (N)" type="number" inputMode="decimal" value={colonyCount.raw} onChange={(e) => colonyCount.setRaw(e.target.value)} />
      <Input label="Volume plated (mL)" type="number" inputMode="decimal" value={volumePlated.raw} onChange={(e) => volumePlated.setRaw(e.target.value)} />
      <Input
        label="Dilution factor (e.g. 0.0001 for a 1:10,000 dilution)"
        type="number"
        inputMode="decimal"
        value={dilution.raw}
        onChange={(e) => dilution.setRaw(e.target.value)}
      />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. CFU/g
// ---------------------------------------------------------------------------

function CfuGForm() {
  const colonyCount = useNumberField()
  const volumePlated = useNumberField('0.1')
  const plateDilution = useNumberField('1')
  const sampleMass = useNumberField('10')
  const diluentVolume = useNumberField('90')

  const { outcome, error } = useMemo(() => {
    if ([colonyCount, volumePlated, plateDilution, sampleMass, diluentVolume].some((f) => f.value === undefined)) {
      return { outcome: null, error: null }
    }
    return runCalculation(() =>
      calculateCfuPerGram({
        colonyCount: colonyCount.value!,
        volumePlatedMl: volumePlated.value!,
        plateDilutionFactor: plateDilution.value!,
        sampleMassG: sampleMass.value!,
        diluentVolumeMl: diluentVolume.value!
      })
    )
  }, [colonyCount.value, volumePlated.value, plateDilution.value, sampleMass.value, diluentVolume.value])

  return (
    <div className="flex flex-col gap-4">
      <Input label="Colony count (N)" type="number" inputMode="decimal" value={colonyCount.raw} onChange={(e) => colonyCount.setRaw(e.target.value)} />
      <Input label="Volume plated (mL)" type="number" inputMode="decimal" value={volumePlated.raw} onChange={(e) => volumePlated.setRaw(e.target.value)} />
      <Input label="Sample mass (g)" type="number" inputMode="decimal" value={sampleMass.raw} onChange={(e) => sampleMass.setRaw(e.target.value)} />
      <Input
        label="Homogenization diluent volume (mL)"
        type="number"
        inputMode="decimal"
        value={diluentVolume.raw}
        onChange={(e) => diluentVolume.setRaw(e.target.value)}
        helperText="The diluent the sample mass was blended into (e.g. 90 mL for a 1:10 homogenization)."
      />
      <Input
        label="Additional plate dilution factor (1 if none)"
        type="number"
        inputMode="decimal"
        value={plateDilution.raw}
        onChange={(e) => plateDilution.setRaw(e.target.value)}
      />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Dilution Factor
// ---------------------------------------------------------------------------

function DilutionFactorForm() {
  const [mode, setMode] = useState<'single' | 'serial'>('single')
  const sampleVolume = useNumberField('1')
  const diluentVolume = useNumberField('9')
  const [stepsRaw, setStepsRaw] = useState('0.1, 0.1, 0.1')

  const singleResult = useMemo(() => {
    if (sampleVolume.value === undefined || diluentVolume.value === undefined) return { outcome: null, error: null }
    return runCalculation(() => calculateDilutionFactor({ sampleVolume: sampleVolume.value!, diluentVolume: diluentVolume.value! }))
  }, [sampleVolume.value, diluentVolume.value])

  const serialResult = useMemo(() => {
    const parsed = stepsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
    if (parsed.length === 0 || parsed.some((n) => Number.isNaN(n))) {
      return { outcome: null, error: stepsRaw.trim() ? 'Enter comma-separated dilution factors, e.g. 0.1, 0.1, 0.01' : null }
    }
    return runCalculation(() => calculateCumulativeDilution({ stepFactors: parsed }))
  }, [stepsRaw])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant={mode === 'single' ? 'primary' : 'secondary'} size="small" onClick={() => setMode('single')}>
          Single Dilution
        </Button>
        <Button variant={mode === 'serial' ? 'primary' : 'secondary'} size="small" onClick={() => setMode('serial')}>
          Serial (Cumulative)
        </Button>
      </div>
      {mode === 'single' ? (
        <>
          <Input label="Sample volume" type="number" inputMode="decimal" value={sampleVolume.raw} onChange={(e) => sampleVolume.setRaw(e.target.value)} />
          <Input label="Diluent volume" type="number" inputMode="decimal" value={diluentVolume.raw} onChange={(e) => diluentVolume.setRaw(e.target.value)} />
          <CalculatorResultCard outcome={singleResult.outcome} error={singleResult.error} />
        </>
      ) : (
        <>
          <Input
            label="Step dilution factors (comma-separated)"
            value={stepsRaw}
            onChange={(e) => setStepsRaw(e.target.value)}
            helperText="e.g. 0.1, 0.1, 0.1 for three consecutive 1:10 dilutions"
          />
          <CalculatorResultCard outcome={serialResult.outcome} error={serialResult.error} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. C1V1 = C2V2
// ---------------------------------------------------------------------------

function C1V1Form() {
  const [solveFor, setSolveFor] = useState<C1V1Solve>('v1')
  const c1 = useNumberField()
  const v1 = useNumberField()
  const c2 = useNumberField()
  const v2 = useNumberField()
  const [concentrationUnit, setConcentrationUnit] = useState('M')
  const [volumeUnit, setVolumeUnit] = useState('mL')

  const { outcome, error } = useMemo(() => {
    return runCalculation(() =>
      solveC1V1({
        solveFor,
        c1: solveFor === 'c1' ? undefined : c1.value,
        v1: solveFor === 'v1' ? undefined : v1.value,
        c2: solveFor === 'c2' ? undefined : c2.value,
        v2: solveFor === 'v2' ? undefined : v2.value,
        concentrationUnit,
        volumeUnit
      })
    )
  }, [solveFor, c1.value, v1.value, c2.value, v2.value, concentrationUnit, volumeUnit])

  const fieldOptions = [
    { value: 'c1', label: 'C₁ (initial concentration)' },
    { value: 'v1', label: 'V₁ (initial/stock volume)' },
    { value: 'c2', label: 'C₂ (final concentration)' },
    { value: 'v2', label: 'V₂ (final volume)' }
  ]

  return (
    <div className="flex flex-col gap-4">
      <Dropdown label="Solve for" options={fieldOptions} value={solveFor} onChange={(v) => setSolveFor(v as C1V1Solve)} />
      {solveFor !== 'c1' && <Input label="C₁" type="number" inputMode="decimal" value={c1.raw} onChange={(e) => c1.setRaw(e.target.value)} />}
      {solveFor !== 'v1' && <Input label="V₁" type="number" inputMode="decimal" value={v1.raw} onChange={(e) => v1.setRaw(e.target.value)} />}
      {solveFor !== 'c2' && <Input label="C₂" type="number" inputMode="decimal" value={c2.raw} onChange={(e) => c2.setRaw(e.target.value)} />}
      {solveFor !== 'v2' && <Input label="V₂" type="number" inputMode="decimal" value={v2.raw} onChange={(e) => v2.setRaw(e.target.value)} />}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Concentration unit label" value={concentrationUnit} onChange={(e) => setConcentrationUnit(e.target.value)} />
        <Input label="Volume unit label" value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value)} />
      </div>
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Molarity / Mass Preparation
// ---------------------------------------------------------------------------

function MolarityMassForm() {
  const molarity = useNumberField()
  const volume = useNumberField()
  const mw = useNumberField()

  const { outcome, error } = useMemo(() => {
    if (molarity.value === undefined || volume.value === undefined || mw.value === undefined) return { outcome: null, error: null }
    return runCalculation(() =>
      calculateRequiredMass({ targetMolarityM: molarity.value!, finalVolumeL: volume.value!, molecularWeightGPerMol: mw.value! })
    )
  }, [molarity.value, volume.value, mw.value])

  return (
    <div className="flex flex-col gap-4">
      <Input label="Target molarity (mol/L)" type="number" inputMode="decimal" value={molarity.raw} onChange={(e) => molarity.setRaw(e.target.value)} />
      <Input label="Final volume (L)" type="number" inputMode="decimal" value={volume.raw} onChange={(e) => volume.setRaw(e.target.value)} />
      <Input label="Molecular weight (g/mol)" type="number" inputMode="decimal" value={mw.raw} onChange={(e) => mw.setRaw(e.target.value)} />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. RCF ⇄ RPM
// ---------------------------------------------------------------------------

function RcfRpmForm() {
  const [direction, setDirection] = useState<'rpm-to-rcf' | 'rcf-to-rpm'>('rpm-to-rcf')
  const rpm = useNumberField()
  const rcf = useNumberField()
  const radius = useNumberField()

  const { outcome, error } = useMemo(() => {
    if (radius.value === undefined) return { outcome: null, error: null }
    if (direction === 'rpm-to-rcf') {
      if (rpm.value === undefined) return { outcome: null, error: null }
      return runCalculation(() => calculateRcfFromRpm({ rpm: rpm.value!, rotorRadiusCm: radius.value! }))
    }
    if (rcf.value === undefined) return { outcome: null, error: null }
    return runCalculation(() => calculateRpmFromRcf({ rcf: rcf.value!, rotorRadiusCm: radius.value! }))
  }, [direction, rpm.value, rcf.value, radius.value])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant={direction === 'rpm-to-rcf' ? 'primary' : 'secondary'} size="small" onClick={() => setDirection('rpm-to-rcf')}>
          RPM → RCF
        </Button>
        <Button variant={direction === 'rcf-to-rpm' ? 'primary' : 'secondary'} size="small" onClick={() => setDirection('rcf-to-rpm')}>
          RCF → RPM
        </Button>
      </div>
      <Input
        label="Rotor radius (cm)"
        type="number"
        inputMode="decimal"
        value={radius.raw}
        onChange={(e) => radius.setRaw(e.target.value)}
        helperText="Measured per your centrifuge's documented convention — this varies by rotor."
      />
      {direction === 'rpm-to-rcf' ? (
        <Input label="Speed (RPM)" type="number" inputMode="decimal" value={rpm.raw} onChange={(e) => rpm.setRaw(e.target.value)} />
      ) : (
        <Input label="Target RCF (×g)" type="number" inputMode="decimal" value={rcf.raw} onChange={(e) => rcf.setRaw(e.target.value)} />
      )}
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7. Basic Statistics
// ---------------------------------------------------------------------------

function StatisticsForm() {
  const [valuesRaw, setValuesRaw] = useState('')
  const [mode, setMode] = useState<'sample' | 'population'>('sample')

  const { outcome, error } = useMemo(() => {
    const parsed = valuesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
    if (parsed.length === 0) return { outcome: null, error: null }
    if (parsed.some((n) => Number.isNaN(n))) return { outcome: null, error: 'Enter comma-separated numbers, e.g. 28, 31, 30' }
    return runCalculation(() => calculateStatistics({ values: parsed, mode }))
  }, [valuesRaw, mode])

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Values (comma-separated)"
        value={valuesRaw}
        onChange={(e) => setValuesRaw(e.target.value)}
        helperText="e.g. 28, 31, 30"
      />
      <Dropdown
        label="Standard deviation mode"
        options={[
          { value: 'sample', label: 'Sample (n − 1) — replicate measurements' },
          { value: 'population', label: 'Population (n) — the entire population' }
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'sample' | 'population')}
      />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 8. Beer-Lambert Concentration from Absorbance
// ---------------------------------------------------------------------------

function BeerLambertForm() {
  const absorbance = useNumberField()
  const molarAbsorptivity = useNumberField()
  const pathLength = useNumberField('1')

  const { outcome, error } = useMemo(() => {
    if (absorbance.value === undefined || molarAbsorptivity.value === undefined || pathLength.value === undefined) return { outcome: null, error: null }
    return runCalculation(() =>
      calculateConcentrationFromAbsorbance({ absorbance: absorbance.value!, molarAbsorptivity: molarAbsorptivity.value!, pathLengthCm: pathLength.value! })
    )
  }, [absorbance.value, molarAbsorptivity.value, pathLength.value])

  return (
    <div className="flex flex-col gap-4">
      <Input label="Absorbance (A)" type="number" inputMode="decimal" value={absorbance.raw} onChange={(e) => absorbance.setRaw(e.target.value)} />
      <Input
        label="Molar absorptivity, ε (L·mol⁻¹·cm⁻¹)"
        type="number"
        inputMode="decimal"
        value={molarAbsorptivity.raw}
        onChange={(e) => molarAbsorptivity.setRaw(e.target.value)}
      />
      <Input
        label="Path length (cm)"
        type="number"
        inputMode="decimal"
        value={pathLength.raw}
        onChange={(e) => pathLength.setRaw(e.target.value)}
        helperText="Standard cuvette path length is usually 1 cm"
      />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 9. RBC Indices (Laboratory Clinical Expansion — Hematology)
// ---------------------------------------------------------------------------

function RbcIndicesForm() {
  const hemoglobin = useNumberField()
  const hematocrit = useNumberField()
  const rbcCount = useNumberField()

  const { outcome, error } = useMemo(() => {
    if (hemoglobin.value === undefined || hematocrit.value === undefined || rbcCount.value === undefined) {
      return { outcome: null, error: null }
    }
    return runCalculation(() =>
      calculateRbcIndices({ hemoglobinGDl: hemoglobin.value!, hematocritPercent: hematocrit.value!, rbcCountMillionsPerUl: rbcCount.value! })
    )
  }, [hemoglobin.value, hematocrit.value, rbcCount.value])

  return (
    <div className="flex flex-col gap-4">
      <Input label="Hemoglobin, Hb (g/dL)" type="number" inputMode="decimal" value={hemoglobin.raw} onChange={(e) => hemoglobin.setRaw(e.target.value)} />
      <Input
        label="Hematocrit / PCV, Hct (%)"
        type="number"
        inputMode="decimal"
        value={hematocrit.raw}
        onChange={(e) => hematocrit.setRaw(e.target.value)}
      />
      <Input
        label="RBC count (millions/µL)"
        type="number"
        inputMode="decimal"
        value={rbcCount.raw}
        onChange={(e) => rbcCount.setRaw(e.target.value)}
      />
      <CalculatorResultCard outcome={outcome} error={error} />
    </div>
  )
}
