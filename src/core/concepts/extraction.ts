/**
 * core/concepts/extraction — Sprint 3 §3/§4, deterministic concept
 * extraction. Absolutely no AI, no embeddings, no fuzzy/semantic
 * matching. Every function here either:
 *   (a) turns a tag or a short highlight/title into a candidate concept
 *       using plain string rules, or
 *   (b) looks for existing concept names/aliases as literal substrings
 *       inside a PDF's already-extracted text (on-demand scan).
 * Nothing here invents scientific knowledge or a relationship that isn't
 * backed by an actual stored record.
 */

import { db, type LibraryItem } from '../db'
import { getPageTextContent, loadPdfDocument } from '../pdf-engine'
import { readFile } from '../file-storage'
import { addConceptSource, getOrCreateConcept } from './service'
import { isLikelyStopwordPhrase, isPlausibleConceptName, isStopwordToken, normalizeConceptName } from './normalize'

export interface ExtractionResult {
  conceptsCreated: number
  conceptsUpdated: number
  sourcesLinked: number
}

function emptyResult(): ExtractionResult {
  return { conceptsCreated: 0, conceptsUpdated: 0, sourcesLinked: 0 }
}

function mergeResults(a: ExtractionResult, b: ExtractionResult): ExtractionResult {
  return {
    conceptsCreated: a.conceptsCreated + b.conceptsCreated,
    conceptsUpdated: a.conceptsUpdated + b.conceptsUpdated,
    sourcesLinked: a.sourcesLinked + b.sourcesLinked
  }
}

/**
 * A highlight/title/tag is a *plausible* concept candidate when it's
 * short (a phrase, not a sentence) and either Title Case or contains a
 * recognizable scientific-term shape (all-caps acronym like "PCR"/"ELISA",
 * or a capitalized multi-word term like "Gram staining"). This is a
 * shape/heuristic filter, not semantic understanding — it exists purely
 * to keep "the cell is a very important structure" out and let "Gram
 * staining" / "PCR" / "Peptidoglycan" through, per the brief's good/bad
 * examples.
 */
export function looksLikeConceptPhrase(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 60) return false
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 6) return false
  if (isLikelyStopwordPhrase(trimmed)) return false
  if (!isPlausibleConceptName(trimmed)) return false

  const isAcronym = /^[A-Z]{2,6}(-[A-Z0-9]{1,6})?$/.test(trimmed)
  const isCapitalizedPhrase = /^[A-Z][a-zA-Z0-9]*(?:[\s-][A-Za-z0-9][a-zA-Z0-9]*){0,5}$/.test(trimmed)
  return isAcronym || isCapitalizedPhrase
}

/**
 * Extracts concepts from every LibraryItem's tags and every Note's tags —
 * tags are the highest-confidence deterministic signal available (the
 * person or the import pipeline explicitly labeled the item with that
 * word). Every tag becomes/reuses a concept, sourced as `metadata`
 * (book-level) or `note` (note-level).
 */
export async function extractConceptsFromTags(): Promise<ExtractionResult> {
  let result = emptyResult()

  const items = await db.libraryItems.toArray()
  for (const item of items) {
    for (const tag of item.tags) {
      if (!isPlausibleConceptName(tag) || isLikelyStopwordPhrase(tag)) continue
      result = mergeResults(result, await linkTagToConcept(tag, { itemId: item.id }))
    }
  }

  const notes = await db.notes.toArray()
  for (const note of notes) {
    for (const tag of note.tags) {
      if (!isPlausibleConceptName(tag) || isLikelyStopwordPhrase(tag)) continue
      result = mergeResults(result, await linkTagToConcept(tag, { noteId: note.id, itemId: note.itemId, page: note.page }))
    }
  }

  return result
}

async function linkTagToConcept(
  tag: string,
  ctx: { itemId?: string; noteId?: string; page?: number }
): Promise<ExtractionResult> {
  const before = await db.concepts.where('normalizedName').equals(normalizeConceptName(tag)).first()
  const concept = await getOrCreateConcept({ name: titleCase(tag), aliases: [tag], tags: [tag] }, false)
  const source = ctx.noteId
    ? await addConceptSource({
        conceptId: concept.id,
        sourceType: 'note' as const,
        sourceId: ctx.noteId,
        libraryItemId: ctx.itemId,
        pageNumber: ctx.page,
        sourceText: tag
      })
    : ctx.itemId
      ? await addConceptSource({
          conceptId: concept.id,
          sourceType: 'metadata' as const,
          libraryItemId: ctx.itemId,
          sourceText: tag
        })
      : undefined

  return {
    conceptsCreated: before ? 0 : 1,
    conceptsUpdated: before ? 1 : 0,
    sourcesLinked: source ? 1 : 0
  }
}

/**
 * Extracts concepts from short highlights whose text itself looks like a
 * term rather than a full sentence (§3's "Good: Gram staining, PCR…" vs
 * "Bad: the, cell, is, a…"). A highlight only becomes a concept when its
 * trimmed text passes `looksLikeConceptPhrase` — most highlighted
 * sentences correctly produce nothing.
 */
export async function extractConceptsFromHighlights(): Promise<ExtractionResult> {
  let result = emptyResult()
  const highlights = await db.highlights.toArray()
  for (const h of highlights) {
    const text = h.text.trim()
    if (!looksLikeConceptPhrase(text)) continue
    const before = await db.concepts.where('normalizedName').equals(normalizeConceptName(text)).first()
    const concept = await getOrCreateConcept({ name: text, aliases: [], tags: [] }, false)
    const source = await addConceptSource({
      conceptId: concept.id,
      sourceType: 'highlight',
      sourceId: h.id,
      libraryItemId: h.itemId,
      pageNumber: h.page,
      sourceText: text
    })
    result = mergeResults(result, {
      conceptsCreated: before ? 0 : 1,
      conceptsUpdated: before ? 1 : 0,
      sourcesLinked: source ? 1 : 0
    })
  }
  return result
}

/** Runs both tag- and highlight-based extraction — the "rebuild from your library" action exposed in the Concept Explorer's toolbar/empty state. */
export async function runFullExtraction(): Promise<ExtractionResult> {
  const [a, b] = await Promise.all([extractConceptsFromTags(), extractConceptsFromHighlights()])
  return mergeResults(a, b)
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export interface ScanResult extends ExtractionResult {
  pagesScanned: number
}

/**
 * On-demand deterministic PDF text scan (§3, §6 "on-demand PDF text
 * scanning"). Does NOT invent new concepts — it only looks for existing
 * concept names/aliases as literal, case-insensitive substrings inside
 * the book's own extracted text, and links a traceable `pdf` source
 * (with page number) wherever a match is found. This keeps concept
 * *creation* deterministic and user/tag/highlight-driven, while still
 * letting a book "surface" concepts the person already tracks elsewhere.
 */
export async function scanLibraryItemForConcepts(item: LibraryItem): Promise<ScanResult> {
  const concepts = await db.concepts.toArray()
  if (concepts.length === 0 || !item.pageCount) {
    return { ...emptyResult(), pagesScanned: 0 }
  }

  // Longest names first so "Gram-positive bacteria" matches before the
  // shorter "Gram staining" would otherwise shadow part of the same line.
  const needles = concepts
    .flatMap((c) => [{ concept: c, term: c.name }, ...c.aliases.map((a) => ({ concept: c, term: a }))])
    .filter((n) => n.term.trim().length >= 3)
    .sort((a, b) => b.term.length - a.term.length)

  let blob: Blob
  try {
    blob = await readFile(item.filePath)
  } catch {
    return { ...emptyResult(), pagesScanned: 0 }
  }
  const doc = await loadPdfDocument(blob)

  let result = emptyResult()
  let pagesScanned = 0

  for (let page = 1; page <= item.pageCount; page += 1) {
    const { items: textItems } = await getPageTextContent(doc, page)
    const pageText = textItems.map((t) => t.str).join(' ')
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      const source = await addConceptSource({
        conceptId: concept.id,
        sourceType: 'pdf',
        libraryItemId: item.id,
        pageNumber: page,
        sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
        sourceText: term
      })
      if (source) result = mergeResults(result, { conceptsCreated: 0, conceptsUpdated: 1, sourcesLinked: 1 })
    }
  }

  return { ...result, pagesScanned }
}

// ---------------------------------------------------------------------
// Sprint 3 Correction §1/§4/§17 — deterministic concept *discovery* from
// a book's own PDF text, not just matching concepts that already exist.
// This is the piece that lets the Knowledge Layer stand on a book's
// local source material alone, without requiring a saved note or
// highlight first.
// ---------------------------------------------------------------------

const CANDIDATE_MAX_WINDOW = 4

/**
 * Tokenizes a page's text into plain word-ish chunks (letters and
 * internal hyphens only). Punctuation/numbers are treated as breaks —
 * deliberately crude, but that's fine here: it only needs to stop a
 * candidate phrase from accidentally spanning a sentence boundary, not
 * to be a real tokenizer.
 */
function tokenizeWords(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z-]*/g) ?? []
}

const ACRONYM_TOKEN_RE = /^[A-Z]{2,6}$/

/**
 * Slides a window over a page's tokens looking for deterministic
 * scientific-term shapes: either a standalone acronym token (PCR, ELISA,
 * DNA — §4's "multi-word scientific terms" sibling case) or a run of 2-4
 * words starting with a capitalized word (Gram staining, Bacterial cell
 * wall, Crystal violet). A candidate phrase never starts or ends on a
 * stopword, and growth stops the moment a stopword is hit, so a sentence
 * like "The cell is a very important structure" never produces a
 * candidate longer than nothing at all — matching §4's bad-example list
 * exactly. Every returned string still has to pass `looksLikeConceptPhrase`
 * (shape + length + stopword-phrase checks) before a caller treats it as
 * real evidence.
 */
function extractCandidatePhrases(pageText: string): string[] {
  const tokens = tokenizeWords(pageText)
  const candidates = new Set<string>()

  for (let i = 0; i < tokens.length; i += 1) {
    const first = tokens[i]

    // Acronym-shaped single token (PCR, ELISA, RNA…) — no growth needed.
    if (ACRONYM_TOKEN_RE.test(first)) {
      candidates.add(first)
    }

    // Multi-word run: must start on a capitalized, non-stopword word.
    if (!/^[A-Z]/.test(first) || isStopwordToken(first)) continue

    for (let w = 2; w <= CANDIDATE_MAX_WINDOW && i + w <= tokens.length; w += 1) {
      const nextWord = tokens[i + w - 1]
      // Stop growing (don't emit this or any longer window) the moment a
      // stopword is reached — keeps "The Cell Wall Is Important" from
      // ever producing "Cell Wall Is".
      if (isStopwordToken(nextWord)) break
      candidates.add(tokens.slice(i, i + w).join(' '))
    }
  }

  return Array.from(candidates).filter(looksLikeConceptPhrase)
}

interface CandidateEvidence {
  /** First-seen casing, used as the created concept's display name. */
  displayText: string
  pages: Set<number>
}

export interface PdfExtractionResult extends ExtractionResult {
  pagesScanned: number
  /** New concepts created purely from repeated PDF text (not from an existing concept name/alias match). */
  conceptsDiscovered: number
}

/** How many *new* concepts a single extraction pass is allowed to create — keeps one huge book from flooding the Knowledge Layer (§4, §17). */
const MAX_NEW_CONCEPTS_PER_RUN = 40
/** A candidate must repeat on at least this many distinct pages before it's trusted enough to become a brand-new concept (§4 "repeated scientific phrases", §6 "do not over-infer"). Existing concepts still match on a single occurrence via the needle pass above — this threshold only gates *new* concept creation. */
const MIN_PAGES_FOR_NEW_CONCEPT = 2

/**
 * The unified deterministic pass over one book's PDF text (§1, §3, §4,
 * §13): in a single read of the file, (a) links any *existing* concept
 * name/alias found as literal text — same rule as `scanLibraryItemForConcepts`
 * — and (b) discovers brand-new concepts from scientific-term-shaped
 * phrases that repeat across multiple pages. Every created concept and
 * every source link is traceable to the exact book/page it came from
 * (§6). No AI, no embeddings, no network access — string matching and
 * counting only.
 */
export async function extractConceptsFromPdf(item: LibraryItem): Promise<PdfExtractionResult> {
  if (!item.pageCount) return { ...emptyResult(), pagesScanned: 0, conceptsDiscovered: 0 }

  let blob: Blob
  try {
    blob = await readFile(item.filePath)
  } catch {
    return { ...emptyResult(), pagesScanned: 0, conceptsDiscovered: 0 }
  }

  const existingConcepts = await db.concepts.toArray()
  const needles = existingConcepts
    .flatMap((c) => [{ concept: c, term: c.name }, ...c.aliases.map((a) => ({ concept: c, term: a }))])
    .filter((n) => n.term.trim().length >= 3)
    .sort((a, b) => b.term.length - a.term.length)

  const doc = await loadPdfDocument(blob)

  let result = emptyResult()
  let pagesScanned = 0
  const candidateEvidence = new Map<string, CandidateEvidence>()

  for (let page = 1; page <= item.pageCount; page += 1) {
    const { items: textItems } = await getPageTextContent(doc, page)
    const pageText = textItems.map((t) => t.str).join(' ')
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    // (a) Existing concepts — same literal-substring rule as scanLibraryItemForConcepts.
    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      const source = await addConceptSource({
        conceptId: concept.id,
        sourceType: 'pdf',
        libraryItemId: item.id,
        pageNumber: page,
        sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
        sourceText: term
      })
      if (source) result = mergeResults(result, { conceptsCreated: 0, conceptsUpdated: 1, sourcesLinked: 1 })
    }

    // (b) New-concept candidates — accumulate evidence, decide after the full scan.
    for (const phrase of extractCandidatePhrases(pageText)) {
      const key = normalizeConceptName(phrase)
      const evidence = candidateEvidence.get(key) ?? { displayText: phrase, pages: new Set<number>() }
      evidence.pages.add(page)
      candidateEvidence.set(key, evidence)
    }
  }

  // Only phrases that (1) repeat across enough distinct pages and (2)
  // aren't already an existing concept get created — ranked by page
  // spread so the most-supported terms win the per-run cap.
  const existingNormalizedNames = new Set(existingConcepts.map((c) => c.normalizedName))
  const existingAliasKeys = new Set(existingConcepts.flatMap((c) => c.aliases.map((a) => normalizeConceptName(a))))

  const qualifying = Array.from(candidateEvidence.entries())
    .filter(([key]) => !existingNormalizedNames.has(key) && !existingAliasKeys.has(key))
    .filter(([, evidence]) => evidence.pages.size >= MIN_PAGES_FOR_NEW_CONCEPT)
    .sort((a, b) => b[1].pages.size - a[1].pages.size)
    .slice(0, MAX_NEW_CONCEPTS_PER_RUN)

  let conceptsDiscovered = 0
  for (const [, evidence] of qualifying) {
    const before = await db.concepts.where('normalizedName').equals(normalizeConceptName(evidence.displayText)).first()
    const concept = await getOrCreateConcept({ name: evidence.displayText, aliases: [], tags: [] }, false)
    if (!before) conceptsDiscovered += 1

    for (const page of evidence.pages) {
      const source = await addConceptSource({
        conceptId: concept.id,
        sourceType: 'pdf',
        libraryItemId: item.id,
        pageNumber: page,
        sourceId: `${item.id}:${page}:${normalizeConceptName(evidence.displayText)}`,
        sourceText: evidence.displayText
      })
      if (source) {
        result = mergeResults(result, {
          conceptsCreated: 0,
          conceptsUpdated: 0,
          sourcesLinked: 1
        })
      }
    }
  }

  result = mergeResults(result, { conceptsCreated: conceptsDiscovered, conceptsUpdated: 0, sourcesLinked: 0 })

  return { ...result, pagesScanned, conceptsDiscovered }
}

const EXTRACTION_META_KEY_PREFIX = 'conceptExtraction:'

interface ExtractionRunMeta {
  pageCount: number
  extractedAt: number
}

async function getExtractionMeta(itemId: string): Promise<ExtractionRunMeta | undefined> {
  const record = await db.appSettings.get(`${EXTRACTION_META_KEY_PREFIX}${itemId}`)
  return record?.value as ExtractionRunMeta | undefined
}

async function setExtractionMeta(itemId: string, meta: ExtractionRunMeta): Promise<void> {
  await db.appSettings.put({ key: `${EXTRACTION_META_KEY_PREFIX}${itemId}`, value: meta })
}

/**
 * Throttled entry point for automatic extraction (§17: "Book
 * imported/opened → local text available → deterministic extraction").
 * Reuses the existing `appSettings` key-value table (same pattern as
 * `core/db/reading-time.ts`) to remember the last page count a book was
 * scanned at, so opening the same book repeatedly — or every render of
 * the Concepts page — never re-runs the PDF pass. It re-runs only when
 * the book hasn't been scanned yet, or its page count changed
 * (re-imported/replaced file), or the caller explicitly forces it.
 */
export async function runDeterministicExtractionForItem(
  item: LibraryItem,
  opts?: { force?: boolean }
): Promise<PdfExtractionResult | undefined> {
  if (!item.pageCount) return undefined
  if (!opts?.force) {
    const meta = await getExtractionMeta(item.id)
    if (meta && meta.pageCount === item.pageCount) return undefined
  }
  const result = await extractConceptsFromPdf(item)
  await setExtractionMeta(item.id, { pageCount: item.pageCount, extractedAt: Date.now() })
  return result
}
