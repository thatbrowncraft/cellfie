// src/core/concepts/service.ts

import { db, type Concept, type ConceptRelation, type ConceptSource, type LibraryItem } from '@/core/db'
import { cleanPdfText, parseScientificTextToSections, type KnowledgeSection } from './onlineKnowledge'

export interface ConceptInput {
  name: string
  aliases?: string[]
  tags?: string[]
}

/**
 * Retrieves an existing concept by name or creates a new one.
 * Accepts either an object { name, aliases, tags } or positional (name, aliases).
 */
export async function getOrCreateConcept(
  input: string | ConceptInput,
  defaultAliases: string[] = []
): Promise<Concept> {
  const name = typeof input === 'string' ? input : input.name
  const aliases = typeof input === 'string' ? defaultAliases : (input.aliases ?? [])
  const tags = typeof input === 'object' && input.tags ? input.tags : []

  const normalizedName = name.trim()
  const existing = await db.concepts.where('name').equalsIgnoreCase(normalizedName).first()
  if (existing) return existing

  const newConcept: Concept = {
    id: crypto.randomUUID(),
    name: normalizedName,
    aliases,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  await db.concepts.add(newConcept)
  return newConcept
}

/**
 * Links a source (book page, highlight, note) to a concept.
 */
export async function addConceptSource(
  source: Omit<ConceptSource, 'id' | 'createdAt'>
): Promise<ConceptSource> {
  const newSource: ConceptSource = {
    ...source,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  }
  await db.conceptSources.add(newSource)
  return newSource
}

/**
 * Background routine to clean orphaned concept links or unused entries.
 */
export async function runAutoConceptCleanup(): Promise<void> {
  const allSources = await db.conceptSources.toArray()
  const allConcepts = await db.concepts.toArray()
  const conceptIds = new Set(allConcepts.map((c) => c.id))

  const orphanedSources = allSources.filter((s) => !conceptIds.has(s.conceptId))
  if (orphanedSources.length > 0) {
    await db.conceptSources.bulkDelete(orphanedSources.map((s) => s.id))
  }
}

/**
 * Computes locally derived statistics for a concept.
 */
export function computeConceptStats(
  concept: Concept,
  sources: ConceptSource[]
): { bookCount: number; pageCount: number; highlightCount: number; noteCount: number } {
  const bookIds = new Set<string>()
  const pages = new Set<string>()
  let highlightCount = 0
  let noteCount = 0

  for (const s of sources) {
    if (s.libraryItemId) {
      bookIds.add(s.libraryItemId)
      if (s.pageNumber != null) {
        pages.add(`${s.libraryItemId}:${s.pageNumber}`)
      }
    }
    if (s.sourceType === 'highlight') highlightCount++
    if (s.sourceType === 'note') noteCount++
  }

  return {
    bookCount: bookIds.size,
    pageCount: pages.size,
    highlightCount,
    noteCount
  }
}

/**
 * Deletes a concept and all associated source/relation mappings.
 */
export async function deleteConcept(conceptId: string): Promise<void> {
  await db.transaction('rw', [db.concepts, db.conceptSources, db.conceptRelations], async () => {
    await db.concepts.delete(conceptId)
    await db.conceptSources.where('conceptId').equals(conceptId).delete()
    await db.conceptRelations.where('conceptIdA').equals(conceptId).delete()
    await db.conceptRelations.where('conceptIdB').equals(conceptId).delete()
  })
}

/**
 * Extracts related concept IDs from Dexie relations.
 */
export async function getRelatedConceptIds(conceptId: string): Promise<string[]> {
  const relsA = await db.conceptRelations.where('conceptIdA').equals(conceptId).toArray()
  const relsB = await db.conceptRelations.where('conceptIdB').equals(conceptId).toArray()
  const ids = new Set<string>()
  for (const r of relsA) ids.add(r.conceptIdB)
  for (const r of relsB) ids.add(r.conceptIdA)
  return Array.from(ids)
}

/**
 * Finds concepts that co-occur in the same library item/page.
 */
export async function getCoOccurrenceRelated(
  conceptId: string
): Promise<Array<{ concept: Concept; sharedSources: ConceptSource[] }>> {
  const sources = await db.conceptSources.where('conceptId').equals(conceptId).toArray()
  if (sources.length === 0) return []

  const itemPageKeys = new Set(
    sources.filter((s) => s.libraryItemId && s.pageNumber != null).map((s) => `${s.libraryItemId}:${s.pageNumber}`)
  )

  if (itemPageKeys.size === 0) return []

  const allSources = await db.conceptSources.toArray()
  const coMap = new Map<string, ConceptSource[]>()

  for (const s of allSources) {
    if (s.conceptId === conceptId || !s.libraryItemId || s.pageNumber == null) continue
    const key = `${s.libraryItemId}:${s.pageNumber}`
    if (itemPageKeys.has(key)) {
      const existing = coMap.get(s.conceptId) ?? []
      existing.push(s)
      coMap.set(s.conceptId, existing)
    }
  }

  const result: Array<{ concept: Concept; sharedSources: ConceptSource[] }> = []
  for (const [otherId, sharedSources] of coMap.entries()) {
    const c = await db.concepts.get(otherId)
    if (c) {
      result.push({ concept: c, sharedSources })
    }
  }

  return result
}

/**
 * Finds the first and last encountered source references.
 */
export function getFirstAndLastEncountered(
  sources: ConceptSource[],
  itemsById: Map<string, LibraryItem>
): {
  first?: { bookTitle: string; pageNumber: number; libraryItemId: string }
  last?: { bookTitle: string; pageNumber: number; libraryItemId: string }
} {
  const valid = sources
    .filter((s) => s.libraryItemId && s.pageNumber != null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (valid.length === 0) return {}

  const firstSource = valid[0]
  const lastSource = valid[valid.length - 1]

  const firstBook = itemsById.get(firstSource.libraryItemId!)
  const lastBook = itemsById.get(lastSource.libraryItemId!)

  return {
    first: firstBook ? { bookTitle: firstBook.title, pageNumber: firstSource.pageNumber!, libraryItemId: firstBook.id } : undefined,
    last: lastBook ? { bookTitle: lastBook.title, pageNumber: lastSource.pageNumber!, libraryItemId: lastBook.id } : undefined
  }
}

/**
 * Parses local book description or source text into structured study sections.
 */
export function buildLocalKnowledgeSections(description?: string, highlightText?: string): KnowledgeSection[] {
  const sourceMaterial = description || highlightText
  if (!sourceMaterial) return []
  return parseScientificTextToSections(sourceMaterial)
}
