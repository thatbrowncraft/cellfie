// src/core/concepts/service.ts

import { db, type Concept, type ConceptRelation, type ConceptSource } from '@/core/db'
import { parseScientificTextToSections, type KnowledgeSection } from './onlineKnowledge'

export interface ConceptInput {
  name: string
  aliases?: string[]
  tags?: string[]
  description?: string
}

/**
 * Retrieves an existing concept by name or creates a new one.
 * Accepts either an object { name, aliases, tags } or positional parameters (name, aliases).
 */
export async function getOrCreateConcept(
  input: string | ConceptInput,
  aliasesArg: string[] = []
): Promise<Concept> {
  const name = typeof input === 'string' ? input : input.name
  const aliases = typeof input === 'string' ? aliasesArg : (input.aliases ?? [])
  const tags = typeof input === 'object' && Array.isArray(input.tags) ? input.tags : []
  const description = typeof input === 'object' ? input.description : undefined

  const normalizedName = name.trim()
  const existing = await db.concepts.where('name').equalsIgnoreCase(normalizedName).first()
  if (existing) return existing

  const newConceptPayload = {
    name: normalizedName,
    aliases,
    tags,
    ...(description ? { description } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const id = await db.concepts.add(newConceptPayload as Concept)
  const created = await db.concepts.get(id)
  return created!
}

/**
 * Links a source (book page, highlight, note) to a concept.
 */
export async function addConceptSource(
  source: Omit<ConceptSource, 'id' | 'createdAt'>
): Promise<ConceptSource> {
  const newSourcePayload = {
    ...source,
    createdAt: new Date().toISOString()
  }
  const id = await db.conceptSources.add(newSourcePayload as ConceptSource)
  const created = await db.conceptSources.get(id)
  return created!
}

/**
 * Removes concept sources linked to a deleted highlight, note, or record.
 */
export async function removeConceptSourcesForRecord(
  sourceType: ConceptSource['sourceType'],
  recordId: string | number
): Promise<void> {
  const sources = await db.conceptSources.where('sourceType').equals(sourceType).toArray()
  const toDelete = sources.filter(
    (s) =>
      s.highlightId === recordId ||
      s.noteId === recordId ||
      s.libraryItemId === recordId ||
      s.id === recordId
  )
  if (toDelete.length > 0) {
    await db.conceptSources.bulkDelete(toDelete.map((s) => s.id))
  }
}

/**
 * Background routine to clean orphaned concept links or unused entries.
 */
export async function runAutoConceptCleanup(): Promise<void> {
  const allSources = await db.conceptSources.toArray()
  const allConcepts = await db.concepts.toArray()
  const conceptIds = new Set(allConcepts.map((c) => String(c.id)))

  const orphanedSources = allSources.filter((s) => !conceptIds.has(String(s.conceptId)))
  if (orphanedSources.length > 0) {
    await db.conceptSources.bulkDelete(orphanedSources.map((s) => s.id))
  }
}

/**
 * Deletes a concept and all associated source/relation mappings.
 */
export async function deleteConcept(conceptId: string | number): Promise<void> {
  await db.transaction('rw', [db.concepts, db.conceptSources, db.conceptRelations], async () => {
    await db.concepts.delete(conceptId as any)
    await db.conceptSources.where('conceptId').equals(conceptId as any).delete()
    await db.conceptRelations.where('conceptAId').equals(conceptId as any).delete()
    await db.conceptRelations.where('conceptBId').equals(conceptId as any).delete()
  })
}

/**
 * Extracts related concept IDs from Dexie relations.
 */
export async function getRelatedConceptIds(conceptId: string | number): Promise<string[]> {
  const relsA = await db.conceptRelations.where('conceptAId').equals(conceptId as any).toArray()
  const relsB = await db.conceptRelations.where('conceptBId').equals(conceptId as any).toArray()
  const ids = new Set<string>()
  for (const r of relsA) ids.add(String(r.conceptBId))
  for (const r of relsB) ids.add(String(r.conceptAId))
  return Array.from(ids)
}

/**
 * Finds concepts that co-occur in the same library item/page.
 */
export async function getCoOccurrenceRelated(
  conceptId: string | number
): Promise<Array<{ concept: Concept; sharedSources: ConceptSource[] }>> {
  const sources = await db.conceptSources.where('conceptId').equals(conceptId as any).toArray()
  if (sources.length === 0) return []

  const itemPageKeys = new Set(
    sources.filter((s) => s.libraryItemId && s.pageNumber != null).map((s) => `${s.libraryItemId}:${s.pageNumber}`)
  )

  if (itemPageKeys.size === 0) return []

  const allSources = await db.conceptSources.toArray()
  const coMap = new Map<string, ConceptSource[]>()

  for (const s of allSources) {
    if (String(s.conceptId) === String(conceptId) || !s.libraryItemId || s.pageNumber == null) continue
    const key = `${s.libraryItemId}:${s.pageNumber}`
    if (itemPageKeys.has(key)) {
      const cId = String(s.conceptId)
      const existing = coMap.get(cId) ?? []
      existing.push(s)
      coMap.set(cId, existing)
    }
  }

  const result: Array<{ concept: Concept; sharedSources: ConceptSource[] }> = []
  for (const [otherId, sharedSources] of coMap.entries()) {
    const queryKey = isNaN(Number(otherId)) ? otherId : Number(otherId)
    const c = await db.concepts.get(queryKey as any)
    if (c) {
      result.push({ concept: c, sharedSources })
    }
  }

  return result
}

/**
 * Parses local book description or source text into structured study sections.
 */
export function buildLocalKnowledgeSections(description?: string, highlightText?: string): KnowledgeSection[] {
  const sourceMaterial = description || highlightText
  if (!sourceMaterial) return []
  return parseScientificTextToSections(sourceMaterial)
}
