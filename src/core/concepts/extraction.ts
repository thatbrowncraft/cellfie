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

import { db, type Concept, type ConceptSource, type LibraryItem } from '../db'
import { getPageTextContent, joinPageText, joinPageTextPreservingParagraphs, loadPdfDocument } from '../pdf-engine'
import { readFile } from '../file-storage'
import { addConceptSource, getOrCreateConcept } from './service'
import { isLikelyStopwordPhrase, isPlausibleConceptName, isStopwordToken, normalizeConceptName } from './normalize'
import { findBestExcerpt, scorePageRelevance } from './relevance'
import { splitIntoKnownSections } from './textDisplay'

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
  if (looksLikeAuthorName(trimmed)) return false

  const isAcronym = /^[A-Z]{2,6}(-[A-Z0-9]{1,6})?$/.test(trimmed)
  const isCapitalizedPhrase = /^[A-Z][a-zA-Z0-9]*(?:[\s-][A-Za-z0-9][a-zA-Z0-9]*){0,5}$/.test(trimmed)
  return isAcronym || isCapitalizedPhrase
}

const AUTHOR_INITIAL_TOKEN_RE = /^[A-Z]{1,3}\.?$/

/**
 * Concept 2.0 §20 — bibliography/reference-list rows produce candidates
 * shaped like "Prescott JP" or "Sharma, M K": a capitalized surname
 * followed by one or more bare initials. That shape never occurs in a
 * real scientific term ("Gram staining", "Crystal violet"), so it's a
 * cheap, precise way to keep author names out of the candidate/suggested-
 * concept pipeline without touching the stopword list.
 */
function looksLikeAuthorName(trimmed: string): boolean {
  const words = trimmed.split(/[\s,]+/).filter(Boolean)
  if (words.length < 2) return false
  const [surname, ...rest] = words
  if (!/^[A-Z][a-z]+$/.test(surname)) return false
  return rest.every((w) => AUTHOR_INITIAL_TOKEN_RE.test(w))
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
    const pageText = joinPageText(textItems)
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      // Relevance Correction — never link a page that's structurally a
      // TOC/index/bibliography listing, or where the term is only an
      // isolated one-word hit. Keyword presence alone is no longer enough.
      const relevance = scorePageRelevance(pageText, term)
      if (relevance.tier === 'reject') continue
      const source = await addConceptSource({
        conceptId: concept.id,
        sourceType: 'pdf',
        libraryItemId: item.id,
        pageNumber: page,
        sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
        sourceText: term,
        relevanceTier: relevance.tier
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
 * Concept Hub Quality Pass §1 — OCR-fragment guard. When a PDF's text
 * layer breaks a single word across a spurious internal space ("Gram
 * staining" → "Gr am", "TECHNOLOGY" → "T EC HNOLOGY", "CSF" → "CS F"),
 * `tokenizeWords` has no way to know that "Gr"/"T"/"EC"/"CS" were never
 * standalone words — every one of them still *looks* like a capitalized
 * token shape-wise. The one cheap, reliable signal available without a
 * dictionary is length: a real standalone scientific word or acronym
 * essentially never surfaces as a bare 1-2 letter fragment in running
 * prose. A tiny curated allowlist covers the handful of genuine
 * short-token terms this would otherwise cost ("T cell", "B cell", "X
 * ray") — anything else that short is treated as a fragment and never
 * even reaches the (expensive, rate-limited) online verification step.
 */
const KNOWN_SHORT_SCIENTIFIC_TERMS = new Set([
  't cell', 't cells', 'b cell', 'b cells', 't lymphocyte', 'b lymphocyte',
  'nk cell', 'nk cells', 'x ray', 'x-ray', 'rh factor', 'g protein'
])

const MIN_FRAGMENT_SAFE_WORD_LENGTH = 3

function isAllowedShortToken(phraseSoFar: string, candidateFullPhraseGuess?: string): boolean {
  const key = normalizeConceptName(phraseSoFar)
  if (KNOWN_SHORT_SCIENTIFIC_TERMS.has(key)) return true
  if (candidateFullPhraseGuess && KNOWN_SHORT_SCIENTIFIC_TERMS.has(normalizeConceptName(candidateFullPhraseGuess))) return true
  return false
}

/**
 * Slides a window over a page's tokens looking for deterministic
 * scientific-term shapes: either a standalone acronym token (PCR, ELISA,
 * DNA — §4's "multi-word scientific terms" sibling case) or a run of 2-4
 * words starting with a capitalized word (Gram staining, Bacterial cell
 * wall, Crystal violet). A candidate phrase never starts or ends on a
 * stopword, and growth stops the moment a stopword — or an OCR-fragment-
 * shaped short token (see `KNOWN_SHORT_SCIENTIFIC_TERMS` above) — is hit,
 * so a sentence like "The cell is a very important structure" never
 * produces a candidate longer than nothing at all, and a broken word like
 * "T EC HNOLOGY" never seeds or grows into a candidate at all. Every
 * returned string still has to pass `looksLikeConceptPhrase` (shape +
 * length + stopword-phrase checks) before a caller treats it as real
 * evidence.
 */
export function extractCandidatePhrases(pageText: string): string[] {
  const tokens = tokenizeWords(pageText)
  const candidates = new Set<string>()

  for (let i = 0; i < tokens.length; i += 1) {
    const first = tokens[i]

    // Acronym-shaped single token (PCR, ELISA, RNA…) — no growth needed.
    if (ACRONYM_TOKEN_RE.test(first)) {
      candidates.add(first)
    }

    // Multi-word run: must start on a capitalized, non-stopword word that
    // isn't itself a bare fragment (e.g. "Gr", "T", "CS", "EC"). A short
    // first word is still allowed to seed a run when it, together with
    // the very next token, forms an allowlisted short term ("T cell") —
    // otherwise a fragment this short is never worth growing at all.
    if (!/^[A-Z]/.test(first) || isStopwordToken(first)) continue
    if (first.length < MIN_FRAGMENT_SAFE_WORD_LENGTH) {
      const lookahead = i + 1 < tokens.length ? `${first} ${tokens[i + 1]}` : first
      if (!isAllowedShortToken(first) && !isAllowedShortToken(lookahead)) continue
    }

    for (let w = 2; w <= CANDIDATE_MAX_WINDOW && i + w <= tokens.length; w += 1) {
      const nextWord = tokens[i + w - 1]
      // Stop growing (don't emit this or any longer window) the moment a
      // stopword is reached — keeps "The Cell Wall Is Important" from
      // ever producing "Cell Wall Is".
      if (isStopwordToken(nextWord)) break
      const soFar = tokens.slice(i, i + w).join(' ')
      // Same fragment guard applied to every word the window grows onto,
      // not just the seed — stops "Gram" (a real word) from still
      // growing into "Gram pos" → "Gram nega"-shaped OCR fragments where
      // the *second* word is the broken one.
      if (nextWord.length < MIN_FRAGMENT_SAFE_WORD_LENGTH && !isAllowedShortToken(soFar)) break
      candidates.add(soFar)
    }
  }

  return Array.from(candidates).filter(looksLikeConceptPhrase)
}

export interface PdfExtractionResult extends ExtractionResult {
  pagesScanned: number
  /** Always 0 — kept on the type for API stability. Knowledge Model Correction §1: PDF text scanning may only *link* concepts that already exist, never silently create new ones. See `findCandidateConceptsFromKnownPages` for the read-only, non-persisting version of candidate discovery that now backs the "Related concepts found in your sources" UI instead. */
  conceptsDiscovered: number
}

/**
 * Knowledge Model Correction §1/§2/§7 — links *existing* concept names/
 * aliases as literal text found in a book's PDF pages. This is
 * deliberately the only thing this function does: SOURCE MATCH, never
 * CONCEPT CREATION. It used to also auto-create brand-new concepts from
 * repeated capitalized phrases across the whole book — that's exactly
 * the behavior that produced dozens of garbage concepts (chemical
 * formula fragments, publisher names, sentence fragments) and has been
 * removed entirely, not patched with more stopwords. A concept can now
 * only ever be created via `createConcept`/`getOrCreateConcept` called
 * with `manuallyCreated: true` — from "+ New Concept", the reader's
 * concept picker, or an explicit "Add concept" promotion (search or
 * related-candidate flows). No AI, no embeddings, no network access —
 * string matching only.
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

  for (let page = 1; page <= item.pageCount; page += 1) {
    const { items: textItems } = await getPageTextContent(doc, page)
    const pageText = joinPageText(textItems)
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      const relevance = scorePageRelevance(pageText, term)
      if (relevance.tier === 'reject') continue
      const source = await addConceptSource({
        conceptId: concept.id,
        sourceType: 'pdf',
        libraryItemId: item.id,
        pageNumber: page,
        sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
        sourceText: term,
        relevanceTier: relevance.tier
      })
      if (source) result = mergeResults(result, { conceptsCreated: 0, conceptsUpdated: 1, sourcesLinked: 1 })
    }
  }

  return { ...result, pagesScanned, conceptsDiscovered: 0 }
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

// ---------------------------------------------------------------------
// Knowledge Graph Correction §17 — concept-scoped extraction. Fixes the
// case where a book was imported/opened before this concept existed (or
// before this feature shipped): its Sources tab can show real PDF pages
// while Related/Mind map stay empty forever, because nothing ever
// re-scanned that book's text once the concept had sources. Rather than
// re-scanning the whole book (§17: "avoid repeatedly scanning the entire
// book"), this starts from the concept's *own already-known* source
// pages and only reads those specific pages, looking for the other
// concepts sitting on them.
// ---------------------------------------------------------------------

const CONCEPT_PAGE_EXTRACTION_KEY_PREFIX = 'conceptPageExtraction:'

interface ConceptPageExtractionMeta {
  /** Sorted, comma-joined page numbers the last run covered — re-runs only when this concept has since picked up sources on pages that weren't covered before. */
  pagesSignature: string
  extractedAt: number
}

async function getConceptPageExtractionMeta(conceptId: string, libraryItemId: string): Promise<ConceptPageExtractionMeta | undefined> {
  const record = await db.appSettings.get(`${CONCEPT_PAGE_EXTRACTION_KEY_PREFIX}${conceptId}:${libraryItemId}`)
  return record?.value as ConceptPageExtractionMeta | undefined
}

async function setConceptPageExtractionMeta(conceptId: string, libraryItemId: string, meta: ConceptPageExtractionMeta): Promise<void> {
  await db.appSettings.put({ key: `${CONCEPT_PAGE_EXTRACTION_KEY_PREFIX}${conceptId}:${libraryItemId}`, value: meta })
}

/**
 * Reads only the given book's given pages (not the whole book) looking
 * for any *other existing* concept's name/alias as literal text —
 * Knowledge Model Correction §1/§2: this never creates a concept, it
 * only links concepts that are already real (user-created, or
 * explicitly promoted from a candidate/search result) to pages they
 * literally appear on. It used to also spin up brand-new concepts from
 * unrecognized phrases on these pages — that's the piece that's been
 * removed; see `findCandidateConceptsFromKnownPages` for the read-only
 * replacement that surfaces candidates for the user to explicitly add
 * instead of writing them automatically. Idempotent per (concept, book,
 * page set) via `appSettings`, so revisiting a concept detail page
 * repeatedly is cheap.
 */
export async function extractRelatedConceptsFromKnownPages(
  concept: { id: string; name: string },
  opts?: { force?: boolean }
): Promise<PdfExtractionResult> {
  const mySources = await db.conceptSources
    .where('conceptId')
    .equals(concept.id)
    .filter((s) => Boolean(s.libraryItemId) && s.pageNumber != null)
    .toArray()

  const pagesByItem = new Map<string, Set<number>>()
  for (const s of mySources) {
    const set = pagesByItem.get(s.libraryItemId as string) ?? new Set<number>()
    set.add(s.pageNumber as number)
    pagesByItem.set(s.libraryItemId as string, set)
  }
  if (pagesByItem.size === 0) return { ...emptyResult(), pagesScanned: 0, conceptsDiscovered: 0 }

  const items = await db.libraryItems.bulkGet(Array.from(pagesByItem.keys()))
  const existingConcepts = await db.concepts.toArray()
  const needles = existingConcepts
    .filter((c) => c.id !== concept.id)
    .flatMap((c) => [{ concept: c, term: c.name }, ...c.aliases.map((a) => ({ concept: c, term: a }))])
    .filter((n) => n.term.trim().length >= 3)
    .sort((a, b) => b.term.length - a.term.length)

  let result = emptyResult()
  let pagesScanned = 0

  for (const item of items) {
    if (!item) continue
    const pages = Array.from(pagesByItem.get(item.id) ?? []).sort((a, b) => a - b)
    if (pages.length === 0) continue

    const pagesSignature = pages.join(',')
    if (!opts?.force) {
      const meta = await getConceptPageExtractionMeta(concept.id, item.id)
      if (meta && meta.pagesSignature === pagesSignature) continue
    }

    let blob: Blob
    try {
      blob = await readFile(item.filePath)
    } catch {
      continue
    }
    const doc = await loadPdfDocument(blob)

    for (const page of pages) {
      const { items: textItems } = await getPageTextContent(doc, page)
      const pageText = joinPageText(textItems)
      if (!pageText.trim()) continue
      const lowerPageText = pageText.toLowerCase()
      pagesScanned += 1

      for (const { concept: other, term } of needles) {
        const key = term.toLowerCase()
        if (!lowerPageText.includes(key)) continue
        const relevance = scorePageRelevance(pageText, term)
        if (relevance.tier === 'reject') continue
        const source = await addConceptSource({
          conceptId: other.id,
          sourceType: 'pdf',
          libraryItemId: item.id,
          pageNumber: page,
          sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
          sourceText: term,
          relevanceTier: relevance.tier
        })
        if (source) result = mergeResults(result, { conceptsCreated: 0, conceptsUpdated: 1, sourcesLinked: 1 })
      }
    }

    await setConceptPageExtractionMeta(concept.id, item.id, { pagesSignature, extractedAt: Date.now() })
  }

  return { ...result, pagesScanned, conceptsDiscovered: 0 }
}

// ---------------------------------------------------------------------
// Knowledge Model Correction §9/§10/§11 — "Related concepts found in
// your sources" candidates. Deliberately the *read-only* twin of the
// function above: same page-scoped PDF read, same candidate-phrase
// shape rules, but returns plain data and never touches the database.
// A candidate only becomes a real Concept when the person clicks
// "Add concept" (see `promoteConceptCandidate` in ./service), which is
// the one and only remaining path — besides "+ New Concept" — by which
// PDF text can turn into a Concept record.
// ---------------------------------------------------------------------

export interface SourceCandidate {
  displayText: string
  normalizedName: string
  pages: { libraryItemId: string; pageNumber: number }[]
}

/** Generous cap since nothing here writes to the database — it's just how many suggestions the Related tab shows at once. */
const MAX_CANDIDATES_RETURNED = 30

/**
 * Sprint 4 correction — a phrase appearing on only one page of a book is
 * exactly the shape a one-off publisher credit, running header, or
 * "please visit our website" line takes; a real recurring scientific
 * term this concept's material actually discusses tends to come up more
 * than once across its source pages. This is a structural filter (how
 * often, not which specific words) rather than another one-off stopword
 * — see RelatedConceptsPanel for the online-verification pass layered on
 * top of it.
 */
const MIN_CANDIDATE_PAGE_OCCURRENCES = 2

export async function findCandidateConceptsFromKnownPages(concept: { id: string; name: string }): Promise<SourceCandidate[]> {
  const mySources = await db.conceptSources
    .where('conceptId')
    .equals(concept.id)
    .filter((s) => Boolean(s.libraryItemId) && s.pageNumber != null)
    .toArray()

  const pagesByItem = new Map<string, Set<number>>()
  for (const s of mySources) {
    const set = pagesByItem.get(s.libraryItemId as string) ?? new Set<number>()
    set.add(s.pageNumber as number)
    pagesByItem.set(s.libraryItemId as string, set)
  }
  if (pagesByItem.size === 0) return []

  const items = await db.libraryItems.bulkGet(Array.from(pagesByItem.keys()))
  const existingConcepts = await db.concepts.toArray()
  const existingNormalizedNames = new Set(existingConcepts.map((c) => c.normalizedName))
  const existingAliasKeys = new Set(existingConcepts.flatMap((c) => c.aliases.map((a) => normalizeConceptName(a))))
  const myKey = normalizeConceptName(concept.name)

  const candidateEvidence = new Map<string, { displayText: string; pages: { libraryItemId: string; pageNumber: number }[] }>()

  for (const item of items) {
    if (!item) continue
    const pages = Array.from(pagesByItem.get(item.id) ?? []).sort((a, b) => a - b)
    if (pages.length === 0) continue

    let blob: Blob
    try {
      blob = await readFile(item.filePath)
    } catch {
      continue
    }
    const doc = await loadPdfDocument(blob)

    for (const page of pages) {
      const { items: textItems } = await getPageTextContent(doc, page)
      const pageText = joinPageText(textItems)
      if (!pageText.trim()) continue

      for (const phrase of extractCandidatePhrases(pageText)) {
        const key = normalizeConceptName(phrase)
        if (key === myKey) continue
        if (existingNormalizedNames.has(key) || existingAliasKeys.has(key)) continue
        const evidence = candidateEvidence.get(key) ?? { displayText: phrase, pages: [] }
        if (!evidence.pages.some((p) => p.libraryItemId === item.id && p.pageNumber === page)) {
          evidence.pages.push({ libraryItemId: item.id, pageNumber: page })
        }
        candidateEvidence.set(key, evidence)
      }
    }
  }

  return Array.from(candidateEvidence.entries())
    .map(([normalizedName, evidence]) => ({ normalizedName, displayText: evidence.displayText, pages: evidence.pages }))
    .filter((c) => c.pages.length >= MIN_CANDIDATE_PAGE_OCCURRENCES)
    .sort((a, b) => b.pages.length - a.pages.length)
    .slice(0, MAX_CANDIDATES_RETURNED)
}

/**
 * Concept Hub Quality Pass §1 — deduplication for the merged "Suggested
 * concepts" list. Purely lexical (no semantic matching): treats B as a
 * duplicate of A when every significant word of B is a prefix of the
 * word in the same position of A (or vice versa) — e.g. "Gram pos" vs
 * "Gram positive bacteria", or "Gram nega" vs "Gram-negative bacteria".
 * The longer/more complete phrasing always wins so the visible
 * suggestion is the canonical scientific name, never the truncated one.
 */
function significantWords(text: string): string[] {
  return normalizeConceptName(text)
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !isStopwordToken(w))
}

function isAbbreviationOf(shortText: string, longText: string): boolean {
  const shortWords = significantWords(shortText)
  const longWords = significantWords(longText)
  if (shortWords.length === 0 || shortWords.length > longWords.length) return false
  return shortWords.every((w, i) => {
    const counterpart = longWords[i]
    if (!counterpart) return false
    return counterpart === w || counterpart.startsWith(w) || w.startsWith(counterpart)
  })
}

/**
 * Dedupes a list of candidate display strings, keeping the longest/most
 * complete phrasing whenever two candidates are lexical abbreviations of
 * each other. `getText` extracts the display string from each item;
 * items are otherwise passed through unchanged.
 */
export function dedupeByAbbreviation<T>(items: T[], getText: (item: T) => string): T[] {
  // Longest phrase first, so a shorter duplicate always merges into an
  // already-kept longer one rather than the reverse.
  const sorted = [...items].sort((a, b) => getText(b).length - getText(a).length)
  const kept: T[] = []
  for (const item of sorted) {
    const text = getText(item)
    const isDuplicate = kept.some((k) => {
      const keptText = getText(k)
      return (
        normalizeConceptName(keptText) === normalizeConceptName(text) ||
        isAbbreviationOf(text, keptText) ||
        isAbbreviationOf(keptText, text)
      )
    })
    if (!isDuplicate) kept.push(item)
  }
  return kept
}

export interface SourceExcerpt {
  libraryItemId: string
  pageNumber: number
  text: string
  relevanceTier: 'high' | 'relevant' | 'weak'
}

const MAX_STUDY_SOURCE_PAGES = 8

// A leading, unheaded block only qualifies as the Study Overview
// paragraph if it reads like real prose, not a fragment ("DNA ... see
// Chapter 4 ... 112") — same spirit as relevance.ts's own fragment
// guard, kept local since this is a display-shaping threshold, not a
// scoring one.
const MIN_OVERVIEW_PARAGRAPH_WORDS = 12

export interface StudySection {
  heading: string
  body: string
  bookTitle: string
  pageNumber: number
}

export interface LocalOverviewParagraph {
  text: string
  bookTitle: string
  pageNumber: number
}

export interface StudyOverview {
  /** The concept's own strongest page, in the source's own prose — only
   *  set when that page actually opens with real unheaded explanatory
   *  text (not a fragment, not a page that starts straight into a named
   *  section). `undefined` means "no safe local paragraph", not "empty
   *  string" — callers must not fabricate a fallback sentence for it. */
  paragraph?: LocalOverviewParagraph
  /** Every section the source material itself already labels, merged
   *  across the concept's strong pages/books. Empty when nothing in the
   *  source is actually headed — that is the correct, honest result for
   *  concepts like DNA where a source may just be continuous prose. */
  sections: StudySection[]
}

function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)
  return matches ? matches.length : 0
}

/**
 * Concept 2.0 §6/§10, Study Overview Correction — the Learn tab's
 * adaptive structure. Reads across ALL of a concept's strong
 * (`high`/`relevant`) PDF pages — not just a single "best" one — and:
 *
 *   1. takes the concept's actual explanatory prose as the Study
 *      Overview paragraph: specifically the unheaded paragraph that
 *      actually CONTAINS the concept's own strongest occurrence on its
 *      strongest page (grounded by `relevance.ts`'s own scoring, the
 *      same signal used to pick the page itself) — not simply whatever
 *      paragraph happens to sit first on that page, which could be a
 *      leftover continuation from an unrelated preceding topic. Only
 *      used if that paragraph reads like real prose, not a fragment.
 *   2. separately collects every section the source material already
 *      labels itself (Definition, Principle, Procedure, Formula,
 *      Shortcuts, ...), merged across pages/books.
 *
 * Zero invention in either case: a heading only appears here because
 * the source text itself used that exact word, and a paragraph only
 * appears here because the source itself wrote it as continuous prose
 * AND it's the paragraph actually about this concept — nothing is
 * assembled from the concept's name or from what a topic "usually"
 * contains. The first (highest-tier, then earliest-page) occurrence of
 * a given heading wins; a second book's "Definition" doesn't overwrite
 * or append to the first — conflicting sources stay visible via
 * References instead of being silently merged into one paragraph.
 */
export async function buildStudyOverview(
  concept: Pick<Concept, 'name'>,
  sources: ConceptSource[],
  itemsById: Map<string, LibraryItem>
): Promise<StudyOverview> {
  const tierRank: Record<string, number> = { high: 2, relevant: 1 }
  const candidates = sources
    .filter(
      (s) =>
        s.sourceType === 'pdf' &&
        s.libraryItemId &&
        s.pageNumber != null &&
        (s.relevanceTier === 'high' || s.relevanceTier === 'relevant')
    )
    .sort(
      (a, b) =>
        (tierRank[b.relevanceTier ?? ''] ?? 0) - (tierRank[a.relevanceTier ?? ''] ?? 0) ||
        (a.pageNumber! - b.pageNumber!)
    )
    .slice(0, MAX_STUDY_SOURCE_PAGES)

  const sections = new Map<string, StudySection>()
  let paragraph: LocalOverviewParagraph | undefined
  const docCache = new Map<string, Awaited<ReturnType<typeof loadPdfDocument>>>()

  for (const source of candidates) {
    const item = itemsById.get(source.libraryItemId as string)
    if (!item) continue

    let doc = docCache.get(item.id)
    if (!doc) {
      try {
        const blob = await readFile(item.filePath)
        doc = await loadPdfDocument(blob)
        docCache.set(item.id, doc)
      } catch {
        continue
      }
    }

    // Study Overview Correction: read this page TWICE, with two
    // different, purpose-built joins of the same underlying PDF text
    // items — a paragraph-preserving one for structural section
    // parsing, and the existing flattened one for locating the
    // concept's own strongest occurrence (relevance.ts's scoring is
    // whitespace-agnostic, so it works the same either way, but stays
    // on the flattened form other callers already rely on).
    let pageText: string
    let flatPageText: string
    try {
      const { items: textItems } = await getPageTextContent(doc, source.pageNumber as number)
      pageText = joinPageTextPreservingParagraphs(textItems)
      flatPageText = joinPageText(textItems)
    } catch {
      continue
    }

    const term = source.sourceText || concept.name
    const blocks = splitIntoKnownSections(pageText)

    // Ground the paragraph choice in the concept's own strongest
    // occurrence on this page, not block order.
    if (!paragraph) {
      const relevance = scorePageRelevance(flatPageText, term)
      if (relevance.bestIndex !== -1) {
        // The cleaned text `splitIntoKnownSections` computed offsets
        // against isn't byte-identical to `flatPageText` (one preserves
        // paragraph breaks as single characters, the other collapses
        // them to spaces) but both collapse every whitespace run to
        // exactly one character, so a character offset found in one is
        // a reasonable position in the other — close enough to land
        // inside the correct block, which is all this needs.
        const containing = blocks.find((b) => relevance.bestIndex >= b.start && relevance.bestIndex < b.end)
        if (containing && !containing.heading && countWords(containing.body) >= MIN_OVERVIEW_PARAGRAPH_WORDS) {
          paragraph = { text: containing.body, bookTitle: item.title, pageNumber: source.pageNumber as number }
        }
      }
    }

    for (const block of blocks) {
      if (!block.heading) continue
      const key = normalizeConceptName(block.heading)
      if (sections.has(key)) continue
      sections.set(key, {
        heading: block.heading,
        body: block.body,
        bookTitle: item.title,
        pageNumber: source.pageNumber as number
      })
    }
  }

  return { paragraph, sections: Array.from(sections.values()) }
}

/**
 * Knowledge Model Correction §8, Relevance Correction — on-demand only
 * (never called automatically): reads a single page and returns a short
 * excerpt of raw, unedited text around the concept's STRONGEST occurrence
 * on that page (see core/concepts/relevance.ts), not simply the first one.
 * Returns `undefined` — rather than a misleading excerpt — when the page
 * doesn't clear the relevance bar (e.g. it's a TOC/index/bibliography
 * listing, or the term only appears as an isolated fragment). This is
 * source-derived *context*, clearly not an authored definition — the
 * caller is responsible for labeling it as a quoted excerpt, not a
 * description.
 */
export async function getSourceExcerpt(item: LibraryItem, pageNumber: number, term: string): Promise<SourceExcerpt | undefined> {
  let blob: Blob
  try {
    blob = await readFile(item.filePath)
  } catch {
    return undefined
  }
  const doc = await loadPdfDocument(blob)
  const { items: textItems } = await getPageTextContent(doc, pageNumber)
  const pageText = joinPageText(textItems)
  const found = findBestExcerpt(pageText, term)
  if (!found || found.relevance.tier === 'reject') return undefined
  return { libraryItemId: item.id, pageNumber, text: found.text, relevanceTier: found.relevance.tier }
}

const RELEVANCE_BACKFILL_KEY_PREFIX = 'conceptRelevanceBackfill:v1:'
/** Soft ceiling so a concept with a very large legacy source count (like the reported 69) can't turn one page-open into an unbounded PDF-reading pass. */
const MAX_BACKFILL_PAGES_PER_RUN = 120

export interface RelevanceBackfillResult {
  ran: boolean
  scored: number
  removed: number
}

/**
 * Relevance Correction — one-time, per-concept retrofit for `pdf` sources
 * that were linked before relevance scoring existed (e.g. the 69 sources
 * a concept like "DNA" could accumulate under the old keyword-only
 * linking). Reads each such page once, scores it against the concept's
 * own name/aliases, and either stores the computed tier or removes the
 * source entirely if it turns out to be a `reject` (TOC/index/
 * bibliography) page — exactly the kind of row the old logic should
 * never have linked in the first place. Gated by an `appSettings` key per
 * concept, same pattern as `runAutoConceptCleanup`, so it's safe to call
 * unconditionally every time a concept's detail page opens.
 */
export async function backfillSourceRelevance(conceptId: string): Promise<RelevanceBackfillResult> {
  const settingsKey = `${RELEVANCE_BACKFILL_KEY_PREFIX}${conceptId}`
  const already = await db.appSettings.get(settingsKey)
  if (already) return { ran: false, scored: 0, removed: 0 }

  const concept = await db.concepts.get(conceptId)
  if (!concept) return { ran: false, scored: 0, removed: 0 }

  const untiered = await db.conceptSources
    .where('conceptId')
    .equals(conceptId)
    .filter((s) => s.sourceType === 'pdf' && Boolean(s.libraryItemId) && s.pageNumber != null && !s.relevanceTier)
    .toArray()

  if (untiered.length === 0) {
    await db.appSettings.put({ key: settingsKey, value: { ranAt: Date.now(), scored: 0, removed: 0 } })
    return { ran: true, scored: 0, removed: 0 }
  }

  const batch = untiered.slice(0, MAX_BACKFILL_PAGES_PER_RUN)
  const byItem = new Map<string, ConceptSource[]>()
  for (const s of batch) {
    const list = byItem.get(s.libraryItemId as string) ?? []
    list.push(s)
    byItem.set(s.libraryItemId as string, list)
  }

  let scored = 0
  let removed = 0

  for (const [itemId, list] of byItem) {
    const item = await db.libraryItems.get(itemId)
    if (!item) continue
    let blob: Blob
    try {
      blob = await readFile(item.filePath)
    } catch {
      continue
    }
    const doc = await loadPdfDocument(blob)
    for (const source of list) {
      const { items: textItems } = await getPageTextContent(doc, source.pageNumber as number)
      const pageText = joinPageText(textItems)
      const term = source.sourceText || concept.name
      const relevance = scorePageRelevance(pageText, term)
      if (relevance.tier === 'reject') {
        await db.conceptSources.delete(source.id)
        removed += 1
      } else {
        await db.conceptSources.update(source.id, { relevanceTier: relevance.tier })
        scored += 1
      }
    }
  }

  // Only mark the whole concept "done" once every untiered row has been
  // covered — a large legacy backlog gets picked up again on the next
  // visit instead of being silently left half-scored.
  if (untiered.length <= MAX_BACKFILL_PAGES_PER_RUN) {
    await db.appSettings.put({ key: settingsKey, value: { ranAt: Date.now(), scored, removed } })
  }

  return { ran: true, scored, removed }
}
