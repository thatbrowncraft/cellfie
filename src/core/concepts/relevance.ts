/**
 * core/concepts/relevance — deterministic relevance scoring for a
 * concept's local (book/PDF) source pages.
 *
 * The bug this exists to fix: source linking used to be pure keyword
 * presence — "the term appears somewhere on this page" was treated as
 * equally strong evidence whether that page was a real explanation or a
 * table of contents line like "Structure of DNA and RNA 355". This module
 * scores a page against a term using only shape/structure signals (no AI,
 * no network, no semantic understanding) so that:
 *
 *   - a TOC/index/bibliography page can never outrank a page that
 *     actually discusses the concept in prose
 *   - a single incidental mention scores lower than a page with several
 *     occurrences inside real sentences
 *   - the excerpt shown to the user is pulled from the strongest
 *     occurrence, trimmed to sentence boundaries, not "first match ± 120
 *     chars"
 *
 * Every signal here is cheap, explainable, and computed from the page
 * text Cellfie has already extracted — nothing is invented and nothing
 * calls out to the network.
 */

export type RelevanceTier = 'high' | 'relevant' | 'weak' | 'reject'

export interface PageRelevance {
  tier: RelevanceTier
  score: number
  occurrences: number
  /** Character index of the strongest occurrence, or -1 if the term wasn't found. */
  bestIndex: number
}

const PAGE_NUMBER_TOKEN_RE = /\b\d{1,4}\b/g
const SENTENCE_BOUNDARY_RE = /[.!?]\s+[A-Z]/g
const CITATION_YEAR_RE = /\(\d{4}[a-z]?\)/g
const ET_AL_RE = /\bet al\.?/gi

function tokenizeWords(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
}

interface PageSignals {
  isTocLike: boolean
  isBibliographyLike: boolean
  /** Concept 2.0 §12 — a page with almost no real text (a mostly-blank
   *  page, a plate/figure page with a caption, a half-scanned page) is
   *  "only a fragment": even a real term appearing on it isn't backed by
   *  an actual discussion, so it shouldn't count as strong evidence. */
  isFragmentLike: boolean
}

const FRAGMENT_WORD_THRESHOLD = 15

/**
 * Table-of-contents and index pages have a very distinctive shape once
 * text is joined into one line (Cellfie's PDF text extraction collapses
 * newlines to spaces): a long run of short entries each immediately
 * followed by a 1-4 digit number, repeated many times across the page.
 * Real prose almost never produces that density of bare numbers.
 * Bibliography/reference pages have their own tell: repeated "(2019)"
 * style citation years or "et al." Both get flagged at the page level so
 * a page that's structurally a TOC/index/reference list can't become a
 * concept's source no matter how the term happens to sit on it.
 */
function computePageSignals(pageText: string): PageSignals {
  const numberMatches = pageText.match(PAGE_NUMBER_TOKEN_RE) ?? []
  const words = tokenizeWords(pageText)
  const numberDensity = numberMatches.length / Math.max(words.length, 1)
  const citationYears = (pageText.match(CITATION_YEAR_RE) ?? []).length
  const etAl = (pageText.match(ET_AL_RE) ?? []).length
  return {
    isTocLike: numberMatches.length >= 6 && numberDensity > 0.05,
    isBibliographyLike: citationYears >= 3 || etAl >= 2,
    isFragmentLike: words.length < FRAGMENT_WORD_THRESHOLD
  }
}

function findOccurrenceIndices(pageText: string, term: string): number[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  const lower = pageText.toLowerCase()
  const indices: number[] = []
  let from = 0
  for (;;) {
    const idx = lower.indexOf(needle, from)
    if (idx === -1) break
    indices.push(idx)
    from = idx + needle.length
  }
  return indices
}

/**
 * Scores one occurrence by what surrounds it: a window of real prose
 * (sentence boundaries, enough words) scores well; a window dominated by
 * bare numbers (the shape of a TOC/index line) or too short to be a real
 * discussion scores poorly.
 */
function scoreOccurrence(pageText: string, index: number, term: string): number {
  const start = Math.max(0, index - 100)
  const end = Math.min(pageText.length, index + term.length + 150)
  const window = pageText.slice(start, end)
  const windowWords = tokenizeWords(window)
  const windowNumbers = window.match(PAGE_NUMBER_TOKEN_RE) ?? []
  const windowNumberDensity = windowNumbers.length / Math.max(windowWords.length, 1)
  const sentenceBoundaries = (window.match(SENTENCE_BOUNDARY_RE) ?? []).length

  let score = 2 // the occurrence itself is worth something
  score += Math.min(sentenceBoundaries * 2, 6)
  if (windowNumberDensity > 0.15) score -= 6
  if (windowWords.length < 8) score -= 3

  return score
}

/**
 * Scores a page against a concept term. Strong evidence (heading
 * position handled by the caller via `sourceText`, repeated occurrences,
 * real sentences around the term) pushes the tier up; TOC/index/
 * bibliography shape and isolated one-word hits push it to `reject`.
 */
export function scorePageRelevance(pageText: string, term: string): PageRelevance {
  const indices = findOccurrenceIndices(pageText, term)
  if (indices.length === 0) {
    return { tier: 'reject', score: Number.NEGATIVE_INFINITY, occurrences: 0, bestIndex: -1 }
  }

  const signals = computePageSignals(pageText)

  let bestScore = Number.NEGATIVE_INFINITY
  let bestIndex = indices[0]
  for (const idx of indices) {
    const s = scoreOccurrence(pageText, idx, term)
    if (s > bestScore) {
      bestScore = s
      bestIndex = idx
    }
  }

  let total = bestScore
  if (indices.length >= 3) total += 3
  else if (indices.length === 2) total += 1
  if (signals.isTocLike) total -= 10
  if (signals.isBibliographyLike) total -= 8
  if (signals.isFragmentLike) total -= 4

  let tier: RelevanceTier
  if (total >= 8) tier = 'high'
  else if (total >= 4) tier = 'relevant'
  else if (total >= 0) tier = 'weak'
  else tier = 'reject'

  // Safety net: a page that's structurally a TOC/index can only ever be
  // "reject" unless the term shows up several separate times on it (the
  // shape a real recurring reference, not a single listing line, takes).
  if (signals.isTocLike && indices.length <= 2) tier = 'reject'

  return { tier, score: total, occurrences: indices.length, bestIndex }
}

/**
 * Expands outward from the strongest occurrence to the nearest sentence
 * boundaries (instead of a fixed character window), so the excerpt reads
 * as coherent prose rather than a mid-sentence fragment.
 */
export function extractCoherentExcerpt(pageText: string, index: number, term: string): string {
  const roughStart = Math.max(0, index - 220)
  const roughEnd = Math.min(pageText.length, index + term.length + 220)

  let start = roughStart
  const leading = pageText.slice(roughStart, index)
  const lastBreak = leading.lastIndexOf('. ')
  if (lastBreak !== -1) start = roughStart + lastBreak + 2

  let end = roughEnd
  const trailing = pageText.slice(index + term.length, roughEnd)
  const nextBreak = trailing.indexOf('. ')
  if (nextBreak !== -1) end = index + term.length + nextBreak + 1

  const prefix = start > 0 ? '…' : ''
  const suffix = end < pageText.length ? '…' : ''
  return `${prefix}${pageText.slice(start, end).trim()}${suffix}`
}

/**
 * Retrieval Correction §1/§2 — true when a detected heading IS the
 * concept's own heading (the source book itself titled a section with
 * this concept's name or alias), as opposed to the concept merely being
 * mentioned somewhere on a page that also happens to have some other
 * heading on it. This is the strongest possible relevance signal
 * available (the source labeled the section itself), stronger than any
 * body-text occurrence count, and it never needs to guess.
 */
export function headingMatchesTerm(heading: string, terms: string[]): boolean {
  const key = heading.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return false
  return terms.some((term) => {
    const t = term.trim().toLowerCase()
    if (t.length < 3) return false
    if (key === t) return true
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`)
    return re.test(key)
  })
}

/**
 * Retrieval Correction §5 — cheap, deterministic detection of a PDF text
 * layer that's come apart into single-letter/short fragments (an old
 * scanned book's noisy OCR text layer producing "G i e m s a s t a i n"
 * instead of "Giemsa stain"). Shape-only, same spirit as the other
 * signals in this file: no dictionary, no OCR, just "does this look like
 * real running prose or a pile of 1-2 letter fragments." Purely a
 * ranking/display signal — it never rewrites or discards the extracted
 * text, it only lets a caller prefer a cleaner source when one exists and
 * say so honestly when none does.
 */
export function detectExtractionQuality(pageText: string): 'ok' | 'garbled' {
  const tokens = pageText.match(/[A-Za-z]+/g) ?? []
  if (tokens.length < 20) return 'ok' // too little text either way to call it garbled
  const shortTokenCount = tokens.filter((t) => t.length <= 2).length
  return shortTokenCount / tokens.length > 0.35 ? 'garbled' : 'ok'
}

export interface ScoredExcerpt {
  text: string
  relevance: PageRelevance
}

/**
 * The single entry point callers should use for "give me a Study Overview
 * excerpt for this page/term": scores the page, and returns `undefined`
 * (never a misleading excerpt) when the page doesn't clear the `reject`
 * threshold — e.g. a TOC line like "Structure of DNA and RNA 355".
 */
export function findBestExcerpt(pageText: string, term: string): ScoredExcerpt | undefined {
  const relevance = scorePageRelevance(pageText, term)
  if (relevance.tier === 'reject' || relevance.bestIndex === -1) return undefined
  return { text: extractCoherentExcerpt(pageText, relevance.bestIndex, term), relevance }
}
