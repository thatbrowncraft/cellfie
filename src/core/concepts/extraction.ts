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
import { getPageTextContent, joinPageText, loadPdfDocument } from '../pdf-engine'
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
    const pageText = joinPageText(textItems)
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
export function extractCandidatePhrases(pageText: string): string[] {
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
        const source = await addConceptSource({
          conceptId: other.id,
          sourceType: 'pdf',
          libraryItemId: item.id,
          pageNumber: page,
          sourceId: `${item.id}:${page}:${normalizeConceptName(term)}`,
          sourceText: term
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

export interface SourceExcerpt {
  libraryItemId: string
  pageNumber: number
  text: string
}

/**
 * Knowledge Model Correction §8 — on-demand only (never called
 * automatically): reads a single page and returns a short excerpt of
 * raw, unedited text around the concept's first literal occurrence.
 * This is source-derived *context*, clearly not an authored definition —
 * the caller is responsible for labeling it as a quoted excerpt, not a
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
  const idx = pageText.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return undefined
  const start = Math.max(0, idx - 120)
  const end = Math.min(pageText.length, idx + term.length + 120)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < pageText.length ? '…' : ''
  return { libraryItemId: item.id, pageNumber, text: `${prefix}${pageText.slice(start, end).trim()}${suffix}` }
}
