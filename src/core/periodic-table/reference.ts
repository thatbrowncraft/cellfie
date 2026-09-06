/**
 * core/periodic-table/reference — fixed reference tables (families,
 * trend guide, memory-trick sequences) for the Periodic Table feature.
 *
 * Kept as a plain TS data module rather than JSON content files,
 * matching the precedent already set by `core/laboratory/units.ts` and
 * `core/laboratory/calculators.ts`: this is fixed scientific reference
 * data with a handful of entries, not an open-ended per-item content
 * type that benefits from the glob-loaded-JSON registry pattern (brief
 * §24's "do not invent architecture merely for the sake of splitting
 * files" cuts the other way here).
 */
import type { ElementFamily, MnemonicEntry, PeriodicTrend } from './types'

export const ELEMENT_FAMILIES: ElementFamily[] = [
  {
    id: 'alkali-metals',
    label: 'Alkali Metals',
    description: 'Group 1 elements with a single loosely-held valence electron — extremely reactive, especially with water.',
    categories: ['alkali-metal']
  },
  {
    id: 'alkaline-earth-metals',
    label: 'Alkaline Earth Metals',
    description: 'Group 2 elements that lose two valence electrons to form stable +2 ions — reactive, but less so than Group 1.',
    categories: ['alkaline-earth-metal']
  },
  {
    id: 'transition-metals',
    label: 'Transition Metals',
    description: 'd-block elements with partially filled d-orbitals — variable oxidation states, coloured compounds, and common catalysts.',
    categories: ['transition-metal']
  },
  {
    id: 'post-transition-metals',
    label: 'Post-Transition Metals',
    description: 'p-block metals with filled d-orbitals — generally softer and lower-melting than true transition metals.',
    categories: ['post-transition-metal']
  },
  {
    id: 'metalloids',
    label: 'Metalloids',
    description: 'Elements straddling the metal/nonmetal line — semiconducting behaviour is their defining trait.',
    categories: ['metalloid']
  },
  {
    id: 'nonmetals',
    label: 'Reactive Nonmetals',
    description: 'p-block and s-block nonmetals essential to organic chemistry and biology.',
    categories: ['nonmetal']
  },
  {
    id: 'halogens',
    label: 'Halogens',
    description: 'These elements occupy Group 17 and commonly form -1 oxidation states — one electron short of a stable octet.',
    categories: ['halogen']
  },
  {
    id: 'noble-gases',
    label: 'Noble Gases',
    description: 'Group 18 elements with a complete valence shell — famously unreactive, though a few form compounds under extreme conditions.',
    categories: ['noble-gas']
  },
  {
    id: 'lanthanides',
    label: 'Lanthanides',
    description: 'The first f-block row (period 6) — filling 4f orbitals, chemically similar to each other, mostly +3 ions.',
    categories: ['lanthanide']
  },
  {
    id: 'actinides',
    label: 'Actinides',
    description: 'The second f-block row (period 7) — filling 5f orbitals, largely radioactive and synthetic beyond uranium.',
    categories: ['actinide']
  }
]

export const PERIODIC_TRENDS: PeriodicTrend[] = [
  {
    id: 'atomic-radius',
    label: 'Atomic Radius',
    acrossPeriod: 'Decreases left to right — increasing nuclear charge pulls the same outer shell in tighter.',
    downGroup: 'Increases top to bottom — each row adds a new outer shell farther from the nucleus.',
    exceptions: 'Noble gases are sometimes measured differently (van der Waals radius) since they rarely bond, which can make period-end comparisons look inconsistent.'
  },
  {
    id: 'ionic-radius',
    label: 'Ionic Radius',
    acrossPeriod: 'Cations are smaller than their parent atom; anions are larger — both trends still shrink left to right within the same charge type.',
    downGroup: 'Increases top to bottom, same reasoning as atomic radius — more filled shells.',
    exceptions: 'Lanthanide contraction: the 4f electrons in period 6 shield the nucleus poorly, so period-6 d-block ions end up almost the same size as their period-5 counterparts instead of noticeably larger.'
  },
  {
    id: 'ionization-enthalpy',
    label: 'Ionization Enthalpy',
    acrossPeriod: 'Generally increases left to right — a smaller atom with more nuclear charge holds its electrons tighter.',
    downGroup: 'Decreases top to bottom — outer electrons sit farther away and are more shielded, so they come off more easily.',
    exceptions: 'Group 2 > Group 13 (e.g. Be > B) because of a stable filled s-subshell, and Group 15 > Group 16 (e.g. N > O) because of a stable half-filled p-subshell.'
  },
  {
    id: 'electron-gain-enthalpy',
    label: 'Electron Gain Enthalpy',
    acrossPeriod: 'Generally becomes more negative (more favourable) left to right, peaking near the halogens.',
    downGroup: 'Generally becomes less negative top to bottom, though fluorine is a notable exception.',
    exceptions: 'Fluorine\'s electron gain enthalpy is less negative than chlorine\'s — fluorine\'s very small size means the incoming electron faces unusually strong repulsion from its already-tight electron cloud.'
  },
  {
    id: 'electronegativity',
    label: 'Electronegativity',
    acrossPeriod: 'Increases left to right — smaller atoms with higher nuclear charge pull bonding electrons harder.',
    downGroup: 'Decreases top to bottom — bonding electrons sit farther from the nucleus and are more shielded.',
    exceptions: 'Noble gases are usually excluded entirely since they rarely form bonds to measure.'
  },
  {
    id: 'metallic-character',
    label: 'Metallic Character',
    acrossPeriod: 'Decreases left to right, as elements hold their valence electrons more tightly instead of losing them easily.',
    downGroup: 'Increases top to bottom — easier electron loss lower in a group.',
    exceptions: 'The metal/nonmetal boundary (the metalloid staircase) is genuinely fuzzy, not a sharp line — several elements near it show mixed behaviour.'
  }
]

/**
 * Memory aids — brief §12. Deliberately limited to sequences that
 * genuinely help (first 20 elements, halogens, noble gases) rather
 * than a forced mnemonic for every possible run of symbols.
 */
export const MNEMONICS: MnemonicEntry[] = [
  {
    id: 'first-10',
    label: 'First 10 Elements',
    sequence: ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    mnemonic: 'Happy Henry Likes Beer But Could Not Obtain Food, Nuts.'
  },
  {
    id: 'elements-11-20',
    label: 'Elements 11–20',
    sequence: ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'],
    mnemonic: 'Naughty Magpies Always Sing Perfect Songs, Clara Always Kicks Cats.'
  },
  {
    id: 'halogens',
    label: 'Halogens (Group 17)',
    sequence: ['F', 'Cl', 'Br', 'I', 'At', 'Ts'],
    mnemonic: 'Fluorine Chlorine Brings Iodine Atoms Together.'
  },
  {
    id: 'noble-gases',
    label: 'Noble Gases (Group 18)',
    sequence: ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'],
    mnemonic: 'Heavy Nervous Argonauts Krave Xenophobic Radon, Obviously.'
  },
  {
    id: 'alkali-metals',
    label: 'Alkali Metals (Group 1)',
    sequence: ['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'],
    mnemonic: 'Little Sodium Kicks Rubidium\'s Caesium Friend.'
  }
]

export const QUICK_MODES = [
  { id: 'family', label: 'Explore by Family' },
  { id: 'block', label: 'Explore by Block' },
  { id: 'period', label: 'Explore by Period' },
  { id: 'atomic-number', label: 'Explore by Atomic Number' },
  { id: 'metal-nonmetal', label: 'Metals vs Nonmetals' },
  { id: 'ncert', label: 'NCERT Important' }
] as const
