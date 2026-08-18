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

// Question-Bank Content Correction — a Quantitative Aptitude-style book's
// "PROBABILITY" (or "WHAT IS THE PROBABILITY THAT") block can pass every
// other check (own-heading match, real prose, dozens of occurrences of
// the term) while still being a wall of MCQ options and exam-citation
// stems rather than an explanation — the exact opposite of what Core
// Concept is supposed to show. Every signal below is shape-only, the
// same "no dictionary, no subject knowledge" discipline as
// `detectExtractionQuality` above, so the same guard protects a
// chemistry MCQ bank or a physics one exactly as well as a probability
// one, without hardcoding anything about quantitative aptitude.
const MCQ_OPTION_MARKER_RE = /\([a-e]\)/gi
const NONE_OF_THESE_RE = /\bnone of (?:these|the above)\b/gi
// A citation bracket naming a real exam/test and a year — e.g.
// "[IBPS—Bank PO/MT (Pre.) Exam, 2015]" — is something a genuine
// explanatory passage essentially never contains.
const EXAM_CITATION_RE = /\[[^\]\n]{0,80}(?:19|20)\d{2}\]/g

/**
 * True when a block of text looks like raw practice-question material
 * (multiple-choice options, "None of these" filler answers, exam
 * citations, or a fragment dominated by bare numbers/arithmetic symbols
 * — the shape of a garbled answer-key table) rather than explanatory
 * prose. Used to keep Core Concept a coherent lesson instead of a
 * question dump; flagged sections stay available via References (which
 * lists every linked source, not just what qualified for Core Concept),
 * they're only excluded from the lesson itself.
 */
export function detectQuestionBankContent(text: string): boolean {
  const alphaTokens = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  const numericTokens = text.match(/\d+(?:\.\d+)?/g) ?? []
  const totalTokens = alphaTokens.length + numericTokens.length
  if (totalTokens < 15) return false // too little text either way to judge

  const optionMarkers = text.match(MCQ_OPTION_MARKER_RE)?.length ?? 0
  const noneOfThese = text.match(NONE_OF_THESE_RE)?.length ?? 0
  const examCitations = text.match(EXAM_CITATION_RE)?.length ?? 0
  const questionMarks = (text.match(/\?/g) ?? []).length

  // A real explanatory passage might use "(a)"/"(b)" once for a genuine
  // sub-list, or ask a single rhetorical question — that's normal prose.
  // Several option markers, an explicit "none of these" filler answer,
  // or an exam-citation bracket are things real explanatory prose
  // essentially never contains, so even one of those alongside a couple
  // of option markers is already a strong signal.
  if (optionMarkers >= 6) return true
  if (noneOfThese >= 1 && optionMarkers >= 2) return true
  if (examCitations >= 1 && optionMarkers >= 2) return true

  const mcqDensity =
    (optionMarkers * 2 + noneOfThese * 3 + examCitations * 2 + questionMarks) / Math.max(alphaTokens.length, 1)
  if (mcqDensity >= 0.09) return true

  // Answer-key/working-out fragment shape — dominated by bare numbers
  // and arithmetic symbols rather than words (e.g. a garbled capture of
  // a solutions table: "4 11 6 11 18 20 18 20 = x + x + ..."). Only
  // flagged once there are enough tokens to judge, mirroring
  // `detectExtractionQuality`'s own 20-token floor above.
  if (totalTokens >= 20 && numericTokens.length / totalTokens > 0.45) return true

  return false
}

// Splits on a real sentence boundary (end punctuation + whitespace,
// followed by something that looks like the start of a new sentence) —
// same shape SENTENCE_BOUNDARY_RE already scores by, just used here to
// actually cut the text into pieces instead of counting them.
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/g

function splitSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface TrimSectionOptions {
  maxSentences?: number
  maxWords?: number
}

// Exported so callers building a depth-aware trim budget (see
// extraction.ts's buildStudyOverview) can use the original compact
// default as their own "compact" tier instead of duplicating the numbers.
export const DEFAULT_TRIM_MAX_SENTENCES = 7
export const DEFAULT_TRIM_MAX_WORDS = 140

/**
 * Concept boundary correction §7 — cuts a long textbook section down to
 * the sentences that actually explain the concept, dropping tangential or
 * repetitive surrounding prose. This never rewrites a kept sentence: it
 * only chooses which whole sentences survive, so whatever remains is
 * exactly what the source book wrote, in its original order — the same
 * "zero invention" rule the rest of this module follows.
 *
 * A section short enough to already be readable (few sentences, few
 * words) is returned untouched — trimming exists for the verbose case,
 * not to shrink every section to a uniform size. For a long section, each
 * sentence is kept if it names the concept itself (score 2), sits right
 * next to one that does (score 1, since textbook prose often carries the
 * referent across a sentence via "it"/"this"), or is the section's own
 * opening sentence (kept unconditionally as the setup for what follows).
 * Everything else is dropped first when the section needs to shrink.
 */
export function trimSectionProse(text: string, terms: string[], opts: TrimSectionOptions = {}): string {
  const trimmedText = text.trim()
  const maxSentences = opts.maxSentences ?? DEFAULT_TRIM_MAX_SENTENCES
  const maxWords = opts.maxWords ?? DEFAULT_TRIM_MAX_WORDS

  const sentences = splitSentences(trimmedText)
  if (sentences.length <= 1) return trimmedText
  const totalWords = tokenizeWords(trimmedText).length
  if (sentences.length <= maxSentences && totalWords <= maxWords) return trimmedText

  const needles = terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 3)
  const mentions = sentences.map((s) => {
    const lower = s.toLowerCase()
    return needles.some((n) => lower.includes(n))
  })
  const scores = sentences.map((_, i) => {
    if (mentions[i]) return 2
    if (mentions[i - 1] || mentions[i + 1]) return 1
    return 0
  })

  const keepIdx = new Set<number>([0]) // the opening sentence always survives
  const rankedOthers = sentences
    .map((_, i) => i)
    .filter((i) => i !== 0)
    .sort((a, b) => scores[b] - scores[a] || a - b)

  for (const i of rankedOthers) {
    if (keepIdx.size >= maxSentences) break
    if (scores[i] > 0) keepIdx.add(i)
  }
  // Concept mentions were sparse enough that the cap still has room —
  // fill remaining slots in original ranked order rather than leaving the
  // trimmed section shorter than the budget allows.
  if (keepIdx.size < Math.min(maxSentences, sentences.length)) {
    for (const i of rankedOthers) {
      if (keepIdx.size >= maxSentences) break
      keepIdx.add(i)
    }
  }

  return Array.from(keepIdx)
    .sort((a, b) => a - b)
    .map((i) => sentences[i])
    .join(' ')
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
