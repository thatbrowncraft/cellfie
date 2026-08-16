/**
 * core/concepts/sectionEdits — Book-First Learning Engine, Phase 2.
 *
 * The optional "Edit" layer over Learn's three major sections (Quick
 * Revision / Core Concept / Exam Focus). Deliberately separate from
 * `ConceptStudyNote` ("My Study Notes" — the person's own ADDED notes,
 * always additive, never replacing anything) and from the source data
 * itself (a `CuratedLesson`, a book's `StudyOverview`, or MeSH/PubChem
 * `DetailedStudyModule`s) — none of those are ever written to. An edit
 * here only ever changes what's DISPLAYED for one section, and only for
 * this concept; the original is always kept, so "Restore original" is
 * always possible.
 */
import { db, type ConceptSectionEdit } from '../db'

export async function getSectionEdit(conceptId: string, sectionKey: string): Promise<ConceptSectionEdit | undefined> {
  return db.conceptSectionEdits.where('[conceptId+sectionKey]').equals([conceptId, sectionKey]).first()
}

/**
 * Creates or updates the edit for this section. `originalText` is only
 * ever stored on the FIRST save for a given section — if an edit already
 * exists, its original snapshot is kept as-is (editing an already-edited
 * section again must never overwrite what "Restore original" restores
 * to with a previously-edited version of itself).
 */
export async function saveSectionEdit(conceptId: string, sectionKey: string, originalText: string, editedText: string): Promise<void> {
  const trimmed = editedText.trim()
  if (!trimmed) return
  const now = Date.now()
  const existing = await getSectionEdit(conceptId, sectionKey)
  if (existing) {
    await db.conceptSectionEdits.update(existing.id, { editedText: trimmed, updatedAt: now })
  } else {
    await db.conceptSectionEdits.add({
      id: crypto.randomUUID(),
      conceptId,
      sectionKey,
      originalText,
      editedText: trimmed,
      createdAt: now,
      updatedAt: now
    })
  }
}

/** Deletes the edit outright — the section goes back to showing its original source-derived content, exactly as it looked before any edit existed. */
export async function restoreSectionEdit(conceptId: string, sectionKey: string): Promise<void> {
  const existing = await getSectionEdit(conceptId, sectionKey)
  if (existing) await db.conceptSectionEdits.delete(existing.id)
}
