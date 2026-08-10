// src/core/concepts/service.ts

import { db, type Concept, type ConceptSource } from '@/core/db'
import { parseScientificTextToSections, type KnowledgeSection } from './onlineKnowledge'

export interface ConceptInput {
  name: string
  aliases?: string[]
  tags?: string[]
  description?: string
}

/**
 * Retrieves an existing concept by name or creates a new one.
 * Supports passing either an input object ({ name, aliases, tags }) or a string.
 */
export async function getOrCreateConcept(
  input: string | ConceptInput
): Promise<Concept> {
  const name = typeof input === 'string' ? input : input.name
  const aliases = typeof input === 'string' ? [] : (input.aliases ?? [])
  const tags = typeof input === 'object' && Array.isArray(input.tags) ? input.tags : []
  const description = typeof input === 'object' ? input.description : undefined

  const normalizedName = name.trim()
  const existing = await db.concepts.where('name').equalsIgnoreCase(normalizedName).first()
  if (existing) return existing

  const newConcept: Concept = {
    id: crypto.randomUUID(),
    name: normalizedName,
    aliases,
    tags,
    ...(description ? { description } : {}),
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
 * Parses local book description or source text into structured study sections.
 */
export function buildLocalKnowledgeSections(description?: string, highlightText?: string): KnowledgeSection[] {
  const sourceMaterial = description || highlightText
  if (!sourceMaterial) return []
  return parseScientificTextToSections(sourceMaterial)
}
