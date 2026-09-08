/**
 * core/concepts/customSections — Concept Online Knowledge Enrichment
 * brief. Small, purely additive persistence for:
 *
 *   1. User-created custom Concept sections (`ConceptCustomSection`) —
 *      created only via "+ Create new section" inside the Online
 *      Knowledge enrichment flow.
 *   2. Applied Online Knowledge excerpts (`ConceptOnlineKnowledgeEntry`)
 *      — sentence(s) the person explicitly selected and sent to a
 *      Concept section (a fixed Learn-tab section OR a custom one).
 *
 * Deliberately its own module, separate from `sectionEdits.ts` (which
 * REPLACES what a fixed Learn section displays) and `studyNotes.ts`
 * (the person's own free-text "My Study Notes" blocks) — this data is
 * neither of those: it's source-attributed excerpt content the person
 * chose to add, always shown with its own provenance, never merged
 * into curated content or another person's data.
 */
import { db, type ConceptCustomSection, type ConceptOnlineKnowledgeEntry } from '../db'

export async function listCustomSections(conceptId: string): Promise<ConceptCustomSection[]> {
  const rows = await db.conceptCustomSections.where('conceptId').equals(conceptId).toArray()
  return rows.sort((a, b) => a.order - b.order)
}

/** Creates a new user-owned Concept section. Title is whatever the person typed — never invented, never validated against any curated vocabulary. */
export async function createCustomSection(conceptId: string, title: string): Promise<ConceptCustomSection> {
  const trimmed = title.trim()
  const existing = await listCustomSections(conceptId)
  const section: ConceptCustomSection = {
    id: crypto.randomUUID(),
    conceptId,
    title: trimmed || 'Untitled section',
    order: existing.length,
    createdAt: Date.now()
  }
  await db.conceptCustomSections.add(section)
  return section
}

/** Deletes a custom section and every Online Knowledge entry filed under it. Never touches entries filed under the fixed Learn-tab sections or any other custom section. */
export async function deleteCustomSection(conceptId: string, sectionId: string): Promise<void> {
  await db.conceptOnlineKnowledgeEntries.where('[conceptId+sectionKey]').equals([conceptId, sectionId]).delete()
  await db.conceptCustomSections.delete(sectionId)
}

export async function listOnlineKnowledgeEntries(conceptId: string, sectionKey: string): Promise<ConceptOnlineKnowledgeEntry[]> {
  const rows = await db.conceptOnlineKnowledgeEntries.where('[conceptId+sectionKey]').equals([conceptId, sectionKey]).toArray()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export interface AppliedKnowledgeInput {
  text: string
  sourceName: string
  sourceUrl: string
  attributionNotice?: string
}

/**
 * Applies a selected Online Knowledge excerpt to a Concept section.
 * `sectionKey` may be one of the three fixed Learn-tab keys or a
 * `ConceptCustomSection.id` — this function treats both identically, by
 * design (brief: "a custom section works identically to a built-in
 * one"). Purely additive: never overwrites or removes any existing
 * entry, mirroring Comparison Studio's "a used sentence can still be
 * sent to another section" behavior — the same source text can be
 * applied to more than one section if the person chooses to.
 */
export async function addOnlineKnowledgeEntry(conceptId: string, sectionKey: string, input: AppliedKnowledgeInput): Promise<ConceptOnlineKnowledgeEntry> {
  const entry: ConceptOnlineKnowledgeEntry = {
    id: crypto.randomUUID(),
    conceptId,
    sectionKey,
    text: input.text,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    attributionNotice: input.attributionNotice,
    createdAt: Date.now()
  }
  await db.conceptOnlineKnowledgeEntries.add(entry)
  return entry
}

export async function deleteOnlineKnowledgeEntry(id: string): Promise<void> {
  await db.conceptOnlineKnowledgeEntries.delete(id)
}
