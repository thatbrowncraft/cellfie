/**
 * core/concepts/studyNotes — Second Refinement §Part 2. CRUD for
 * `ConceptStudyNote`: the person's own blocks under Core Concept /
 * Quick Revision / Exam Focus. Every value here is exactly what the
 * person typed — no rewriting, no summarizing, no generation. Order is
 * a plain integer the person controls via "move up"/"move down"; a new
 * block is appended after the current highest order in its section.
 */

import { db, type ConceptNoteBlockType, type ConceptNoteSection, type ConceptStudyNote } from '../db'

export async function listStudyNotes(conceptId: string, section: ConceptNoteSection): Promise<ConceptStudyNote[]> {
  const all = await db.conceptStudyNotes.where('[conceptId+section]').equals([conceptId, section]).toArray()
  return all.sort((a, b) => a.order - b.order)
}

export async function addStudyNote(
  conceptId: string,
  section: ConceptNoteSection,
  blockType: ConceptNoteBlockType,
  content: string,
  title?: string
): Promise<ConceptStudyNote | undefined> {
  const trimmedContent = content.trim()
  if (!trimmedContent) return undefined
  const existing = await listStudyNotes(conceptId, section)
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((n) => n.order)) + 1 : 0
  const now = Date.now()
  const note: ConceptStudyNote = {
    id: crypto.randomUUID(),
    conceptId,
    section,
    blockType,
    title: title?.trim() || undefined,
    content: trimmedContent,
    order: nextOrder,
    createdAt: now,
    updatedAt: now
  }
  await db.conceptStudyNotes.add(note)
  return note
}

export async function updateStudyNote(
  id: string,
  changes: Partial<Pick<ConceptStudyNote, 'blockType' | 'title' | 'content'>>
): Promise<void> {
  await db.conceptStudyNotes.update(id, { ...changes, updatedAt: Date.now() })
}

export async function deleteStudyNote(id: string): Promise<void> {
  await db.conceptStudyNotes.delete(id)
}

/** Swaps this block's order with its immediate neighbor in the same section — a simple, reliable "move up"/"move down" without renumbering the whole list. */
export async function moveStudyNote(conceptId: string, section: ConceptNoteSection, id: string, direction: 'up' | 'down'): Promise<void> {
  const notes = await listStudyNotes(conceptId, section)
  const index = notes.findIndex((n) => n.id === id)
  if (index === -1) return
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= notes.length) return
  const a = notes[index]
  const b = notes[swapWith]
  await db.transaction('rw', db.conceptStudyNotes, async () => {
    await db.conceptStudyNotes.update(a.id, { order: b.order })
    await db.conceptStudyNotes.update(b.id, { order: a.order })
  })
}

export async function removeAllStudyNotesFor(conceptId: string): Promise<void> {
  await db.conceptStudyNotes.where('conceptId').equals(conceptId).delete()
}
