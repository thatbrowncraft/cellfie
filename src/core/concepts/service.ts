/**
 * core/concepts/service — Sprint 3 write-side operations for Concept,
 * ConceptSource, and ConceptRelation records. Mirrors the shape of
 * core/db/highlights.ts and core/db/notes.ts: mutations live here,
 * read-side access is via `useLiveQuery` directly against `db.concepts`
 * etc. from the module layer.
 */

import { db, type Concept, type ConceptRelation, type ConceptSource, type ConceptSourceType } from '../db'
import { normalizeConceptName } from './normalize'
import { fetchScientificRelationEvidence, isLikelyOnline, type ScientificRelationEvidence } from './onlineKnowledge'

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

/** Deletes a concept along with every ConceptSource/ConceptRelation that references it. */
export async function deleteConcept(id: string): Promise<void> {
  await db.transaction('rw', db.concepts, db.conceptSources, db.conceptRelations, async () => {
    await db.concepts.delete(id)
    await db.conceptSources.where('conceptId').equals(id).delete()
    const asA = await db.conceptRelations.where('conceptAId').equals(id).toArray()
    const asB = await db.conceptRelations.where('conceptBId').equals(id).toArray()
    await Promise.all([...asA, ...asB].map((r) => db.conceptRelations.delete(r.id)))
  })
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

/**
 * Concept 2.0 Phase 2 — records an evidence-backed ("Scientific
 * connection") relation. Never called from a click; only from
 * `discoverScientificRelations` below, once `fetchScientificRelationEvidence`
 * has actually found a real source. Same de-dupe rule as
 * `addConceptRelation`: a pair that already has a relation (either
 * origin) keeps its existing row rather than getting a second edge.
 */
export async function addScientificConceptRelation(
  conceptAId: string,
  conceptBId: string,
  evidence: ScientificRelationEvidence
): Promise<ConceptRelation | undefined> {
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
    origin: 'scientific',
    relationType: evidence.relationType,
    evidence: evidence.evidence,
    sourceName: evidence.sourceName,
    sourceUrl: evidence.sourceUrl,
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

const SCIENTIFIC_DISCOVERY_KEY_PREFIX = 'scientificRelationDiscovery:v1:'
/** Soft ceiling on how many of the person's OTHER concepts get checked per visit — a large library shouldn't turn one page-open into dozens of sequential PubMed calls. */
const MAX_DISCOVERY_PEERS = 15

export interface ScientificDiscoveryResult {
  /** False when this concept was already checked before (or we're offline) — safe to call unconditionally on every visit. */
  ran: boolean
  checked: number
  found: number
}

/**
 * Concept 2.0 Phase 2 — one-time, per-concept pass that checks this
 * concept against up to `MAX_DISCOVERY_PEERS` of the person's OTHER
 * existing concepts (not yet related to it) for real evidence of a
 * scientific relationship (see `fetchScientificRelationEvidence`), and
 * stores a `'scientific'`-origin `ConceptRelation` for every real hit.
 * Deliberately does NOT try to discover brand-new concepts online —
 * that's `fetchOnlineRelated`'s job (surfaced as "Suggested scientific
 * concepts", added to the library only on an explicit click). This
 * function only ever connects concepts the person already has. Gated by
 * an `appSettings` flag per concept (same pattern as
 * `backfillSourceRelevance`), so it's safe to call unconditionally on
 * every concept-detail visit; a library that grows later gets checked
 * again the next time this concept's flag is cleared (it currently
 * isn't — matches "run once per concept" scope for this phase).
 */
export async function discoverScientificRelations(conceptId: string): Promise<ScientificDiscoveryResult> {
  const settingsKey = `${SCIENTIFIC_DISCOVERY_KEY_PREFIX}${conceptId}`
  const already = await db.appSettings.get(settingsKey)
  if (already) return { ran: false, checked: 0, found: 0 }
  if (!isLikelyOnline()) return { ran: false, checked: 0, found: 0 }

  const concept = await db.concepts.get(conceptId)
  if (!concept) return { ran: false, checked: 0, found: 0 }

  const [allConcepts, asA, asB] = await Promise.all([
    db.concepts.toArray(),
    db.conceptRelations.where('conceptAId').equals(conceptId).toArray(),
    db.conceptRelations.where('conceptBId').equals(conceptId).toArray()
  ])
  const alreadyRelatedIds = new Set([...asA.map((r) => r.conceptBId), ...asB.map((r) => r.conceptAId)])

  const peers = allConcepts
    .filter((c) => c.id !== conceptId && !alreadyRelatedIds.has(c.id))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_DISCOVERY_PEERS)

  let found = 0
  // Sequential, not Promise.all — this hits a public API per pair and
  // shouldn't fire a burst of simultaneous requests (same discipline as
  // RelatedConceptsPanel's existing candidate-verification loop).
  for (const peer of peers) {
    const evidence = await fetchScientificRelationEvidence(concept.name, peer.name)
    if (evidence) {
      await addScientificConceptRelation(conceptId, peer.id, evidence)
      found += 1
    }
  }

  await db.appSettings.put({ key: settingsKey, value: { ranAt: Date.now(), checked: peers.length, found } })
  return { ran: true, checked: peers.length, found }
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
 * explicit RELATED_TO relation is recorded to the concept the person was
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
