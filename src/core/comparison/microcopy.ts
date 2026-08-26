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

/** Shown under the comparison title itself, straight from the curated JSON's `genZNote` field. Returns undefined for a custom/user comparison (no curated id) or the rare curated file missing one (flagged separately at load time in registry.ts). */
export function getComparisonTagline(comparisonId: string): string | undefined {
  return getCuratedComparisonById(comparisonId)?.genZNote
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
