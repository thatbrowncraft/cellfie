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

/**
 * True when a single word is common English filler (as opposed to
 * `isLikelyStopwordPhrase`, which only rejects a phrase when *every*
 * word in it is filler). Used by free-text candidate scanning
 * (extraction.ts §4) to stop a candidate phrase from growing across a
 * word like "the"/"and"/"of", and to reject a phrase that *starts* with
 * one (e.g. "The Cell Wall") even though "cell wall" alone wouldn't be
 * caught by `isLikelyStopwordPhrase`.
 */
export function isStopwordToken(word: string): boolean {
  return STOPWORDS.has(word.trim().toLowerCase())
}
/**
 * Cleans up broken words, accidental spaces inside single words,
 * and double spacing extracted from PDF highlights.
 */
export function cleanExtractedText(text: string): string {
  if (!text) return '';
  return text
    // Remove line-break hyphens (e.g., "pro- posing" -> "proposing")
    .replace(/(\w+)-\s*\n?\s*(\w+)/g, '$1$2')
    // Fix broken single-letter gaps (e.g., "s te p s" -> "steps")
    .replace(/\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\b/g, '$1$2$3')
    // Collapse extra spaces and line breaks into clean single spaces
    .replace(/\s+/g, ' ')
    .trim();
}
