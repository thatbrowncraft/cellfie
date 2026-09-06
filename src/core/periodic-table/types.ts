/**
 * core/periodic-table/types — Study Vault Periodic Table feature.
 *
 * Same three-layer split as `core/laboratory/types.ts`: this file plus
 * `src/content/periodic-table/**` is Layer 1 (curated, read-only,
 * shipped with the repo). No user data (notes/saved items) lives here —
 * if that's ever wanted, it belongs in `core/db` (Layer 3), same rule
 * Laboratory already follows.
 *
 * Kept as its own registry rather than folded into `core/laboratory`
 * because element records have a materially different shape (fixed
 * periodic position, atomic data) from Laboratory's category union —
 * see brief's "do not create a second application architecture" read
 * the other way: reusing an ill-fitting shape would be the actual
 * architecture violation here.
 */

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'

export type ElementBlock = 's' | 'p' | 'd' | 'f'
export type ElementPhase = 'solid' | 'liquid' | 'gas'

export interface ElementDiscovery {
  year?: number
  discoverer?: string
}

/**
 * One element's full curated profile. Every field beyond the identity
 * block (id/atomicNumber/symbol/name/atomicMass/category/period/block)
 * is optional by design — brief §4's "do not blindly populate every
 * property with N/A" rule. UI components must treat these as
 * genuinely absent, not render an empty section.
 */
export interface ElementProfile {
  id: string
  category: 'element'
  atomicNumber: number
  symbol: string
  name: string
  atomicMass: number
  elementCategory: ElementCategory
  elementCategoryLabel: string
  /** Absent for elements conventionally shown without a group column in some table layouts — none currently, kept optional for future-proofing. */
  group?: number
  period: number
  block: ElementBlock
  phaseAtRoomTemp: ElementPhase
  electronConfiguration: string
  commonValency?: string
  commonOxidationStates?: string[]
  electronegativityPauling?: number
  density?: string
  meltingPointC?: number
  boilingPointC?: number
  discovery?: ElementDiscovery
  occurrence?: string
  majorUses?: string[]
  biologicalRelevance?: string
  safetyNotes?: string
  notableCharacteristics?: string
  ncertRelevance?: string[]
  /** "Why is this element here?" — position ↔ electron configuration ↔ behaviour, brief §15. */
  whyHere?: string
  didYouKnow?: string
  /** Unique per element — brief §11/§29. Never generic/interchangeable across elements. */
  genZNote?: string
  /** Element ids (same `element-<slug>` shape as `id`). */
  relatedElements?: string[]
  /** Verified existing Laboratory concept ids only — see registry.ts's build-time check. Never a dangling/invented id. */
  relatedCellfieConcepts?: string[]
}

export interface ElementFamily {
  id: string
  label: string
  /** Short line shown after highlighting the family — brief §8's example format. */
  description: string
  categories: ElementCategory[]
}

export interface PeriodicTrend {
  id: string
  label: string
  acrossPeriod: string
  downGroup: string
  exceptions?: string
}

export interface MnemonicEntry {
  id: string
  label: string
  /** Symbols in atomic-number order, e.g. ["H","He","Li",...]. */
  sequence: string[]
  mnemonic: string
}
