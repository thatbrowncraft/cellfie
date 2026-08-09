/**
 * core/concepts/normalize — Sprint 3 §4, deterministic normalization.
 *
 * Intentionally conservative: lowercase, trim, collapse whitespace, strip
 * a small set of trailing/leading punctuation. No stemming, no fuzzy
 * matching, no Levenshtein distance — "gram staining" / "Gram Stain" /
 * "gram  stain" resolve to the same normalized key, but "culture" and
 * "cell culture" never do. Accuracy over recall, per the brief.
 */

/** Lowercase, trim, collapse internal whitespace, strip a few edge punctuation marks. */
export function normalizeConceptName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
}

/** True once a candidate string is worth treating as a concept name at all — filters out stray punctuation-only or single-character junk. */
export function isPlausibleConceptName(raw: string): boolean {
  const normalized = normalizeConceptName(raw)
  if (normalized.length < 3 || normalized.length > 80) return false
  if (!/[a-z]/i.test(normalized)) return false
  return true
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'if', 'then', 'so', 'of', 'in', 'on', 'at', 'to',
  'for', 'with', 'as', 'by', 'from', 'this', 'that', 'these', 'those',
  'it', 'its', 'not', 'no', 'yes', 'can', 'will', 'would', 'should',
  'very', 'important', 'structure', 'chapter', 'section', 'page', 'figure',
  'table', 'introduction', 'summary', 'overview', 'notes', 'note'
])

/** True when a short string is just common English filler — used to reject junk single/two-word tag- or highlight-derived candidates. */
export function isLikelyStopwordPhrase(raw: string): boolean {
  const words = normalizeConceptName(raw).split(' ').filter(Boolean)
  if (words.length === 0) return true
  return words.every((w) => STOPWORDS.has(w))
}
