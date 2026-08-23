/**
 * core/laboratory/calculators — Laboratory Calculator Hub, Tier 1 (brief §11).
 *
 * Every calculator here is a pure function: validated inputs in, a
 * `CalculatorOutcome` out. No calculator throws a raw JS error into the
 * UI (brief §24) — invalid input becomes a `CalculatorError` with a
 * human-readable `message`, which the calling page renders directly.
 *
 * Each successful outcome carries `formula` (symbolic), `substitution`
 * (the actual numbers plugged in), `result` (formatted), and
 * `interpretation` — matching the Calculator Result UX in brief §25.
 *
 * Per brief §11.1/§11.2: colony-countability guidance (e.g. the commonly
 * cited 30–300 range) is never hardcoded as a universal rule. Where shown,
 * it is attached as a method-dependent note, not baked into validation
 * logic that would reject a result outside that range.
 */
import { formatScientific } from './units'

export class CalculatorError extends Error {}

export interface CalculatorOutcome {
  formula: string
  substitution: string
  result: string
  interpretation: string
  warnings?: string[]
}

function requireFinite(value: number, fieldLabel: string): void {
  if (value === undefined || value === null || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new CalculatorError(`${fieldLabel} must be a valid number.`)
  }
}

function requirePositive(value: number, fieldLabel: string): void {
  requireFinite(value, fieldLabel)
  if (value <= 0) throw new CalculatorError(`${fieldLabel} must be greater than zero.`)
}

function requireNonNegative(value: number, fieldLabel: string): void {
  requireFinite(value, fieldLabel)
  if (value < 0) throw new CalculatorError(`${fieldLabel} cannot be negative.`)
}

// ---------------------------------------------------------------------------
// 1. CFU/mL Calculator (brief §11.1)
// ---------------------------------------------------------------------------

export interface CfuMlInput {
  colonyCount: number
  volumePlatedMl: number
  dilutionFactor: number
}

export function calculateCfuPerMl({ colonyCount, volumePlatedMl, dilutionFactor }: CfuMlInput): CalculatorOutcome {
  requireNonNegative(colonyCount, 'Colony count')
  requirePositive(volumePlatedMl, 'Volume plated')
  requirePositive(dilutionFactor, 'Dilution factor')

  const cfuPerMl = colonyCount / (volumePlatedMl * dilutionFactor)
  const warnings: string[] = []
  if (colonyCount < 30 || colonyCount > 300) {
    warnings.push(
      'This colony count falls outside the commonly cited 30–300 countable range used by some standard methods (e.g. FDA BAM). That range is method-specific, not a universal law — check the countability criteria for the method/reference you are following before treating this plate as valid.'
    )
  }

  return {
    formula: 'CFU/mL = N / (Vplated × D)',
    substitution: `${colonyCount} / (${volumePlatedMl} mL × ${dilutionFactor})`,
    result: `${formatScientific(cfuPerMl)} CFU/mL`,
    interpretation: `The estimated viable colony-forming unit concentration in the original (undiluted) sample is approximately ${formatScientific(cfuPerMl)} CFU/mL, based on ${colonyCount} colonies counted on a plate receiving ${volumePlatedMl} mL of a ${dilutionFactor === 1 ? 'undiluted sample' : `1:${Math.round(1 / dilutionFactor)} dilution`}.`,
    warnings: warnings.length ? warnings : undefined
  }
}

// ---------------------------------------------------------------------------
// 2. CFU/g Calculator (brief §11.2) — includes the initial
// homogenization/resuspension factor, which the brief specifically warns
// not to oversimplify away.
// ---------------------------------------------------------------------------

export interface CfuGInput {
  colonyCount: number
  volumePlatedMl: number
  plateDilutionFactor: number
  sampleMassG: number
  diluentVolumeMl: number
}

export function calculateCfuPerGram({ colonyCount, volumePlatedMl, plateDilutionFactor, sampleMassG, diluentVolumeMl }: CfuGInput): CalculatorOutcome {
  requireNonNegative(colonyCount, 'Colony count')
  requirePositive(volumePlatedMl, 'Volume plated')
  requirePositive(plateDilutionFactor, 'Plate dilution factor')
  requirePositive(sampleMassG, 'Sample mass')
  requirePositive(diluentVolumeMl, 'Homogenization diluent volume')

  // The initial homogenization step (e.g. 10 g sample into 90 mL diluent)
  // is itself a dilution and must be folded in — this is the step the
  // brief warns against oversimplifying away.
  const totalHomogenateMl = sampleMassG + diluentVolumeMl
  const homogenizationFactor = sampleMassG / totalHomogenateMl
  const effectiveDilution = homogenizationFactor * plateDilutionFactor
  const cfuPerGram = colonyCount / (volumePlatedMl * effectiveDilution)

  const warnings: string[] = []
  if (colonyCount < 30 || colonyCount > 300) {
    warnings.push('This colony count falls outside the commonly cited 30–300 countable range used by some standard methods — that range is method-specific. Verify against the method you are following.')
  }

  return {
    formula: 'CFU/g = N / (Vplated × Dhomogenization × Dplate), where Dhomogenization = mass / (mass + diluent volume)',
    substitution: `${colonyCount} / (${volumePlatedMl} mL × [${sampleMassG} g / (${sampleMassG} g + ${diluentVolumeMl} mL)] × ${plateDilutionFactor})`,
    result: `${formatScientific(cfuPerGram)} CFU/g`,
    interpretation: `The estimated viable concentration in the original solid/semi-solid sample is approximately ${formatScientific(cfuPerGram)} CFU/g. This accounts for the initial homogenization (${sampleMassG} g into ${diluentVolumeMl} mL diluent) as its own dilution step, in addition to the ${plateDilutionFactor === 1 ? 'undiluted homogenate plated directly' : `subsequent 1:${Math.round(1 / plateDilutionFactor)} serial dilution`}.`,
    warnings: warnings.length ? warnings : undefined
  }
}

// ---------------------------------------------------------------------------
// 3. Dilution Factor Calculator (brief §11.3)
// ---------------------------------------------------------------------------

export interface DilutionFactorInput {
  sampleVolume: number
  diluentVolume: number
}

export function calculateDilutionFactor({ sampleVolume, diluentVolume }: DilutionFactorInput): CalculatorOutcome {
  requirePositive(sampleVolume, 'Sample volume')
  requireNonNegative(diluentVolume, 'Diluent volume')

  const finalVolume = sampleVolume + diluentVolume
  const dilutionFactor = sampleVolume / finalVolume
  const notationDenominator = finalVolume / sampleVolume

  return {
    formula: 'Dilution factor = Vsample / (Vsample + Vdiluent) = Vsample / Vfinal',
    substitution: `${sampleVolume} / (${sampleVolume} + ${diluentVolume})`,
    result: `1:${formatScientific(notationDenominator)} (dilution factor = ${formatScientific(dilutionFactor)})`,
    interpretation: `Combining ${sampleVolume} volume-units of sample with ${diluentVolume} volume-units of diluent gives a final volume of ${finalVolume}, i.e. a 1:${formatScientific(notationDenominator)} dilution. For a serial dilution, multiply each step's dilution factor together to get the cumulative dilution.`
  }
}

export interface SerialDilutionInput {
  /** Dilution factor of each individual step, e.g. 0.1 for a 1:10 step. */
  stepFactors: number[]
}

export function calculateCumulativeDilution({ stepFactors }: SerialDilutionInput): CalculatorOutcome {
  if (stepFactors.length === 0) throw new CalculatorError('Enter at least one dilution step.')
  stepFactors.forEach((f, i) => requirePositive(f, `Step ${i + 1} dilution factor`))
  const cumulative = stepFactors.reduce((acc, f) => acc * f, 1)
  const notation = stepFactors.map((f) => `1:${formatScientific(1 / f)}`).join(' × ')

  return {
    formula: 'Cumulative dilution = D₁ × D₂ × ... × Dₙ',
    substitution: notation,
    result: `1:${formatScientific(1 / cumulative)} (cumulative factor = ${formatScientific(cumulative)})`,
    interpretation: `Across ${stepFactors.length} serial dilution step${stepFactors.length > 1 ? 's' : ''}, the cumulative dilution factor is ${formatScientific(cumulative)}, equivalent to a 1:${formatScientific(1 / cumulative)} overall dilution.`
  }
}

// ---------------------------------------------------------------------------
// 4. C1V1 = C2V2 Calculator (brief §11.4) — solves for whichever variable
// is left blank. Units are accepted as strings for display purposes only;
// this calculator assumes the caller has already ensured C1/C2 share the
// same concentration unit and V1/V2 share the same volume unit (brief's
// "do not blindly assume every concentration unit can be mixed" — the UI
// is responsible for surfacing a unit mismatch before calling this).
// ---------------------------------------------------------------------------

export type C1V1Solve = 'c1' | 'v1' | 'c2' | 'v2'

export interface C1V1Input {
  solveFor: C1V1Solve
  c1?: number
  v1?: number
  c2?: number
  v2?: number
  concentrationUnit: string
  volumeUnit: string
}

export function solveC1V1({ solveFor, c1, v1, c2, v2, concentrationUnit, volumeUnit }: C1V1Input): CalculatorOutcome {
  const values = { c1, v1, c2, v2 }
  for (const key of ['c1', 'v1', 'c2', 'v2'] as const) {
    if (key === solveFor) continue
    const val = values[key]
    if (val === undefined) throw new CalculatorError(`Enter a value for ${key.toUpperCase()}.`)
    requirePositive(val, key.toUpperCase())
  }

  let resultValue: number
  let resultUnit: string
  let resultLabel: string

  if (solveFor === 'c1') {
    resultValue = (c2! * v2!) / v1!
    resultUnit = concentrationUnit
    resultLabel = 'C₁'
  } else if (solveFor === 'v1') {
    resultValue = (c2! * v2!) / c1!
    resultUnit = volumeUnit
    resultLabel = 'V₁'
  } else if (solveFor === 'c2') {
    resultValue = (c1! * v1!) / v2!
    resultUnit = concentrationUnit
    resultLabel = 'C₂'
  } else {
    resultValue = (c1! * v1!) / c2!
    resultUnit = volumeUnit
    resultLabel = 'V₂'
  }

  return {
    formula: 'C₁V₁ = C₂V₂',
    substitution: `Solving for ${resultLabel}: ${resultLabel} = (${solveFor === 'c1' ? `${c2}×${v2} / ${v1}` : solveFor === 'v1' ? `${c2}×${v2} / ${c1}` : solveFor === 'c2' ? `${c1}×${v1} / ${v2}` : `${c1}×${v1} / ${c2}`})`,
    result: `${resultLabel} = ${formatScientific(resultValue)} ${resultUnit}`,
    interpretation: `To prepare this dilution, ${resultLabel} = ${formatScientific(resultValue)} ${resultUnit}. Confirm both concentration inputs (C₁, C₂) use unit "${concentrationUnit}" and both volume inputs (V₁, V₂) use unit "${volumeUnit}" — this formula does not convert between different concentration or volume units for you.`
  }
}

// ---------------------------------------------------------------------------
// 5. Molarity / Mass Preparation Calculator (brief §11.5)
// ---------------------------------------------------------------------------

export interface MolarityMassInput {
  targetMolarityM: number
  finalVolumeL: number
  molecularWeightGPerMol: number
}

export function calculateRequiredMass({ targetMolarityM, finalVolumeL, molecularWeightGPerMol }: MolarityMassInput): CalculatorOutcome {
  requirePositive(targetMolarityM, 'Target molarity')
  requirePositive(finalVolumeL, 'Final volume')
  requirePositive(molecularWeightGPerMol, 'Molecular weight')

  const massG = targetMolarityM * finalVolumeL * molecularWeightGPerMol

  return {
    formula: 'mass (g) = Molarity (mol/L) × Volume (L) × Molecular weight (g/mol)',
    substitution: `${targetMolarityM} mol/L × ${finalVolumeL} L × ${molecularWeightGPerMol} g/mol`,
    result: `${formatScientific(massG)} g`,
    interpretation: `Dissolving ${formatScientific(massG)} g of solute (MW ${molecularWeightGPerMol} g/mol) into a final volume of ${finalVolumeL} L gives a ${targetMolarityM} M solution. This does not correct for reagent purity (%) or hydration state (e.g. a monohydrate salt) — if your reagent label specifies either, adjust the required mass accordingly before weighing.`
  }
}

// ---------------------------------------------------------------------------
// 6. RCF ⇄ RPM Calculator (brief §11.6) — rotor-radius dependent, so no
// equipment-specific RPM limit is ever assumed or enforced here.
// ---------------------------------------------------------------------------

export interface RcfFromRpmInput {
  rpm: number
  rotorRadiusCm: number
}

export function calculateRcfFromRpm({ rpm, rotorRadiusCm }: RcfFromRpmInput): CalculatorOutcome {
  requirePositive(rpm, 'RPM')
  requirePositive(rotorRadiusCm, 'Rotor radius')

  const rcf = 1.118e-5 * rotorRadiusCm * rpm * rpm

  return {
    formula: 'RCF (×g) = 1.118 × 10⁻⁵ × r (cm) × RPM²',
    substitution: `1.118 × 10⁻⁵ × ${rotorRadiusCm} × ${rpm}²`,
    result: `${formatScientific(rcf)} × g`,
    interpretation: `At ${rpm} RPM with a rotor radius of ${rotorRadiusCm} cm, the relative centrifugal force is approximately ${formatScientific(rcf)} × g. "Rotor radius" must be measured the way your centrifuge's manual specifies it (commonly the distance from the spindle center to the bottom of the tube) — mixing radius conventions changes the answer. No equipment-specific maximum RPM is assumed here; check your rotor's rated limit separately.`
  }
}

export interface RpmFromRcfInput {
  rcf: number
  rotorRadiusCm: number
}

export function calculateRpmFromRcf({ rcf, rotorRadiusCm }: RpmFromRcfInput): CalculatorOutcome {
  requirePositive(rcf, 'RCF')
  requirePositive(rotorRadiusCm, 'Rotor radius')

  const rpm = Math.sqrt(rcf / (1.118e-5 * rotorRadiusCm))

  return {
    formula: 'RPM = √(RCF / (1.118 × 10⁻⁵ × r (cm)))',
    substitution: `√(${rcf} / (1.118 × 10⁻⁵ × ${rotorRadiusCm}))`,
    result: `${formatScientific(rpm)} RPM`,
    interpretation: `To achieve ${rcf} × g with a rotor radius of ${rotorRadiusCm} cm, spin at approximately ${formatScientific(rpm)} RPM. Verify this does not exceed your specific rotor's rated maximum speed — that limit is equipment-specific and is not assumed by this calculator.`
  }
}

// ---------------------------------------------------------------------------
// 7. Basic Statistics Calculator (brief §11.7)
// ---------------------------------------------------------------------------

export interface StatisticsInput {
  values: number[]
  /** Sample (n−1 denominator) vs population (n denominator) standard deviation — the brief explicitly calls out distinguishing these. */
  mode: 'sample' | 'population'
}

export interface StatisticsResult extends CalculatorOutcome {
  mean: number
  standardDeviation: number
  coefficientOfVariationPercent: number
}

export function calculateStatistics({ values, mode }: StatisticsInput): StatisticsResult {
  if (values.length === 0) throw new CalculatorError('Enter at least one value.')
  values.forEach((v, i) => requireFinite(v, `Value ${i + 1}`))
  if (mode === 'sample' && values.length < 2) {
    throw new CalculatorError('Sample standard deviation needs at least 2 values (n − 1 denominator).')
  }

  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const sumSquaredDiffs = values.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  const denominator = mode === 'sample' ? n - 1 : n
  const variance = sumSquaredDiffs / denominator
  const sd = Math.sqrt(variance)
  const cv = mean !== 0 ? (sd / Math.abs(mean)) * 100 : NaN

  return {
    mean,
    standardDeviation: sd,
    coefficientOfVariationPercent: cv,
    formula: `Mean = Σx / n;  SD (${mode}) = √(Σ(x − mean)² / ${mode === 'sample' ? '(n − 1)' : 'n'});  CV% = (SD / mean) × 100`,
    substitution: `n = ${n}, Σx = ${formatScientific(values.reduce((a, b) => a + b, 0))}`,
    result: `Mean = ${formatScientific(mean)}, SD = ${formatScientific(sd)}, CV = ${Number.isFinite(cv) ? `${formatScientific(cv)}%` : 'undefined (mean = 0)'}`,
    interpretation: `Across ${n} value${n > 1 ? 's' : ''}, the mean is ${formatScientific(mean)} with a ${mode} standard deviation of ${formatScientific(sd)} (CV ${Number.isFinite(cv) ? `${formatScientific(cv)}%` : 'undefined'}). Lower CV indicates tighter relative spread around the mean.`
  }
}

// ---------------------------------------------------------------------------
// 8. Beer-Lambert / Concentration-from-Absorbance Calculator
// ---------------------------------------------------------------------------

export interface BeerLambertInput {
  absorbance: number
  molarAbsorptivity: number
  pathLengthCm: number
}

export function calculateConcentrationFromAbsorbance({ absorbance, molarAbsorptivity, pathLengthCm }: BeerLambertInput): CalculatorOutcome {
  requireNonNegative(absorbance, 'Absorbance')
  requirePositive(molarAbsorptivity, 'Molar absorptivity')
  requirePositive(pathLengthCm, 'Path length')

  const concentrationMolar = absorbance / (molarAbsorptivity * pathLengthCm)
  const warnings: string[] = []
  if (absorbance > 1.5) {
    warnings.push(
      'This absorbance is quite high — most spectrophotometers stop behaving linearly well before A = 2. Consider diluting the sample and re-measuring rather than trusting a reading this high at face value.'
    )
  }

  return {
    formula: 'c = A / (ε × l)',
    substitution: `${absorbance} / (${molarAbsorptivity} × ${pathLengthCm})`,
    result: `${formatScientific(concentrationMolar)} mol/L`,
    interpretation: `At an absorbance of ${absorbance} with molar absorptivity ${formatScientific(molarAbsorptivity)} L·mol⁻¹·cm⁻¹ and a ${pathLengthCm} cm path length, the estimated concentration is ${formatScientific(concentrationMolar)} mol/L. This is only valid within the instrument's linear absorbance range and assumes ε is correct for this exact substance, solvent, and wavelength.`,
    warnings: warnings.length ? warnings : undefined
  }
}

// ---------------------------------------------------------------------------
// Calculator registry — metadata for the Calculator Hub listing/cards.
// Stable IDs match the brief's §14 naming convention (calc-*).
// ---------------------------------------------------------------------------

export interface CalculatorMeta {
  id: string
  title: string
  shortDescription: string
  relatedFormulas: string[]
  relatedProtocols: string[]
}

export const CALCULATORS: CalculatorMeta[] = [
  { id: 'calc-cfu-ml', title: 'CFU/mL Calculator', shortDescription: 'Viable colony count per mL from a plated dilution.', relatedFormulas: ['formula-cfu-ml'], relatedProtocols: ['proto-serial-dilution', 'proto-spread-plate'] },
  { id: 'calc-cfu-g', title: 'CFU/g Calculator', shortDescription: 'Viable colony count per gram, including homogenization.', relatedFormulas: ['formula-cfu-g'], relatedProtocols: ['proto-serial-dilution'] },
  { id: 'calc-dilution-factor', title: 'Dilution Factor Calculator', shortDescription: 'Individual and cumulative serial dilution factors.', relatedFormulas: ['formula-dilution-factor'], relatedProtocols: ['proto-serial-dilution'] },
  { id: 'calc-c1v1', title: 'C₁V₁ = C₂V₂ Calculator', shortDescription: 'Solve for any one variable in a dilution equation.', relatedFormulas: ['formula-c1v1'], relatedProtocols: [] },
  { id: 'calc-molarity-mass', title: 'Molarity / Mass Prep Calculator', shortDescription: 'Required solute mass for a target molarity.', relatedFormulas: ['formula-molarity'], relatedProtocols: [] },
  { id: 'calc-rcf-rpm', title: 'RCF ⇄ RPM Calculator', shortDescription: 'Convert between centrifuge speed and relative centrifugal force.', relatedFormulas: ['formula-rcf-rpm'], relatedProtocols: [] },
  { id: 'calc-statistics', title: 'Basic Statistics Calculator', shortDescription: 'Mean, standard deviation, and coefficient of variation.', relatedFormulas: ['formula-mean', 'formula-standard-deviation', 'formula-cv'], relatedProtocols: [] },
  { id: 'calc-beer-lambert', title: 'Beer-Lambert Concentration Calculator', shortDescription: 'Solve for concentration from an absorbance reading.', relatedFormulas: ['formula-beer-lambert'], relatedProtocols: [] }
]

export function getCalculatorMeta(id: string): CalculatorMeta | undefined {
  return CALCULATORS.find((c) => c.id === id)
}
