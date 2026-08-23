import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowsLeftRight, CaretRight } from '@phosphor-icons/react'
import { Button, CalloutBox, Dropdown, Input } from '../../shared/components'
import { UNIT_CONVERTER_TAGLINE } from '../../core/laboratory/microcopy'
import { convertLinear, convertTemperature, getUnitsForDimension, UNITS, type UnitDimension } from '../../core/laboratory/units'

const DIMENSIONS: { id: UnitDimension; label: string }[] = [
  { id: 'mass', label: 'Mass' },
  { id: 'volume', label: 'Volume' },
  { id: 'length', label: 'Length' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'mass-concentration', label: 'Concentration (mass/volume)' },
  { id: 'molar-concentration', label: 'Molar Concentration' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'time', label: 'Time' }
]

/**
 * Unit Converter — Tier 1 Foundation (brief §12, §28 Phase G).
 * Dimension-first UI: choosing a dimension filters both unit dropdowns to
 * only units that measure the same thing, so an invalid cross-dimension
 * conversion is structurally unavailable rather than merely validated
 * against after the fact. Centrifugation (RPM ⇄ RCF) is intentionally not
 * a dimension here — see the RCF ⇄ RPM Calculator, since that conversion
 * needs a rotor radius, not just a fixed factor.
 */
export function UnitConverterPage() {
  const navigate = useNavigate()
  const [dimension, setDimension] = useState<UnitDimension>('volume')
  const unitsInDimension = useMemo(() => getUnitsForDimension(dimension), [dimension])
  const [fromUnit, setFromUnit] = useState(unitsInDimension[0]?.id ?? '')
  const [toUnit, setToUnit] = useState(unitsInDimension[1]?.id ?? unitsInDimension[0]?.id ?? '')
  const [valueRaw, setValueRaw] = useState('1')

  function handleDimensionChange(next: UnitDimension) {
    setDimension(next)
    const units = getUnitsForDimension(next)
    setFromUnit(units[0]?.id ?? '')
    setToUnit(units[1]?.id ?? units[0]?.id ?? '')
  }

  function swap() {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }

  const { result, error } = useMemo(() => {
    const value = Number(valueRaw)
    if (valueRaw.trim() === '' || Number.isNaN(value)) return { result: null, error: null }
    try {
      if (dimension === 'temperature') {
        const r = convertTemperature(value, fromUnit as 'C' | 'F' | 'K', toUnit as 'C' | 'F' | 'K')
        return { result: r, error: null }
      }
      const r = convertLinear(value, fromUnit, toUnit)
      return { result: r, error: null }
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Could not convert this value.' }
    }
  }, [valueRaw, fromUnit, toUnit, dimension])

  const fromLabel = UNITS.find((u) => u.id === fromUnit)?.label ?? fromUnit
  const toLabel = UNITS.find((u) => u.id === toUnit)?.label ?? toUnit

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/laboratory')} className="hover:text-ink-secondary hover:underline">
          Laboratory
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">Unit Converter</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} className="mb-4">
        Back
      </Button>

      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">Unit Converter</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{UNIT_CONVERTER_TAGLINE}</p>
      </header>

      <div className="flex max-w-lg flex-col gap-4">
        <Dropdown
          label="Dimension"
          options={DIMENSIONS.map((d) => ({ value: d.id, label: d.label }))}
          value={dimension}
          onChange={(v) => handleDimensionChange(v as UnitDimension)}
        />

        <Input label="Value" type="number" inputMode="decimal" value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} />

        <div className="flex items-end gap-2">
          <Dropdown
            className="flex-1"
            label="From"
            options={unitsInDimension.map((u) => ({ value: u.id, label: u.label }))}
            value={fromUnit}
            onChange={setFromUnit}
          />
          <Button variant="secondary" size="small" onClick={swap} aria-label="Swap units" className="mb-[2px]">
            <ArrowsLeftRight size={18} aria-hidden />
          </Button>
          <Dropdown
            className="flex-1"
            label="To"
            options={unitsInDimension.map((u) => ({ value: u.id, label: u.label }))}
            value={toUnit}
            onChange={setToUnit}
          />
        </div>

        {error && (
          <CalloutBox type="warning" title="Check your inputs">
            {error}
          </CalloutBox>
        )}

        {result && !error && (
          <div className="rounded-md border border-border bg-surface-raised p-5">
            <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Result</p>
            <p className="font-display text-h2 font-semibold text-olive">{result.formatted}</p>
            <p className="mt-2 font-ui text-caption text-ink-tertiary">
              {valueRaw} {fromLabel} = {result.formatted} {toLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
