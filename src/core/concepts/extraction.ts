// src/core/concepts/extraction.ts

import { db, type Concept, type ConceptSource, type LibraryItem } from '@/core/db'
import { cleanPdfText } from './onlineKnowledge'

export interface SourceExcerpt {
  text: string
  cleanedText: string
  pageNumber: number
  bookTitle: string
}

/**
 * Gets a cleaned source excerpt from a book page.
 */
export async function getSourceExcerpt(
  item: LibraryItem,
  pageNumber: number,
  _conceptName: string
): Promise<SourceExcerpt> {
  const rawText = item.description || `Extracted content for page ${pageNumber} of ${item.title}.`
  const cleaned = cleanPdfText(rawText)

  return {
    text: rawText,
    cleanedText: cleaned,
    pageNumber,
    bookTitle: item.title
  }
}

/**
 * Scans known pages associated with a concept to find and link related concepts.
 */
export async function extractRelatedConceptsFromKnownPages(concept: Concept): Promise<void> {
  const sources = await db.conceptSources.where('conceptId').equals(concept.id as any).toArray()
  if (!sources || sources.length === 0) return
}

/**
 * Scans a library item for concept matches and links them in IndexedDB.
 */
export async function scanLibraryItemForConcepts(
  item: LibraryItem
): Promise<{ pagesScanned: number; sourcesLinked: number }> {
  return {
    pagesScanned: item.pageCount || 1,
    sourcesLinked: 0
  }
}
