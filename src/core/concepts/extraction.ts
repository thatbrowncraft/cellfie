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
import { openLibraryDocument } from './documentText'
import { addConceptSource, getOrCreateConcept } from './service'
import { isLikelyStopwordPhrase, isPlausibleConceptName, isStopwordToken, normalizeConceptName } from './normalize'
import {
  detectExtractionQuality,
  findBestExcerpt,
  headingMatchesTerm,
  scorePageRelevance,
  trimSectionProse,
  type PageRelevance,
  type RelevanceTier
} from './relevance'
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
 * Retrieval Diagnostic Correction §D — `scorePageRelevance` is a pure
 * prose-density heuristic (sentence boundaries, number density, page
 * length): it has no idea a page opens with the book's OWN heading for
 * this exact concept. A real textbook's section-opening page is
 * routinely short on running prose (a title, a sentence or two, then a
 * figure/diagram taking the rest of the page) and can legitimately score
 * `weak` or even `reject` under that heuristic alone — which then
 * silently excludes it from `buildStudyOverview`'s candidate pool no
 * matter how central that page actually is. `headingMatchesTerm` is
 * already the single strongest relevance signal this codebase has (see
 * its own doc comment); this makes that signal actually reach the
 * TIERING step (used to decide which pages are even eligible to be read
 * for Study Overview), not just the later block-level section-building
 * step that already trusted it. Never upgrades a page that doesn't
 * actually contain the term at all (that's still `reject` from
 * `scorePageRelevance` itself), and never downgrades anything — this can
 * only raise `weak`/`reject` up to `relevant` when the source book
 * itself titled a section on this exact page with the concept's own
 * name or alias.
 */
function applyOwnHeadingRelevanceFloor(relevance: PageRelevance, structuredPageText: string, term: string): PageRelevance {
  if (relevance.tier === 'high' || relevance.tier === 'relevant') return relevance
  if (relevance.bestIndex === -1) return relevance
  const hasOwnHeading = splitIntoKnownSections(structuredPageText).some(
    (block) => block.heading && headingMatchesTerm(block.heading, [term])
  )
  if (!hasOwnHeading) return relevance
  return { ...relevance, tier: 'relevant' }
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

  let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
  try {
    vdoc = await openLibraryDocument(item)
  } catch {
    return { ...emptyResult(), pagesScanned: 0 }
  }

  let result = emptyResult()
  let pagesScanned = 0

  for (let page = 1; page <= (item.pageCount ?? vdoc.pageCount); page += 1) {
    const { flat: pageText, structured: structuredPageText } = await vdoc.getPageText(page)
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      // Relevance Correction — never link a page that's structurally a
      // TOC/index/bibliography listing, or where the term is only an
      // isolated one-word hit. Keyword presence alone is no longer enough.
      const relevance = applyOwnHeadingRelevanceFloor(scorePageRelevance(pageText, term), structuredPageText, term)
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

  let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
  try {
    vdoc = await openLibraryDocument(item)
  } catch {
    return { ...emptyResult(), pagesScanned: 0, conceptsDiscovered: 0 }
  }

  const existingConcepts = await db.concepts.toArray()
  const needles = existingConcepts
    .flatMap((c) => [{ concept: c, term: c.name }, ...c.aliases.map((a) => ({ concept: c, term: a }))])
    .filter((n) => n.term.trim().length >= 3)
    .sort((a, b) => b.term.length - a.term.length)

  let result = emptyResult()
  let pagesScanned = 0

  for (let page = 1; page <= item.pageCount; page += 1) {
    const { flat: pageText, structured: structuredPageText } = await vdoc.getPageText(page)
    if (!pageText.trim()) continue
    const lowerPageText = pageText.toLowerCase()
    pagesScanned += 1

    for (const { concept, term } of needles) {
      const key = term.toLowerCase()
      if (!lowerPageText.includes(key)) continue
      const relevance = applyOwnHeadingRelevanceFloor(scorePageRelevance(pageText, term), structuredPageText, term)
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

    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch {
      continue
    }

    for (const page of pages) {
      const { flat: pageText } = await vdoc.getPageText(page)
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

    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch {
      continue
    }

    for (const page of pages) {
      const { flat: pageText } = await vdoc.getPageText(page)
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

// Section relevance §B — normalized heading labels that are structurally
// never a concept's own explanatory section, matching the brief's
// explicit rejection list ("learning objectives when the objective is
// not itself the actual explanatory section", references/bibliographies,
// unrelated case studies presented as their own labeled block). Compared
// against `normalizeConceptName(block.heading)`, same normalization the
// section dedupe key already uses.
const NON_EXPLANATORY_HEADING_LABELS = new Set(
  [
    'learning objectives', 'objectives', 'objective', 'chapter objectives',
    'key terms', 'keywords', 'vocabulary',
    'summary', 'chapter summary', 'section summary',
    'review questions', 'review', 'self-assessment', 'self assessment',
    'references', 'bibliography', 'further reading', 'suggested reading',
    'case study', 'case studies', 'box'
  ].map((h) => normalizeConceptName(h))
)

export interface StudySection {
  heading: string
  body: string
  bookTitle: string
  pageNumber: number
  /** Retrieval Correction §2 — true when the source book itself titled this section with the concept's own name/alias, not just a heading that happened to share a page with the concept. */
  isConceptHeading?: boolean
  /** Retrieval Correction §5 — see ConceptSource.extractionQuality. */
  extractionQuality?: 'ok' | 'garbled'
  /**
   * Retrieval Diagnostic Correction §C — other uploaded books whose own
   * section under this SAME heading label had genuinely complementary
   * (not near-duplicate) material, merged into `body` after the first
   * book's own contribution. `bookTitle`/`pageNumber` above always stay
   * the FIRST book found for this heading, so the section's own heading
   * text and primary citation are never altered by a later book — this
   * only ever appends, never replaces.
   */
  additionalSources?: { bookTitle: string; pageNumber: number }[]
}

// Retrieval Diagnostic Correction §C — cheap, deterministic word-overlap
// check so a second book's section under the same heading label ("Definition",
// "Photosynthesis") only gets merged in when it actually adds something,
// not when it's substantially the same passage a first book already
// contributed (which would just duplicate the same explanation twice).
// No semantic understanding — pure token-overlap, same spirit as every
// other signal in this pipeline.
function overlapTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
}
function isNearDuplicateSection(a: string, b: string): boolean {
  const wordsA = overlapTokens(a)
  const wordsB = overlapTokens(b)
  if (wordsA.size === 0 || wordsB.size === 0) return false
  let shared = 0
  for (const w of wordsA) if (wordsB.has(w)) shared += 1
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.75
}
// Cap how many additional books can pile onto one heading so a common
// generic label (e.g. "Definition") appearing in every uploaded book
// can't grow one section into an unreadable wall of merged text.
const MAX_ADDITIONAL_SECTION_SOURCES = 2

// Concept boundary correction — a broad term (DNA, Cell, Protein) turns
// up as an incidental mention across dozens of sections that are really
// ABOUT something else (Transformation, Cancer, Viruses, Biotechnology,
// Mutation...). A section whose own heading doesn't name the concept only
// belongs in the lesson when the concept is a substantial part of what
// that section teaches, not a passing reference — so the bar for that
// case is deliberately higher than "mentioned twice in real prose":
//   - the page-level tier must be relevant/high, never weak (weak is
//     exactly the "one clean-looking mention in otherwise unrelated
//     prose" shape)
//   - at least a handful of separate occurrences, not two
//   - occurrences dense enough relative to the section's own length that
//     the concept is clearly a running thread, not a name-drop early on
//     in an otherwise long, unrelated section
const MIN_SECTION_OCCURRENCES_FOR_NON_OWN_HEADING = 4
const MIN_SECTION_TERM_DENSITY = 0.016 // roughly one occurrence per 62 words of section body
const MAX_NON_OWN_HEADING_FIRST_MENTION_FRACTION = 0.4

// Keep Only Strongest Sections — 626 source pages should not become 20+
// merged sections just because each one individually cleared the bar
// above; the lesson stays a focused explanation by keeping only the
// strongest few, ranked by how directly each section teaches the concept.
const MAX_LESSON_SECTIONS = 6

const GARBLED_SECTION_PENALTY = 500

function sectionStrength(
  isConceptHeading: boolean | undefined,
  tier: RelevanceTier,
  occurrences: number,
  extractionQuality: 'ok' | 'garbled' | undefined
): number {
  const base = isConceptHeading
    ? 1000
    : (tier === 'high' ? 100 : tier === 'relevant' ? 50 : 0) + occurrences
  return extractionQuality === 'garbled' ? base - GARBLED_SECTION_PENALTY : base
}

export interface LocalOverviewParagraph {
  text: string
  bookTitle: string
  pageNumber: number
  extractionQuality?: 'ok' | 'garbled'
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
function libraryItemMatchesStudyContexts(
  item: LibraryItem | undefined,
  contextIds: string[]
): boolean {
  if (contextIds.length === 0) return true
  if (!item) return false

  const record = item as unknown as Record<string, unknown>
  const rawTags = record.tags

  if (!Array.isArray(rawTags)) return false

  const tags = rawTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)

  return contextIds.some((contextId) => tags.includes(contextId))
}

export async function buildStudyOverview(
  concept: Pick<Concept, 'name' | 'aliases'>,
  sources: ConceptSource[],
  itemsById: Map<string, LibraryItem>,
  contextIds: string[] = []
): Promise<StudyOverview> {
  const tierRank: Record<string, number> = { high: 2, relevant: 1 }
  const qualityRank: Record<string, number> = { ok: 1, garbled: 0 }
  const rankedCandidates = sources
    .filter(
      (s) =>
        s.sourceType === 'pdf' &&
        s.libraryItemId &&
        s.pageNumber != null &&
        (s.relevanceTier === 'high' || s.relevanceTier === 'relevant') &&
        libraryItemMatchesStudyContexts(
          itemsById.get(s.libraryItemId as string),
          contextIds.map((id) => id.trim().toLowerCase()).filter(Boolean)
        )
    )
    .sort(
      (a, b) =>
        (tierRank[b.relevanceTier ?? ''] ?? 0) - (tierRank[a.relevanceTier ?? ''] ?? 0) ||
        // Retrieval Correction §5 — among equally-relevant pages, a
        // cleanly-extracted one is tried before a garbled one, so a
        // corrupted scan never wins purely for having the earlier page
        // number.
        (qualityRank[b.extractionQuality ?? 'ok'] ?? 1) - (qualityRank[a.extractionQuality ?? 'ok'] ?? 1) ||
        (a.pageNumber! - b.pageNumber!)
    )

  // Multi-book merging — Retrieval Correction §B. A plain global slice
  // of the top MAX_STUDY_SOURCE_PAGES pages let one book's several
  // strong pages crowd out every other book that has its own genuinely
  // relevant section, which is exactly the "Book A OR B OR C" behavior
  // the brief calls out. This keeps the same per-page tier/quality/page
  // ordering *within* each book, but round-robins ACROSS books so a
  // second or third book with real material always gets a chance to
  // contribute, instead of only ever appearing when the strongest book
  // runs out of high-tier pages.
  const byBook = new Map<string, ConceptSource[]>()
  for (const s of rankedCandidates) {
    const list = byBook.get(s.libraryItemId as string) ?? []
    list.push(s)
    byBook.set(s.libraryItemId as string, list)
  }
  const bookQueues = Array.from(byBook.values())
  const candidates: ConceptSource[] = []
  for (let round = 0; candidates.length < MAX_STUDY_SOURCE_PAGES && bookQueues.some((q) => q.length > round); round += 1) {
    for (const queue of bookQueues) {
      if (candidates.length >= MAX_STUDY_SOURCE_PAGES) break
      if (queue[round]) candidates.push(queue[round])
    }
  }

  // Retrieval Correction §1/§2 — every name the source material might
  // itself use as a heading for this concept.
  const conceptTerms = [concept.name, ...(concept.aliases ?? [])].filter((t) => t.trim().length >= 3)

  const sections = new Map<string, StudySection>()
  const sectionMeta = new Map<string, { tier: RelevanceTier; occurrences: number }>()
  const headingMatchKeys = new Set<string>()
  let paragraph: LocalOverviewParagraph | undefined
  const docCache = new Map<string, Awaited<ReturnType<typeof openLibraryDocument>>>()

  for (const source of candidates) {
    const item = itemsById.get(source.libraryItemId as string)
    if (!item) continue

    let vdoc = docCache.get(item.id)
    if (!vdoc) {
      try {
        vdoc = await openLibraryDocument(item)
        docCache.set(item.id, vdoc)
      } catch {
        continue
      }
    }

    // Study Overview Correction: read this page's structured (paragraph-
    // preserving) and flat forms — the structured one for structural
    // section parsing, the flat one for locating the concept's own
    // strongest occurrence (relevance.ts's scoring is whitespace-
    // agnostic, so it works the same either way, but stays on the
    // flattened form other callers already rely on).
    let pageText: string
    let flatPageText: string
    try {
      const page = await vdoc.getPageText(source.pageNumber as number)
      pageText = page.structured
      flatPageText = page.flat
    } catch {
      continue
    }

    const term = source.sourceText || concept.name
    const blocks = splitIntoKnownSections(pageText)
    const extractionQuality = source.extractionQuality ?? detectExtractionQuality(flatPageText)

    // Retrieval Correction §2 — the strongest possible signal: the
    // source book itself titled one of this page's blocks with the
    // concept's own name/alias. When that exists, it beats the "wherever
    // the strongest keyword occurrence happens to sit" fallback below,
    // because it's the actual section, not just the nearest paragraph to
    // a mention.
    if (!paragraph) {
      const ownHeadingBlock = blocks.find((b) => b.heading && headingMatchesTerm(b.heading, conceptTerms))
      if (ownHeadingBlock && countWords(ownHeadingBlock.body) >= MIN_OVERVIEW_PARAGRAPH_WORDS) {
        paragraph = { text: ownHeadingBlock.body, bookTitle: item.title, pageNumber: source.pageNumber as number, extractionQuality }
      }
    }

    // Fallback: ground the paragraph choice in the concept's own
    // strongest occurrence on this page, not block order — only used
    // when no block on any candidate page is actually headed with the
    // concept's own name.
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
          paragraph = { text: containing.body, bookTitle: item.title, pageNumber: source.pageNumber as number, extractionQuality }
        }
      }
    }

    for (const block of blocks) {
      if (!block.heading) continue
      const key = normalizeConceptName(block.heading)
      // Section relevance §B — a small set of heading labels are never
      // an explanatory section for ANY concept, no matter what their
      // body text mentions or how many times: a Learning Objectives list
      // typically names several concepts in one line each without
      // teaching any of them, and Summary/Review-Questions/References-
      // style blocks are recaps or pointers, not the primary lesson.
      // Checked before the heading-match/body-relevance logic below so
      // it can never be overridden by a high occurrence count.
      if (NON_EXPLANATORY_HEADING_LABELS.has(key)) continue

      const isConceptHeading = headingMatchesTerm(block.heading, conceptTerms)
      // Retrieval Correction §2/§B, Concept boundary correction — a
      // heading that ISN'T the concept's own name only belongs in this
      // concept's lesson if its own body text substantially teaches the
      // concept, not just mentions it. A parent/broader heading (e.g.
      // "Nucleic Acids" for the concept DNA) can still qualify, but only
      // when the concept is clearly a running thread in that section:
      // real prose (never `weak`, which is exactly the "one clean-looking
      // mention amid otherwise unrelated prose" shape), several separate
      // occurrences, and a density high enough that the section reads as
      // being substantially about the concept rather than name-dropping
      // it once early on. This is what keeps a section like
      // "Transformation" or "Mutation" — where the concept is discussed
      // only as part of another topic — out of the lesson, without
      // hardcoding any topic name: it's the same shape/density test for
      // every concept.
      let blockRelevance: PageRelevance | undefined
      if (!isConceptHeading) {
        blockRelevance = scorePageRelevance(block.body, term)
        if (blockRelevance.tier !== 'high' && blockRelevance.tier !== 'relevant') continue
        if (blockRelevance.occurrences < MIN_SECTION_OCCURRENCES_FOR_NON_OWN_HEADING) continue
        const bodyWords = countWords(block.body)
        const density = blockRelevance.occurrences / Math.max(bodyWords, 1)
        if (density < MIN_SECTION_TERM_DENSITY) continue
        const firstOccurrence = block.body.toLowerCase().indexOf(term.trim().toLowerCase())
        if (firstOccurrence !== -1 && firstOccurrence / Math.max(block.body.length, 1) > MAX_NON_OWN_HEADING_FIRST_MENTION_FRACTION) {
          continue
        }
      }

      const existingSection = sections.get(key)
      if (!existingSection) {
        if (isConceptHeading) headingMatchKeys.add(key)
        sections.set(key, {
          heading: block.heading,
          body: block.body,
          bookTitle: item.title,
          pageNumber: source.pageNumber as number,
          isConceptHeading,
          extractionQuality
        })
        sectionMeta.set(key, {
          tier: isConceptHeading ? 'high' : (blockRelevance as PageRelevance).tier,
          occurrences: isConceptHeading ? Number.POSITIVE_INFINITY : (blockRelevance as PageRelevance).occurrences
        })
        continue
      }

      // Retrieval Diagnostic Correction §C — ALL relevant uploaded books
      // merge here, not just the first one that reached this heading:
      // a second (or third) book's own section under the same heading
      // label is complementary evidence, appended after the first book's
      // contribution, as long as it isn't substantially the same passage
      // already captured and this heading hasn't already collected its
      // cap of extra books. The first book's own heading text/citation
      // (`existingSection.bookTitle`/`pageNumber`) is never overwritten —
      // real headings the source material used stay exactly as written.
      if (existingSection.bookTitle === item.title) continue
      if ((existingSection.additionalSources?.length ?? 0) >= MAX_ADDITIONAL_SECTION_SOURCES) continue
      if (existingSection.additionalSources?.some((s) => s.bookTitle === item.title)) continue
      if (isNearDuplicateSection(existingSection.body, block.body)) continue
      existingSection.body = `${existingSection.body}\n\n${block.body}`
      existingSection.additionalSources = [
        ...(existingSection.additionalSources ?? []),
        { bookTitle: item.title, pageNumber: source.pageNumber as number }
      ]
    }
  }

  // The concept's own headed section(s) lead the lesson; everything else
  // (generic Definition/Principle/Procedure-style labels, or a heading
  // from a different topic that still passed the body-relevance check)
  // follows ranked by how strongly it teaches the concept — own-heading
  // sections first, then by relevance tier and occurrence count.
  const strengthOf = ([key, section]: [string, StudySection]) => {
    const meta = sectionMeta.get(key)
    return sectionStrength(
      section.isConceptHeading,
      meta?.tier ?? 'weak',
      meta?.occurrences ?? 0,
      section.extractionQuality
    )
  }
  const rankedEntries = Array.from(sections.entries()).sort((a, b) => strengthOf(b) - strengthOf(a))

  // Deduplicate overlapping sections across books — two DIFFERENT heading
  // labels (e.g. "DNA" in one book, "Structure of DNA" in another) can
  // still be substantially the same passage once their body text is
  // compared directly, the same signal used above for same-heading
  // merging, just applied across the whole set. Iterating strongest-first
  // means a duplicate is always resolved by keeping the stronger section
  // and dropping the weaker one, never the reverse.
  const deduped: Array<[string, StudySection]> = []
  for (const entry of rankedEntries) {
    const [, section] = entry
    const isDuplicate = deduped.some(([, kept]) => isNearDuplicateSection(kept.body, section.body))
    if (isDuplicate) continue
    deduped.push(entry)
  }

  // Final Core Concept selection.
  //
  // A global slice can let one textbook dominate all six lesson slots.
  // Give every represented book one strong chance first, then fill any
  // remaining slots by overall strength. Garbled sections are excluded
  // from Core Concept entirely; they remain available through References.
  const cleanSections = deduped.filter(
    ([, section]) => section.extractionQuality !== 'garbled'
  )

  const selected: Array<[string, StudySection]> = []
  const usedBooks = new Set<string>()

  // Pass 1: one strong section from each distinct book.
  for (const entry of cleanSections) {
    if (selected.length >= MAX_LESSON_SECTIONS) break

    const [, section] = entry
    if (usedBooks.has(section.bookTitle)) continue

    selected.push(entry)
    usedBooks.add(section.bookTitle)
  }

  // Pass 2: fill remaining slots with the strongest remaining sections.
  if (selected.length < MAX_LESSON_SECTIONS) {
    for (const entry of cleanSections) {
      if (selected.length >= MAX_LESSON_SECTIONS) break
      if (selected.includes(entry)) continue
      selected.push(entry)
    }
  }

  // Trim excessive prose — long sections are cut down to the sentences
  // that actually explain the concept; short sections pass through
  // unchanged (trimSectionProse is a no-op below its own length budget).
  const orderedSections = selected.map(([, section]) => ({
    ...section,
    body: trimSectionProse(section.body, conceptTerms)
  }))

  const trimmedParagraph = paragraph ? { ...paragraph, text: trimSectionProse(paragraph.text, conceptTerms) } : undefined

  return { paragraph: trimmedParagraph, sections: orderedSections }
}

const STUDY_OVERVIEW_CACHE_KEY_PREFIX = 'conceptStudyOverviewCache:v1:'

interface StudyOverviewCacheEntry {
  fingerprint: string
  overview: StudyOverview
  builtAt: number
}

/**
 * A cheap, deterministic fingerprint of exactly the source rows
 * `buildStudyOverview` actually reads from (same filter it applies
 * internally) — order-independent, so re-linking the same sources in a
 * different order never invalidates the cache, but a genuinely new or
 * removed source (new upload, explicit rescan, a source's relevance
 * tier changing) always does.
 */
function libraryItemFingerprint(item: LibraryItem | undefined): string {
  if (!item) return 'missing'
  // Keep the fingerprint metadata-only. LibraryItem can contain the imported
  // document/blob itself, which must never be stringified into a cache key.
  const record = item as unknown as Record<string, unknown>
  const metadata = Object.entries(record)
    .filter(([key, value]) => {
      const k = key.toLowerCase()
      if (/(blob|file|data|content|bytes|buffer)/.test(k)) return false
      return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    })
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(metadata)
}

function studyOverviewFingerprint(
  sources: ConceptSource[],
  itemsById?: Map<string, LibraryItem>,
  contextIds: string[] = []
): string {
  const sourcePart = sources
    .filter(
      (s) =>
        s.sourceType === 'pdf' &&
        s.libraryItemId &&
        s.pageNumber != null &&
        (s.relevanceTier === 'high' || s.relevanceTier === 'relevant')
    )
    .map(
      (s) =>
        `${s.id}:${s.sourceId ?? ''}:${s.libraryItemId}:${s.pageNumber}:${s.relevanceTier}:${s.extractionQuality ?? ''}:${s.sourceText ?? ''}`
    )
    .sort()
    .join('|')

  const itemIds = Array.from(
    new Set(
      sources
        .filter((s) => s.sourceType === 'pdf' && s.libraryItemId)
        .map((s) => s.libraryItemId as string)
    )
  ).sort()

  const itemPart = itemIds
    .map((id) => `${id}:${libraryItemFingerprint(itemsById?.get(id))}`)
    .join('|')

  const contextPart = contextIds
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',')

  return `${sourcePart}||items:${itemPart}||contexts:${contextPart || 'all'}`
}

/**
 * Returns a previously settled Core Concept without rebuilding it.
 *
 * This is intentionally separate from `buildStudyOverviewSettled`: on a
 * refresh, the page can hydrate an unchanged saved lesson immediately while
 * the library scan checks for newer material in the background.
 */
export async function getCachedStudyOverview(
  concept: Pick<Concept, 'id'>,
  sources: ConceptSource[],
  contextIds: string[] = []
): Promise<StudyOverview | undefined> {
  const itemIds = Array.from(
    new Set(
      sources
        .filter((s) => s.sourceType === 'pdf' && s.libraryItemId)
        .map((s) => s.libraryItemId as string)
    )
  )
  const items = await db.libraryItems.bulkGet(itemIds)
  const itemsById = new Map(
    items.filter((item): item is LibraryItem => Boolean(item)).map((item) => [item.id, item])
  )
  const fingerprint = studyOverviewFingerprint(sources, itemsById, contextIds)
  const contextKey = contextIds
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',') || 'all'
  const cacheKey = `${STUDY_OVERVIEW_CACHE_KEY_PREFIX}${concept.id}:${contextKey}`
  const cached = await db.appSettings.get(cacheKey)
  const entry = cached?.value as StudyOverviewCacheEntry | undefined

  if (entry && entry.fingerprint === fingerprint) {
    return entry.overview
  }

  return undefined
}

/**
 * Refresh/Lifecycle Correction — `buildStudyOverview` itself re-reads
 * real PDF pages for every candidate source (see its own body above),
 * which is the actual expensive step in "Core Concept", separate from
 * `scanLibraryForConcept`'s already-cached linking pass. Before this,
 * that PDF re-read ran on EVERY page open/refresh regardless of whether
 * anything changed, because `studyOverview` React state is reset on
 * every mount. This wraps it with a settled-result cache keyed by a
 * fingerprint of the exact source rows that fed it: unchanged sources
 * mean an instant cache hit and zero PDF reads; a new upload, an
 * explicit rescan, or any change to which sources qualify invalidates
 * it automatically. This is the piece that makes "refresh reuses the
 * settled Core Concept" true across full page reloads, not just
 * React-state-preserving navigation.
 */
export async function buildStudyOverviewSettled(
  concept: Pick<Concept, 'id' | 'name' | 'aliases'>,
  sources: ConceptSource[],
  itemsById: Map<string, LibraryItem>,
  contextIds: string[] = []
): Promise<StudyOverview> {
  const fingerprint = studyOverviewFingerprint(sources, itemsById, contextIds)
  const contextKey = contextIds
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',') || 'all'
  const cacheKey = `${STUDY_OVERVIEW_CACHE_KEY_PREFIX}${concept.id}:${contextKey}`
  const cached = await db.appSettings.get(cacheKey)
  const entry = cached?.value as StudyOverviewCacheEntry | undefined
  if (entry && entry.fingerprint === fingerprint) {
    console.log(`[buildStudyOverviewSettled:${concept.name}] cache hit — reusing settled Core Concept, no PDF re-read`)
    return entry.overview
  }

  console.log(`[buildStudyOverviewSettled:${concept.name}] StudyOverview build started`)
  const overview = await buildStudyOverview(concept, sources, itemsById, contextIds)
  console.log(`[buildStudyOverviewSettled:${concept.name}] StudyOverview build completed`)
  await db.appSettings.put({ key: cacheKey, value: { fingerprint, overview, builtAt: Date.now() } satisfies StudyOverviewCacheEntry })
  return overview
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
  let pageText: string
  try {
    const vdoc = await openLibraryDocument(item)
    pageText = (await vdoc.getPageText(pageNumber)).flat
  } catch {
    return undefined
  }
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
    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch {
      continue
    }
    for (const source of list) {
      const { flat: pageText, structured: structuredPageText } = await vdoc.getPageText(source.pageNumber as number)
      const term = source.sourceText || concept.name
      const relevance = applyOwnHeadingRelevanceFloor(scorePageRelevance(pageText, term), structuredPageText, term)
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

// ---------------------------------------------------------------------
// Retrieval Correction §3 — automatic Tier 1 search across the user's
// ENTIRE uploaded library, not just whichever book they manually clicked
// "Scan" on. This is the piece that lets buildStudyOverview's existing
// multi-book merge actually see more than one book: that function has
// always been able to merge sections across every `ConceptSource` a
// concept has, but a book only ever produced one when either (a) it was
// imported/re-scanned after the concept already existed (see
// `extractConceptsFromPdf`, needle-per-existing-concept), or (b) the
// person opened this exact concept and manually pressed Scan on that
// exact book. A concept created or first opened *after* several books
// were already in the library had no way to reach books in case (b)
// without that manual step. This closes that gap from the concept's
// side instead.
// ---------------------------------------------------------------------

const CONCEPT_LIBRARY_SCAN_KEY_PREFIX = 'conceptLibraryScan:v1:'
const CONCEPT_LIBRARY_SCAN_MARKER_VERSION = 2

function libraryScanFingerprint(item: LibraryItem): string {
  // Metadata-only fingerprint. Do not include the imported document/blob.
  const record = item as unknown as Record<string, unknown>
  const metadata = Object.entries(record)
    .filter(([key, value]) => {
      const k = key.toLowerCase()
      if (/(blob|file|data|content|bytes|buffer)/.test(k)) return false
      return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    })
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(metadata)
}

/**
 * Per-book safety ceiling for one automatic scan pass.
 *
 * IMPORTANT: this is deliberately per book, not global.
 * A global 300-page cap meant a 341-page first book could consume the
 * entire budget and prevent books 2..N from ever being scanned.
 *
 * Each book gets up to this many successfully read pages per call. If a
 * book is larger, its marker stores the checkpoint and the next visit
 * resumes it. Other books are still allowed to make progress in the same
 * call.
 */
const MAX_AUTO_SCAN_PAGES_PER_BOOK_PER_CALL = 300

export interface ConceptLibraryScanResult {
  ran: boolean
  booksScanned: number
  pagesScanned: number
  sourcesLinked: number
}

/**
 * For one concept, makes sure every uploaded book has actually been
 * searched for THAT concept's own name/aliases at least once — without
 * requiring the person to open each book and press Scan individually.
 * Idempotent per (concept, book) via an `appSettings` marker (same
 * throttling pattern as `backfillSourceRelevance`/
 * `runAutoConceptCleanup`): a book already searched for this concept is
 * never re-read, so this is safe to call unconditionally every time a
 * concept's page opens — most calls after the first do zero PDF reads at
 * all, they just confirm every book already has a marker.
 *
 * Deliberately scoped to THIS concept's own terms only — unlike
 * `scanLibraryItemForConcepts` (all concepts against one book), this
 * never re-reads a whole book's text against every other concept in the
 * library, so opening one concept can't turn into a full-library re-index.
 */
interface ConceptLibraryScanMarker {
  ranAt: number
  done: boolean
  lastPageScanned?: number
  linked?: number
  error?: string
  /** Version of the scan marker schema. Older markers are deliberately treated as stale once. */
  scanVersion?: number
  /** Metadata fingerprint of the exact imported book that was scanned. */
  libraryFingerprint?: string
  /** Concurrency-and-Memory Correction — pages that timed out or threw during a previous scan of this book for this concept. Skipped on sight (no read attempt) rather than re-paying the timeout every visit. Reset only when a fresh scan of this book starts from page 1 (explicit rescan), never silently. */
  badPages?: number[]
}

/**
 * Diagnostic Correction (5-minute-hang report) — a single page whose
 * text extraction never settles (seen in practice on certain malformed/
 * scanned PDF pages, where pdf.js's worker round-trip just never
 * resolves — it doesn't throw, it hangs) used to stall this entire
 * function forever: one bad page anywhere in book 3 of 5 meant books
 * 4 and 5 were never even attempted, and the caller's
 * `Promise.all([...]).finally(...)` in ConceptDetailPage never ran,
 * which is exactly the "stuck on Combining material… indefinitely"
 * symptom. This is a per-PAGE guard, not a pipeline-level timeout: a
 * page that doesn't respond within the budget is logged and skipped,
 * the scan moves on to the next page/book, and nothing here ever
 * substitutes MeSH or gives up on the rest of the library.
 *
 * Concurrency-and-Memory Correction — a per-page timeout alone doesn't
 * scale: a book with 30 genuinely bad pages (not rare in real scanned
 * textbooks) used to pay `PAGE_READ_TIMEOUT_MS` 30 times SERIALLY —
 * minutes of pure waiting on pages that were never going to produce
 * text — and paid it again on every future scan of that book, forever.
 * Two changes fix that:
 *  1. Pages are now read in small concurrent batches (see
 *     `PAGE_READ_CONCURRENCY` below), so several timeouts overlap
 *     instead of stacking. With the current concurrency of 8, 30 bad
 *     pages wait in only a handful of batches instead of paying each
 *     timeout serially.
 *  2. A page's own timeout/error is persisted in its marker's
 *     `badPages`, so it's skipped instantly (no read attempt, no
 *     waiting) on every scan after the first — the timeout cost is paid
 *     once per bad page, ever, not once per visit. Cleared only by an
 *     explicit rescan (same invalidation path as everything else this
 *     marker gates).
 */
const PAGE_READ_TIMEOUT_MS = 5000
/** How many pages this book reads at once. Kept modest — this is still running on the main thread's event loop budget on a phone, not a worker pool free to fan out unbounded. */
const PAGE_READ_CONCURRENCY = 8

type PageReadOutcome =
  | { status: 'ok'; text: { flat: string; structured: string } }
  | { status: 'timeout' }
  | { status: 'error' }

async function readPageWithGuard(vdoc: Awaited<ReturnType<typeof openLibraryDocument>>, page: number): Promise<PageReadOutcome> {
  const TIMEOUT = Symbol('page-read-timeout')
  try {
    const result = await Promise.race([
      vdoc.getPageText(page),
      new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), PAGE_READ_TIMEOUT_MS))
    ])
    if (result === TIMEOUT) {
      console.warn(`[scanLibraryForConcept] page ${page} timed out after ${PAGE_READ_TIMEOUT_MS}ms, marking bad and skipping`)
      return { status: 'timeout' }
    }
    return { status: 'ok', text: result }
  } catch (err) {
    console.warn(`[scanLibraryForConcept] page ${page} failed to extract, marking bad and skipping`, err)
    return { status: 'error' }
  }
}

/** Reads a batch of pages concurrently, preserving input order in the output so the caller can process results deterministically even though the reads themselves overlap. */
async function readPageBatch(
  vdoc: Awaited<ReturnType<typeof openLibraryDocument>>,
  pages: number[]
): Promise<Array<{ page: number; outcome: PageReadOutcome }>> {
  return Promise.all(pages.map(async (page) => ({ page, outcome: await readPageWithGuard(vdoc, page) })))
}

export async function scanLibraryForConcept(concept: Concept): Promise<ConceptLibraryScanResult> {
  const terms = [concept.name, ...concept.aliases].filter((t) => t.trim().length >= 3)
  if (terms.length === 0) return { ran: false, booksScanned: 0, pagesScanned: 0, sourcesLinked: 0 }

  const items = await db.libraryItems.toArray()
  const scannable = items.filter(
    (item): item is LibraryItem & { pageCount: number } => typeof item.pageCount === 'number' && item.pageCount > 0
  )
  let booksScanned = 0
  let pagesScanned = 0
  let sourcesLinked = 0

  console.log(`[scanLibraryForConcept:${concept.name}] starting — ${scannable.length} book(s) with pages to check`)

  for (const [bookIndex, item] of scannable.entries()) {
    const bookLabel = `Book ${bookIndex + 1}/${scannable.length} (${item.title})`

    const settingsKey = `${CONCEPT_LIBRARY_SCAN_KEY_PREFIX}${concept.id}:${item.id}`
    const already = await db.appSettings.get(settingsKey)
    const marker = already?.value as ConceptLibraryScanMarker | undefined
    const currentLibraryFingerprint = libraryScanFingerprint(item)

    // A scan marker is valid only for the exact imported-book state it was
    // created for. This matters because the library is mutable: students
    // can add/re-import books after a concept was first scanned. Older
    // markers from the previous implementation intentionally get one fresh
    // scan so books that were incorrectly considered "done" are recovered.
    const markerIsCurrent =
      marker?.scanVersion === CONCEPT_LIBRARY_SCAN_MARKER_VERSION &&
      marker.libraryFingerprint === currentLibraryFingerprint

    if (markerIsCurrent && marker.done === true) continue

    // If the book changed, or this is a legacy marker, start from page 1.
    // If this is our current interrupted marker, resume from its checkpoint.
    const isResumingCurrentScan = markerIsCurrent && marker?.done === false
    const resumeFromPage = isResumingCurrentScan && typeof marker?.lastPageScanned === 'number'
      ? marker.lastPageScanned + 1
      : 1

    // Known-bad pages carry over only when resuming the same unchanged scan.
    // A new/re-imported book gets a clean bad-page set because its pages may
    // now extract successfully.
    const badPages = new Set(isResumingCurrentScan ? marker?.badPages ?? [] : [])

    console.log(`[scanLibraryForConcept:${concept.name}] ${bookLabel} started`)

    let vdoc: Awaited<ReturnType<typeof openLibraryDocument>>
    try {
      vdoc = await openLibraryDocument(item)
    } catch (err) {
      console.warn(`[scanLibraryForConcept:${concept.name}] ${bookLabel} failed to open, skipping`, err)
      await db.appSettings.put({
        key: settingsKey,
        value: {
          ranAt: Date.now(),
          done: true,
          error: 'parse-failed',
          scanVersion: CONCEPT_LIBRARY_SCAN_MARKER_VERSION,
          libraryFingerprint: currentLibraryFingerprint
        }
      })
      continue
    }

    // The stored `item.pageCount` is a cached copy taken at import time;
    // `vdoc.pageCount` is the parser's own live count for this document.
    // When they disagree (re-imported/corrupted metadata), trusting the
    // stale stored value can ask the parser for a page past the end of
    // the document — which for some formats throws deep inside the
    // parser instead of a clean "not found", tripping the same
    // never-resolves shape `readPageWithGuard` exists to catch. Always
    // scanning against the parser's own count avoids that class of bug
    // entirely rather than relying on the guard as the only backstop.
    const effectivePageCount = Math.min(item.pageCount, vdoc.pageCount || item.pageCount)

    let linkedInBook = 0
    let hitCap = false
    let bookPagesScanned = 0
    let lastPageScanned = resumeFromPage - 1
    if (badPages.size > 0) {
      console.log(`[scanLibraryForConcept:${concept.name}] ${bookLabel} skipping ${badPages.size} known-bad page(s) from an earlier scan`)
    }

    for (let batchStart = resumeFromPage; batchStart <= effectivePageCount; batchStart += PAGE_READ_CONCURRENCY) {
      if (bookPagesScanned >= MAX_AUTO_SCAN_PAGES_PER_BOOK_PER_CALL) {
        hitCap = true
        break
      }
      const batchEnd = Math.min(batchStart + PAGE_READ_CONCURRENCY - 1, effectivePageCount)
      const pagesToRead: number[] = []
      for (let page = batchStart; page <= batchEnd; page += 1) {
        lastPageScanned = page
        if (badPages.has(page)) continue // already known bad — no attempt, no wait
        pagesToRead.push(page)
      }

      // The concurrent reads within one batch overlap (so N bad pages'
      // timeouts cost ~N/PAGE_READ_CONCURRENCY, not N, of PAGE_READ_TIMEOUT_MS),
      // but the term-matching/linking work below stays strictly
      // sequential per page — that part is fast (in-memory string work)
      // and keeping it sequential avoids any risk of two pages racing
      // on the same `addConceptSource` idempotency check.
      const results = pagesToRead.length > 0 ? await readPageBatch(vdoc, pagesToRead) : []

      for (const { page, outcome } of results) {
        if (outcome.status === 'timeout' || outcome.status === 'error') {
          badPages.add(page)
          continue
        }
        const { flat: pageText, structured: structuredPageText } = outcome.text
        if (!pageText.trim()) continue
        pagesScanned += 1
        bookPagesScanned += 1
        const lowerPageText = pageText.toLowerCase()

        for (const term of terms) {
          if (!lowerPageText.includes(term.toLowerCase())) continue
          const relevance = applyOwnHeadingRelevanceFloor(scorePageRelevance(pageText, term), structuredPageText, term)
          if (relevance.tier === 'reject') continue
          const source = await addConceptSource({
            // `sourceType: 'pdf'` is really "a page of an imported library
            // item" regardless of the item's actual file format (PDF, EPUB,
            // HTML) — matches every other caller in this file, and is what
            // buildStudyOverview's candidate filter keys on.
            conceptId: concept.id,
            sourceType: 'pdf',
            libraryItemId: item.id,
            pageNumber: page,
            sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
            sourceText: term,
            relevanceTier: relevance.tier,
            extractionQuality: detectExtractionQuality(pageText)
          })
          if (source) {
            sourcesLinked += 1
            linkedInBook += 1
          }
        }
      }

      if (bookPagesScanned >= MAX_AUTO_SCAN_PAGES_PER_BOOK_PER_CALL) {
        hitCap = true
        break
      }
    }

    const badPagesList = Array.from(badPages)
    console.log(
      `[scanLibraryForConcept:${concept.name}] ${bookLabel} pass finished — ` +
      `${bookPagesScanned} readable page(s), ${linkedInBook} source(s) linked`
    )
    if (!hitCap) {
      await db.appSettings.put({
        key: settingsKey,
        value: {
          ranAt: Date.now(),
          done: true,
          linked: linkedInBook,
          badPages: badPagesList,
          scanVersion: CONCEPT_LIBRARY_SCAN_MARKER_VERSION,
          libraryFingerprint: currentLibraryFingerprint
        }
      })
      booksScanned += 1
      console.log(
        `[scanLibraryForConcept:${concept.name}] ${bookLabel} completed — ${linkedInBook} source(s) linked` +
          (badPagesList.length ? `, ${badPagesList.length} bad page(s) skipped` : '')
      )
    } else {
      // Persist how far this book got so the NEXT call resumes instead
      // of re-reading pages 1..lastPageScanned again — without this, a
      // book bigger than one call's page budget could never finish
      // scanning across repeated visits.
      await db.appSettings.put({
        key: settingsKey,
        value: {
          ranAt: Date.now(),
          done: false,
          lastPageScanned,
          linked: linkedInBook,
          badPages: badPagesList,
          scanVersion: CONCEPT_LIBRARY_SCAN_MARKER_VERSION,
          libraryFingerprint: currentLibraryFingerprint
        }
      })
      console.log(
        `[scanLibraryForConcept:${concept.name}] ${bookLabel} paused at page ${lastPageScanned} ` +
        `(${bookPagesScanned} readable pages in this pass) — will resume next call`
      )
      // IMPORTANT: do not break the library loop here.
      // The page ceiling is per book, not global. This book pauses at its
      // checkpoint, but the scanner must continue to the next book so one
      // large textbook cannot monopolize the entire library scan.
    }
  }

  console.log(
    `[scanLibraryForConcept:${concept.name}] Library scan complete — booksScanned=${booksScanned}, pagesScanned=${pagesScanned}, sourcesLinked=${sourcesLinked}`
  )
  return { ran: true, booksScanned, pagesScanned, sourcesLinked }
}
