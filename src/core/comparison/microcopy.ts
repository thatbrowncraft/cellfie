/**
 * core/comparison/microcopy — Comparison Studio's optional Gen Z
 * personality layer (brief §21).
 *
 * Same discipline as `core/laboratory/microcopy.ts`: structured data,
 * not strings hard-coded into components, and never a joke under every
 * row. Scientific content stays primary — every function here returns
 * `undefined` cleanly (falling back to a generic-but-still-optional
 * line) rather than ever forcing a placeholder onto a comparison that
 * doesn't have a bespoke line yet.
 *
 * Per-comparison lines are keyed by curated comparison id and are
 * genuinely optional — `getComparisonTagline` returns undefined for any
 * comparison (including every custom one) without a specific entry, and
 * callers simply render nothing in that case.
 */

/** Shown under the comparison title itself, when a specific one exists (brief §21 example: "Different targets. Different vibes. Same goal: finding the answer."). */
const COMPARISON_TAGLINES: Record<string, string> = {
  'comp-elisa-vs-pcr': 'Different targets. Different vibes. Same goal: finding the answer.',
  'comp-grampos-vs-gramneg': 'The cell wall has entered the chat.',
  'comp-autoclave-vs-hot-air-oven': 'Steam sprints. Dry heat marathons.',
  'comp-selective-vs-differential-media': "One's a bouncer, one's a stylist.",
  'comp-exotoxins-vs-endotoxins': 'One leaves on purpose. One only shows up when the party\u2019s over.'
}

export function getComparisonTagline(comparisonId: string): string | undefined {
  return COMPARISON_TAGLINES[comparisonId]
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
