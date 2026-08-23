/**
 * core/laboratory/units — Laboratory Unit Converter, Tier 1 (brief §12).
 *
 * Deliberately dimension-aware: units are grouped into dimensions
 * (mass, volume, length, temperature, concentration-by-mass,
 * molar-concentration, pressure, time, centrifugation) and conversion is
 * only ever offered between units in the *same* dimension. Mass and molar
 * concentration look numerically similar but are never silently
 * cross-converted (that would require a molecular weight, which this
 * converter does not ask for — brief §12's "do not perform scientifically
 * invalid conversions just because two units look numerically
 * convertible").
 */

export type UnitDimension =
  | 'mass'
  | 'volume'
  | 'length'
  | 'temperature'
  | 'mass-concentration'
  | 'molar-concentration'
  | 'pressure'
  | 'time'
  | 'centrifugation'

export interface UnitDef {
  id: string
  label: string
  dimension: UnitDimension
}

/**
 * Linear units (everything except temperature) are stored as a factor to
 * a base unit per dimension. Temperature needs affine conversion and is
 * handled separately in `convertTemperature`. Centrifugation (RPM ⇄ RCF)
 * is not a fixed-factor conversion at all — it depends on rotor radius —
 * so it is intentionally NOT included in `LINEAR_UNITS`; use the RCF↔RPM
 * calculator in `calculators.ts` instead. Units are listed here only for
 * display/labeling purposes in that dimension.
 */
export const UNITS: UnitDef[] = [
  // Mass (base: gram)
  { id: 'kg', label: 'kilogram (kg)', dimension: 'mass' },
  { id: 'g', label: 'gram (g)', dimension: 'mass' },
  { id: 'mg', label: 'milligram (mg)', dimension: 'mass' },
  { id: 'ug', label: 'microgram (µg)', dimension: 'mass' },
  { id: 'ng', label: 'nanogram (ng)', dimension: 'mass' },
  { id: 'pg', label: 'picogram (pg)', dimension: 'mass' },
  // Volume (base: liter)
  { id: 'L', label: 'liter (L)', dimension: 'volume' },
  { id: 'mL', label: 'milliliter (mL)', dimension: 'volume' },
  { id: 'uL', label: 'microliter (µL)', dimension: 'volume' },
  { id: 'nL', label: 'nanoliter (nL)', dimension: 'volume' },
  // Length (base: meter)
  { id: 'm', label: 'meter (m)', dimension: 'length' },
  { id: 'cm', label: 'centimeter (cm)', dimension: 'length' },
  { id: 'mm', label: 'millimeter (mm)', dimension: 'length' },
  { id: 'um', label: 'micrometer (µm)', dimension: 'length' },
  { id: 'nm', label: 'nanometer (nm)', dimension: 'length' },
  // Temperature
  { id: 'C', label: 'Celsius (°C)', dimension: 'temperature' },
  { id: 'F', label: 'Fahrenheit (°F)', dimension: 'temperature' },
  { id: 'K', label: 'Kelvin (K)', dimension: 'temperature' },
  // Mass concentration (base: g/L)
  { id: 'g/L', label: 'g/L', dimension: 'mass-concentration' },
  { id: 'mg/mL', label: 'mg/mL', dimension: 'mass-concentration' },
  { id: 'ug/mL', label: 'µg/mL', dimension: 'mass-concentration' },
  { id: 'ng/uL', label: 'ng/µL', dimension: 'mass-concentration' },
  { id: '%w/v', label: '% w/v', dimension: 'mass-concentration' },
  { id: 'ppm', label: 'ppm (mass/vol, dilute aqueous)', dimension: 'mass-concentration' },
  { id: 'ppb', label: 'ppb (mass/vol, dilute aqueous)', dimension: 'mass-concentration' },
  // Molar concentration (base: M)
  { id: 'M', label: 'molar (M)', dimension: 'molar-concentration' },
  { id: 'mM', label: 'millimolar (mM)', dimension: 'molar-concentration' },
  { id: 'uM', label: 'micromolar (µM)', dimension: 'molar-concentration' },
  { id: 'nM', label: 'nanomolar (nM)', dimension: 'molar-concentration' },
  { id: 'pM', label: 'picomolar (pM)', dimension: 'molar-concentration' },
  // Pressure (base: kPa)
  { id: 'psi', label: 'psi', dimension: 'pressure' },
  { id: 'bar', label: 'bar', dimension: 'pressure' },
  { id: 'kPa', label: 'kPa', dimension: 'pressure' },
  { id: 'atm', label: 'atm', dimension: 'pressure' },
  { id: 'mmHg', label: 'mmHg', dimension: 'pressure' },
  // Time (base: second)
  { id: 's', label: 'seconds', dimension: 'time' },
  { id: 'min', label: 'minutes', dimension: 'time' },
  { id: 'h', label: 'hours', dimension: 'time' },
  { id: 'd', label: 'days', dimension: 'time' }
]

/** Factor to convert 1 unit into the dimension's base unit. */
const TO_BASE: Record<string, number> = {
  // mass -> g
  kg: 1000, g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12,
  // volume -> L
  L: 1, mL: 1e-3, uL: 1e-6, nL: 1e-9,
  // length -> m
  m: 1, cm: 1e-2, mm: 1e-3, um: 1e-6, nm: 1e-9,
  // mass-concentration -> g/L
  'g/L': 1, 'mg/mL': 1, 'ug/mL': 1e-3, 'ng/uL': 1e-3, '%w/v': 10, ppm: 1e-3, ppb: 1e-6,
  // molar-concentration -> M
  M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12,
  // pressure -> kPa
  psi: 6.894757, bar: 100, kPa: 1, atm: 101.325, mmHg: 0.1333224,
  // time -> s
  s: 1, min: 60, h: 3600, d: 86400
}

export function getUnitsForDimension(dimension: UnitDimension): UnitDef[] {
  return UNITS.filter((u) => u.dimension === dimension)
}

export function getUnitDimension(unitId: string): UnitDimension | undefined {
  return UNITS.find((u) => u.id === unitId)?.dimension
}

export interface ConversionResult {
  value: number
  formatted: string
}

/**
 * Converts a linear (non-temperature) unit value. Throws a descriptive
 * error rather than returning a silently wrong number if the two units
 * are not in the same dimension or the unit is unrecognized — callers
 * (the Unit Converter UI) turn this into a human-readable message rather
 * than letting a NaN reach the screen (brief §24).
 */
export function convertLinear(value: number, fromUnit: string, toUnit: string): ConversionResult {
  const fromDim = getUnitDimension(fromUnit)
  const toDim = getUnitDimension(toUnit)
  if (!fromDim || !toDim) throw new Error('Unrecognized unit.')
  if (fromDim !== toDim) throw new Error(`Cannot convert between ${fromDim} and ${toDim} — they measure different things.`)
  if (fromDim === 'temperature') throw new Error('Use convertTemperature for temperature units.')
  if (!Number.isFinite(value)) throw new Error('Enter a valid number.')
  const baseValue = value * TO_BASE[fromUnit]
  const result = baseValue / TO_BASE[toUnit]
  return { value: result, formatted: formatScientific(result) }
}

/** Temperature is affine, not linear, so it is handled on its own rather than via TO_BASE factors. */
export function convertTemperature(value: number, fromUnit: 'C' | 'F' | 'K', toUnit: 'C' | 'F' | 'K'): ConversionResult {
  if (!Number.isFinite(value)) throw new Error('Enter a valid number.')
  let celsius: number
  if (fromUnit === 'C') celsius = value
  else if (fromUnit === 'F') celsius = ((value - 32) * 5) / 9
  else celsius = value - 273.15

  if (toUnit === 'K' && celsius < -273.15) throw new Error('That temperature is below absolute zero.')

  let result: number
  if (toUnit === 'C') result = celsius
  else if (toUnit === 'F') result = (celsius * 9) / 5 + 32
  else result = celsius + 273.15

  return { value: result, formatted: formatScientific(result) }
}

/** Sensible scientific notation for very large/small values (brief §11.8), plain decimal otherwise. */
export function formatScientific(value: number, sigFigs = 4): string {
  if (!Number.isFinite(value)) return 'undefined'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) {
    return value.toExponential(Math.max(0, sigFigs - 1)).replace(/e\+?(-?)(\d+)/, (_m, sign, digits) => ` × 10${sign === '-' ? '⁻' : ''}${toSuperscript(digits)}`)
  }
  return Number(value.toPrecision(sigFigs)).toString()
}

const SUPERSCRIPTS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
function toSuperscript(digits: string): string {
  return digits
    .split('')
    .map((d) => SUPERSCRIPTS[d] ?? d)
    .join('')
}
