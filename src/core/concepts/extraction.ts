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
import { isLikelyStopwordPhrase, isPlausibleConceptName, normalizeConceptName } from './normalize'

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
function looksLikeConceptPhrase(raw: string): boolean {
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
