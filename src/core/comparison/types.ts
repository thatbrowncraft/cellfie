/**
 * core/comparison/types — Comparison Studio, Tier 1 Foundation.
 *
 * Mirrors the loading/data-shape pattern already used by
 * `core/laboratory/types.ts` and `core/organisms/types.ts`: curated JSON
 * content, validated at load time, cross-linked by stable string IDs.
 *
 * Three content/source layers stay separate throughout this module,
 * matching Laboratory's Knowledge Layer brief exactly:
 *  - Layer 1 (this file + `src/content/comparisons/**`): curated Cellfie
 *    comparisons shipped with the repo. Read-only at runtime.
 *  - Layer 2 (`core/organisms/librarySources.ts`, reused as-is): the
 *    user's own Source Library (books/PDFs).
 *  - Layer 3 (`core/db`, Dexie): user-owned local data — saved/custom
 *    comparisons, notes, favorites, recent history. See
 *    `core/comparison/userComparisons.ts`.
 *
 * A `ComparisonProvenance` is attached at the aspect level (not just the
 * comparison level) so a single comparison can legitimately mix a
 * curated aspect, a My-Library-sourced aspect, and an Online-Knowledge
 * aspect without ever presenting them as one anonymous pool (brief §7).
 */

/** Every Comparison Studio domain (brief §4). Extensible — a new domain means a new value here plus a new aspect preset in domainPresets.ts, no restructuring elsewhere. */
export type ComparisonDomain =
  | 'laboratory-technique'
  | 'organism'
  | 'microbiology'
  | 'bacteriology'
  | 'virology'
  | 'mycology'
  | 'parasitology'
  | 'immunology'
  | 'molecular-biology'
  | 'diagnostics'
  | 'culture-media'
  | 'laboratory-equipment'
  | 'biosafety'
  | 'biological-structure'
  | 'scientific-concept'
  | 'custom'

export const COMPARISON_DOMAIN_LABELS: Record<ComparisonDomain, string> = {
  'laboratory-technique': 'Laboratory Technique',
  organism: 'Organisms',
  microbiology: 'Microbiology',
  bacteriology: 'Bacteriology',
  virology: 'Virology',
  mycology: 'Mycology',
  parasitology: 'Parasitology',
  immunology: 'Immunology',
  'molecular-biology': 'Molecular Biology',
  diagnostics: 'Diagnostics',
  'culture-media': 'Culture Media',
  'laboratory-equipment': 'Laboratory Equipment',
  biosafety: 'Biosafety',
  'biological-structure': 'Biological Structures',
  'scientific-concept': 'Scientific Concepts',
  custom: 'Custom / Research'
}

/** Learning-progression tier (brief §2/§22) — same flat scale Laboratory already uses for `LabDifficulty`, kept as its own type here since a comparison's difficulty is judged independently of any single item's difficulty. */
export type ComparisonDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert'

export const COMPARISON_DIFFICULTY_LABELS: Record<ComparisonDifficulty, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert / Research'
}

export const COMPARISON_DIFFICULTY_ORDER: ComparisonDifficulty[] = ['basic', 'intermediate', 'advanced', 'expert']

/** Discovery frequency tier (brief §2/§22) — independent axis from difficulty; a comparison can be basic-but-rare or expert-but-frequently-tested. */
export type ComparisonFrequency = 'common' | 'frequently-tested' | 'less-common' | 'rare' | 'specialized'

export const COMPARISON_FREQUENCY_LABELS: Record<ComparisonFrequency, string> = {
  common: 'Common',
  'frequently-tested': 'Frequently Tested',
  'less-common': 'Less Common',
  rare: 'Rare',
  specialized: 'Specialized'
}

export type ComparisonAudience = 'student' | 'lab-learner' | 'researcher'

export const COMPARISON_AUDIENCE_LABELS: Record<ComparisonAudience, string> = {
  student: 'Student',
  'lab-learner': 'Lab Learner',
  researcher: 'Researcher'
}

/**
 * One side of a comparison. `refId`/`refKind` link back to a real Cellfie
 * entity (an organism or a Laboratory content item) when the item exists
 * as curated content — used to resolve a live "Open [item]" link and to
 * power inline "Compare with…" suggestions (brief §17). Both are absent
 * for a fully custom item (brief §12B) — a custom item is never forced
 * to exist in the curated database.
 */
export interface ComparisonItemRef {
  /** Display name, e.g. "ELISA" or "Staphylococcus aureus". */
  name: string
  subtitle?: string
  refKind?: 'organism' | 'laboratory'
  /** Only set when refKind is present — the organism id or Laboratory content id. */
  refId?: string
  /** Only set when refKind is 'laboratory' — needed to build the detail route. */
  labCategory?: string
}

/** Where a single aspect's value came from — the three-layer separation applied at cell granularity (brief §7/§9). */
export type ComparisonSourceKind = 'curated' | 'my-library' | 'online-knowledge' | 'user-authored'

export interface ComparisonAspectSource {
  kind: ComparisonSourceKind
  label: string
  url?: string
  /** Set for 'my-library' sources — the book/page this value came from. */
  bookTitle?: string
  page?: number
}

/** One row of the comparison table/cards. */
export interface ComparisonAspect {
  id: string
  label: string
  valueA: string
  valueB: string
  /** Marks the make-or-break distinguishing row (brief §5/§19). */
  isKeyDifference?: boolean
  sourcesA?: ComparisonAspectSource[]
  sourcesB?: ComparisonAspectSource[]
  /**
   * The user's own annotation for this side of a *curated* aspect —
   * a personal explanation, lab observation, memory trick, or
   * correction (correction-pass brief Part 5/6). Deliberately a
   * separate field from `valueA`/`valueB`: it is layered alongside the
   * curated/source value, never replaces it. Rendered with the existing
   * `'user-authored'` provenance badge (✍️ Your note). Only meaningful
   * on curated comparisons — a fully custom/user-owned comparison just
   * edits `valueA`/`valueB` directly, since there is no underlying
   * curated value to protect.
   */
  noteA?: string
  noteB?: string
}

/** Optional learning overlays (brief §5) — every field optional and independent; absence means "not written for this comparison yet," never a blank placeholder shown in the UI. */
export interface ComparisonLearningOverlay {
  examHighYieldNote?: string
  memoryTrick?: string
  choiceRule?: string
  commonMisconception?: string
}

/** A curated comparison, shipped as JSON under `src/content/comparisons/`. */
export interface Comparison {
  id: string
  domain: ComparisonDomain
  difficulty: ComparisonDifficulty
  frequency: ComparisonFrequency
  audience: ComparisonAudience[]
  tags: string[]
  itemA: ComparisonItemRef
  itemB: ComparisonItemRef
  aspects: ComparisonAspect[]
  overlay?: ComparisonLearningOverlay
  /** Short scientifically-grounded framing line — not the Gen Z microcopy (see genZNote below), just a one-sentence "why this pair matters" summary shown at the top of the workspace. */
  overview?: string
  /**
   * Cellfie's Gen Z personality layer for this comparison (brief §22–25) —
   * short, witty, scientifically-relevant, shown under the title where the
   * UI already renders it. Mirrors `genZNote` on organism content
   * (`core/organisms/types.ts`) exactly, for the same reason: it's part of
   * the curated JSON contract, never generated dynamically by the
   * Knowledge Layer, and never mixed into `overview`/`aspects` (which stay
   * professional). Every curated comparison is expected to have one — see
   * `core/comparison/registry.ts`'s load-time check — but the field stays
   * optional in the type itself so a malformed/future file degrades to
   * "no tagline shown" rather than failing to load.
   */
  genZNote?: string
  lastVerified?: string
}

export interface ComparisonSearchHit {
  id: string
  domain: ComparisonDomain
  title: string
  subtitle?: string
  difficulty: ComparisonDifficulty
  frequency: ComparisonFrequency
}
