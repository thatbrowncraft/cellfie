/**
 * core/concepts/service — Sprint 3 write-side operations for Concept,
 * ConceptSource, and ConceptRelation records. Mirrors the shape of
 * core/db/highlights.ts and core/db/notes.ts: mutations live here,
 * read-side access is via `useLiveQuery` directly against `db.concepts`
 * etc. from the module layer.
 */

import { db, type Concept, type ConceptRelation, type ConceptSource, type ConceptSourceType } from '../db'
import { normalizeConceptName } from './normalize'
import { removeAllConceptAssetsFor } from './assets'
import { removeAllMapDataFor } from './mindMapStudio'
import { removeAllStudyNotesFor } from './studyNotes'

export interface ConceptInput {
  name: string
  aliases: string[]
  tags: string[]
  description?: string
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of tags) {
    const t = raw.trim().toLowerCase()
    if (t) seen.add(t)
  }
  return Array.from(seen)
}

function normalizeAliases(aliases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of aliases) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = normalizeConceptName(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** Finds an existing concept by normalized name OR normalized alias — the one deterministic-matching rule the whole extraction/link pipeline relies on (§4). */
export async function findConceptByNameOrAlias(name: string): Promise<Concept | undefined> {
  const key = normalizeConceptName(name)
  if (!key) return undefined
  const byName = await db.concepts.where('normalizedName').equals(key).first()
  if (byName) return byName
  return db.concepts.where('aliases').equals(name.trim()).first()
}

/** Creates a brand-new concept. Callers should check `findConceptByNameOrAlias` first to avoid duplicates. */
export async function createConcept(input: ConceptInput, manuallyCreated: boolean): Promise<Concept> {
  const now = Date.now()
  const concept: Concept = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    normalizedName: normalizeConceptName(input.name),
    aliases: normalizeAliases(input.aliases),
    description: input.description?.trim() || undefined,
    tags: normalizeTags(input.tags),
    manuallyCreated,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  }
  await db.concepts.add(concept)
  return concept
}

/** Finds a matching concept or creates one — the single entry point extraction and manual "add to concept" flows both go through. */
export async function getOrCreateConcept(input: ConceptInput, manuallyCreated: boolean): Promise<Concept> {
  const existing = await findConceptByNameOrAlias(input.name)
  if (existing) {
    // A newly-observed alias/tag still enriches the existing concept
    // (deterministic merge of *evidence*, not a guess about identity —
    // the name/alias already matched exactly).
    const mergedAliases = normalizeAliases([...existing.aliases, ...input.aliases])
    const mergedTags = normalizeTags([...existing.tags, ...input.tags])
    await db.concepts.update(existing.id, {
      aliases: mergedAliases,
      tags: mergedTags,
      lastSeenAt: Date.now(),
      updatedAt: Date.now()
    })
    return { ...existing, aliases: mergedAliases, tags: mergedTags }
  }
  return createConcept(input, manuallyCreated)
}

export async function updateConcept(id: string, input: ConceptInput): Promise<void> {
  await db.concepts.update(id, {
    name: input.name.trim(),
    normalizedName: normalizeConceptName(input.name),
    aliases: normalizeAliases(input.aliases),
    tags: normalizeTags(input.tags),
    description: input.description?.trim() || undefined,
    updatedAt: Date.now()
  })
}

export async function touchConceptSeen(id: string): Promise<void> {
  await db.concepts.update(id, { lastSeenAt: Date.now() })
}

/** Concept 2.0 Phase 5 — saves the user's own memory aid text verbatim. Never called with anything the app generated itself; an empty string clears it back to "not set" rather than storing a blank string. */
export async function updateConceptMemoryAid(id: string, memoryAid: string): Promise<void> {
  await db.concepts.update(id, { memoryAid: memoryAid.trim() || undefined, updatedAt: Date.now() })
}

/** Deletes a concept along with every ConceptSource/ConceptRelation that references it. */
export async function deleteConcept(id: string): Promise<void> {
  await db.transaction('rw', db.concepts, db.conceptSources, db.conceptRelations, async () => {
    await db.concepts.delete(id)
    await db.conceptSources.where('conceptId').equals(id).delete()
    const asA = await db.conceptRelations.where('conceptAId').equals(id).toArray()
    const asB = await db.conceptRelations.where('conceptBId').equals(id).toArray()
    await Promise.all([...asA, ...asB].map((r) => db.conceptRelations.delete(r.id)))
  })
  // Outside the Dexie transaction — this also deletes OPFS files, which
  // shouldn't run inside an IndexedDB transaction's lifetime.
  await removeAllConceptAssetsFor(id)
  await removeAllMapDataFor(id)
  await removeAllStudyNotesFor(id)
}

export interface LinkSourceInput {
  conceptId: string
  sourceType: ConceptSourceType
  libraryItemId?: string
  pageNumber?: number
  sourceId?: string
  sourceText?: string
  /** Relevance Correction — only meaningful for `pdf` sources; see ConceptSource. */
  relevanceTier?: 'high' | 'relevant' | 'weak'
}

/**
 * Links a Concept to one real piece of evidence. Idempotent: won't create
 * a duplicate row for the same (conceptId, sourceType, sourceId) triple —
 * every path that calls this (manual "add to concept", extraction, PDF
 * scan) can call it freely without pre-checking for dupes itself.
 */
export async function addConceptSource(input: LinkSourceInput): Promise<ConceptSource | undefined> {
  if (input.sourceId) {
    const existing = await db.conceptSources
      .where('conceptId')
      .equals(input.conceptId)
      .filter((s) => s.sourceType === input.sourceType && s.sourceId === input.sourceId)
      .first()
    if (existing) return existing
  }
  const source: ConceptSource = {
    id: crypto.randomUUID(),
    conceptId: input.conceptId,
    sourceType: input.sourceType,
    libraryItemId: input.libraryItemId,
    pageNumber: input.pageNumber,
    sourceId: input.sourceId,
    sourceText: input.sourceText,
    relevanceTier: input.relevanceTier,
    createdAt: Date.now()
  }
  await db.conceptSources.add(source)
  await touchConceptSeen(input.conceptId)
  return source
}

export async function removeConceptSource(id: string): Promise<void> {
  await db.conceptSources.delete(id)
}

/** Removes every ConceptSource pointing at a given highlight/note/bookmark id — called when that record is deleted, so links don't dangle. */
export async function removeConceptSourcesForRecord(sourceType: ConceptSourceType, sourceId: string): Promise<void> {
  await db.conceptSources.where('sourceId').equals(sourceId).filter((s) => s.sourceType === sourceType).delete()
}

/** Creates an explicit, user-asserted ("My connection") relation between two concepts (§10 rule 1). Undirected and de-duplicated regardless of argument order — if a relation (of either origin) already exists for this pair, that existing row is returned rather than creating a second one. */
export async function addConceptRelation(conceptAId: string, conceptBId: string): Promise<ConceptRelation | undefined> {
  if (conceptAId === conceptBId) return undefined
  const [a, b] = [conceptAId, conceptBId].sort()
  const existing = await db.conceptRelations
    .where('[conceptAId+conceptBId]')
    .equals([a, b])
    .first()
  if (existing) return existing
  const relation: ConceptRelation = {
    id: crypto.randomUUID(),
    conceptAId: a,
    conceptBId: b,
    origin: 'manual',
    createdAt: Date.now()
  }
  await db.conceptRelations.add(relation)
  return relation
}

export async function removeConceptRelation(id: string): Promise<void> {
  await db.conceptRelations.delete(id)
}

export async function getRelatedConceptIds(conceptId: string): Promise<string[]> {
  const [asA, asB] = await Promise.all([
    db.conceptRelations.where('conceptAId').equals(conceptId).toArray(),
    db.conceptRelations.where('conceptBId').equals(conceptId).toArray()
  ])
  return [...asA.map((r) => r.conceptBId), ...asB.map((r) => r.conceptAId)]
}

const SCIENTIFIC_RELATION_PURGE_KEY = 'scientificRelationPurge:v1'

/**
 * Concept Hub Refinement §3/§4/§5/§15 — one-time cleanup that deletes
 * every 'scientific'-origin ConceptRelation row ever written by the
 * now-removed automatic co-occurrence discovery (formerly
 * `discoverScientificRelations`/`addScientificConceptRelation`, both
 * deleted — literature co-occurrence must never again be written as a
 * Concept-to-Concept relationship). This is the actual data-layer fix:
 * ConceptDetailPage.tsx and core/concepts/graph.ts also filter reads to
 * `origin === 'manual'` as defense in depth, but this purge is what
 * makes a bad edge (e.g. an existing "DNA \u2194 Gram staining" row from
 * a prior version of the app) actually gone from IndexedDB, not merely
 * hidden. Idempotent and safe to call unconditionally on every app
 * boot — the `appSettings` flag makes every run after the first a
 * single cheap lookup.
 */
export async function purgeAutomaticScientificRelations(): Promise<{ ran: boolean; deleted: number }> {
  const already = await db.appSettings.get(SCIENTIFIC_RELATION_PURGE_KEY)
  if (already) return { ran: false, deleted: 0 }
  const stale = await db.conceptRelations.where('origin').equals('scientific').toArray()
  await Promise.all(stale.map((r) => db.conceptRelations.delete(r.id)))
  await db.appSettings.put({ key: SCIENTIFIC_RELATION_PURGE_KEY, value: { ranAt: Date.now(), deleted: stale.length } })
  return { ran: true, deleted: stale.length }
}

// ---------------------------------------------------------------------
// Knowledge Model Correction — "Concepts are USER-SELECTED objects."
// Everything below exists so a PDF/search match can only ever become a
// Concept through one explicit moment: the person clicking "Add
// concept"/"Add to Concepts". Nothing in core/concepts/extraction.ts or
// librarySearch.ts calls these on its own.
// ---------------------------------------------------------------------

export interface ConceptCandidateEvidence {
  libraryItemId: string
  pageNumber: number
  sourceText?: string
}

/**
 * The single write path for turning a source candidate (a "Related
 * concepts found in your sources" suggestion, or a library search
 * result) into a real Concept record. Always `manuallyCreated: true` —
 * an explicit "Add concept" click counts as user-selection every bit as
 * much as the "+ New Concept" form does, and must never be swept up by
 * `runAutoConceptCleanup` later. If `relateToConceptId` is given, an
 * explicit manual relation is recorded to the concept the person was
 * looking at when they promoted this candidate (§16).
 */
export async function promoteConceptCandidate(input: {
  name: string
  evidence: ConceptCandidateEvidence[]
  relateToConceptId?: string
}): Promise<Concept> {
  const concept = await getOrCreateConcept({ name: input.name, aliases: [], tags: [] }, true)
  for (const e of input.evidence) {
    await addConceptSource({
      conceptId: concept.id,
      sourceType: 'pdf',
      libraryItemId: e.libraryItemId,
      pageNumber: e.pageNumber,
      sourceId: `${e.libraryItemId}:${e.pageNumber}:${normalizeConceptName(input.name)}`,
      sourceText: e.sourceText ?? input.name
    })
  }
  if (input.relateToConceptId) await addConceptRelation(input.relateToConceptId, concept.id)
  return concept
}

const AUTO_CONCEPT_CLEANUP_KEY = 'sprint3ConceptCleanup:v1'

export interface ConceptCleanupResult {
  /** False if the cleanup had already run before (or already been skipped) — safe to call unconditionally on every app boot. */
  ran: boolean
  removed: number
}

/**
 * Knowledge Model Correction §18 — one-time removal of concepts that
 * were silently auto-created from raw PDF text before this correction
 * (chemical formula fragments like "CH H"/"COOH", publisher names,
 * sentence fragments, and similar). Distinguishes safely using the
 * `manuallyCreated` flag every Concept has always been created with —
 * `true` for "+ New Concept", the reader's concept picker, and (from
 * this correction onward) every explicit "Add concept" promotion; `false`
 * only for the old blind bulk-extraction paths. Cascades to that
 * concept's own ConceptSource/ConceptRelation rows (they only existed to
 * serve the garbage concept) but never touches books, PDFs, notes,
 * highlights, bookmarks, collections, or any source record belonging to
 * a surviving concept. Gated by an `appSettings` flag so it runs at most
 * once — safe to call unconditionally on every app boot.
 */
export async function runAutoConceptCleanup(): Promise<ConceptCleanupResult> {
  const already = await db.appSettings.get(AUTO_CONCEPT_CLEANUP_KEY)
  if (already) return { ran: false, removed: 0 }

  const all = await db.concepts.toArray()
  const toRemove = all.filter((c) => !c.manuallyCreated)

  await db.transaction('rw', db.concepts, db.conceptSources, db.conceptRelations, db.appSettings, async () => {
    for (const concept of toRemove) {
      await db.concepts.delete(concept.id)
      await db.conceptSources.where('conceptId').equals(concept.id).delete()
      const asA = await db.conceptRelations.where('conceptAId').equals(concept.id).toArray()
      const asB = await db.conceptRelations.where('conceptBId').equals(concept.id).toArray()
      await Promise.all([...asA, ...asB].map((r) => db.conceptRelations.delete(r.id)))
    }
    await db.appSettings.put({ key: AUTO_CONCEPT_CLEANUP_KEY, value: { removedCount: toRemove.length, ranAt: Date.now() } })
  })

  return { ran: true, removed: toRemove.length }
}
