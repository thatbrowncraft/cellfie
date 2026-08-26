/**
 * core/comparison/microcopy — Comparison Studio's optional Gen Z
 * personality layer (brief §21, updated per §22–25/23A).
 *
 * Same discipline as `core/laboratory/microcopy.ts`: structured data,
 * not strings hard-coded into components, and never a joke under every
 * row. Scientific content stays primary.
 *
 * Per-comparison subtitles (§23A) now live in the curated JSON itself as
 * `Comparison.genZNote` — the same place `genZNote` already lives on
 * organism content (`core/organisms/types.ts`) — instead of the
 * previous id-keyed lookup table that used to live in this file. That
 * table only ever covered 17 of the 55 curated comparisons and lived
 * outside the content files themselves, which is exactly the
 * inconsistent-coverage problem §22 asks to fix and the "must be part
 * of the curated JSON itself" rule in §23A rules out going forward.
 * `getComparisonTagline` is kept as the stable call site every page
 * already uses; it now just reads the field straight off the curated
 * comparison via the registry instead of a second parallel table, so
 * there is exactly one place (the JSON file) that owns this content —
 * never two.
 */
import { getCuratedComparisonById } from './registry'
import type { Comparison, ComparisonDomain } from './types'

/** Shown under the comparison title itself, straight from the curated JSON's `genZNote` field. Falls back to `getFallbackTagline` when a curated file exists but the field is missing (correction-pass Part 11-17) — every curated comparison gets a subtitle automatically, whether or not a human wrote one. Returns undefined only for a route id that isn't a curated comparison at all (a custom/built comparison — see `getTaglineForComparison` for that case). */
export function getComparisonTagline(comparisonId: string): string | undefined {
  const curated = getCuratedComparisonById(comparisonId)
  if (!curated) return undefined
  return curated.genZNote?.trim() || getFallbackTagline(curated.domain, curated.id)
}

/**
 * The general-purpose entry point (correction-pass Part 11-17): works
 * for ANY comparison — curated, entity-pair-built, or fully custom —
 * not just ones with a registry id. Resolution order, matching the
 * brief's required precedence exactly:
 *   1. curated JSON's own `genZNote` field, if present (Option A);
 *   2. a deterministic, domain-aware local template (Option C) — no
 *      runtime AI call, ever (Part 13).
 * A local microcopy *registry* (Option B) was considered but skipped:
 * the curated-JSON field already covers 100% of the 55 shipped
 * comparisons, so a second id-keyed table would just be the exact
 * duplicate-source-of-truth problem the old `microcopy.ts` used to
 * have (see this file's header) — reintroduced one door down. A future
 * curated JSON that ships without `genZNote` degrades straight to the
 * domain fallback with zero extra wiring, which is the actual
 * requirement ("add a new comparison JSON, get a subtitle
 * automatically, no other file touched").
 */
export function getTaglineForComparison(comparison: Pick<Comparison, 'id' | 'domain' | 'genZNote'>): string {
  return comparison.genZNote?.trim() || getFallbackTagline(comparison.domain, comparison.id)
}

/**
 * Small, varied per-domain line banks for the deterministic fallback
 * (Part 16's style guide: short, witty, scientifically relevant, never
 * the same joke twice in a row). Picking is a stable hash of the
 * comparison's own id, not `Math.random()` — the same comparison shows
 * the same fallback line every time it's opened, the same way a
 * curated `genZNote` would.
 */
const FALLBACK_TAGLINES_BY_DOMAIN: Partial<Record<ComparisonDomain, string[]>> = {
  'laboratory-technique': ['Two methods. Very different receipts.', 'Same job, different toolbox.', 'One workflow, two very different Tuesdays.'],
  organism: ['Related, but not the same energy.', 'Cousins, not clones.'],
  microbiology: ['Small organisms, big personality differences.', 'Same field, different flex.'],
  bacteriology: ['Same stain rack, very different cell-wall energy.', 'Both bacteria. Wildly different vibes.'],
  virology: ['Small change, big plot twist.', 'Same family tree, different chaos level.'],
  mycology: ['Fungi being unnecessarily complicated, as usual.', 'Same kingdom, different attitude.'],
  parasitology: ['Different hosts, same commitment issues.', 'Two freeloaders, two very different strategies.'],
  immunology: ['Borrowed protection vs built-from-scratch immunity.', 'Same goal, different receipts for getting there.'],
  'molecular-biology': ['Same question, different machinery.', 'Same molecule, different plot armor.'],
  diagnostics: ['Two tests. Very different receipts.', 'Same question, different way of answering it.'],
  'culture-media': ['Same Petri dish energy, different guest list.', 'Both agar, very different house rules.'],
  'laboratory-equipment': ['Same job description, different toolbox.', 'Two machines, one very strong opinion each.'],
  biosafety: ['Same risk, two very different comfort levels.', 'Different rules for a reason.'],
  'biological-structure': ['Same building, different blueprint.', 'Structurally speaking, not the same at all.'],
  'scientific-concept': ['Related ideas. Please don\u2019t merge them on the exam.', 'Same neighborhood, different house.'],
  custom: ['Two things. One workspace. No mercy for vague answers.']
}

const GENERIC_FALLBACK_TAGLINES = ['Side by side, difference incoming.', 'Two things walk into a workspace...', 'Compared. Slightly less confused already.']

/** Deterministic (id-seeded, not random) pick from the domain's line bank, falling back further to a generic bank for anything not covered. */
export function getFallbackTagline(domain: ComparisonDomain, seedId: string): string {
  const bank = FALLBACK_TAGLINES_BY_DOMAIN[domain] ?? GENERIC_FALLBACK_TAGLINES
  let hash = 0
  for (let i = 0; i < seedId.length; i++) hash = (hash * 31 + seedId.charCodeAt(i)) >>> 0
  return bank[hash % bank.length]
}

/** Shown under a row marked `isKeyDifference` (brief §21 example). Generic and safe to show on any comparison's key-difference row, since it's about the *concept* of a key difference, not the content. */
export const KEY_DIFFERENCE_TAGLINE = 'If you remember only one thing, make it this.'

/** Shown in Study Mode (brief §24) while values are masked. */
export const STUDY_MODE_TAGLINE = 'Okay genius, no peeking.'

/** Shown once a comparison workspace is completed/closed out (brief §21 example). */
export const COMPLETION_TAGLINE = 'Filed. Compared. Slightly less confused.'

/** Shown on Comparison Studio's empty states — landing page with nothing saved yet, or a search with no results. */
export const EMPTY_STATE_TAGLINES = {
  noSavedComparisons: 'Nothing saved yet. Your future self during exam week is waiting.',
  noSearchResults: 'Came up empty. Try a different pair, or start a custom one.',
  noRecent: 'No comparisons opened yet — that first "vs" is right there.'
} as const

/** Shown once, briefly, the first time a user opens the aspect editor for a comparison — reinforces that this is a controlled structure, not a spreadsheet (brief §20/§34). */
export const ASPECT_EDITOR_TAGLINE = "Add what matters, skip what doesn't. No 50-row essays required."

/** A small rotating set for the "New Comparison" empty/start state, to avoid the exact same line every time. */
const NEW_COMPARISON_TAGLINES = [
  'Two things walk into a workspace...',
  'Pick your fighters.',
  'Side by side. No mercy for vague answers.'
]

export function getRandomNewComparisonTagline(): string {
  return NEW_COMPARISON_TAGLINES[Math.floor(Math.random() * NEW_COMPARISON_TAGLINES.length)]
}
