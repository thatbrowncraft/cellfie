/**
 * EditableSection — Book-First Learning Engine, Phase 2.
 *
 * Wraps one of Learn's three major sections (Quick Revision / Core
 * Concept / Exam Focus) with an unobtrusive, optional Edit action. Read
 * mode renders `children` — the section's existing rich rendering,
 * completely unchanged — and shows only a small "Edit" affordance. It
 * never starts in an editable state and never shows an empty "add your
 * content" placeholder: every section this wraps already has real
 * Cellfie-generated content by the time it reaches here.
 *
 * Saving an edit does not touch the underlying source data (the
 * uploaded book text, the curated lesson, or the MeSH/PubChem fallback)
 * at all — it only changes what's DISPLAYED for this one concept's
 * this one section, via `core/concepts/sectionEdits.ts`. The original
 * is captured once, on first save, and kept forever so "Restore
 * original" can always bring back exactly what Cellfie generated.
 */
import { useState, type ReactNode } from 'react'
import { ArrowCounterClockwise, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/shared/components'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { getSectionEdit, restoreSectionEdit, saveSectionEdit } from '@/core/concepts/sectionEdits'
import type { ConceptSectionEdit } from '@/core/db'

interface EditableSectionProps {
  conceptId: string
  /** Stable within this concept — e.g. 'quick-revision', 'core-concept', 'exam-focus'. */
  sectionKey: string
  /** Plain-text version of the section's current original content — the Edit textarea's starting value, and what gets snapshotted as "original" on first save. */
  originalText: string
  /** The section's normal, rich read-mode rendering — shown as-is whenever no edit exists. */
  children: ReactNode
  /** Used only for the textarea's aria-label, e.g. "Core Concept". */
  label: string
}

export function EditableSection({ conceptId, sectionKey, originalText, children, label }: EditableSectionProps) {
  const edit = useLiveQuery<ConceptSectionEdit | undefined>(
    () => getSectionEdit(conceptId, sectionKey),
    [conceptId, sectionKey],
    undefined
  )
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEditing() {
    setDraft(edit ? edit.editedText : originalText)
    setEditing(true)
  }

  async function handleSave() {
    if (!draft.trim()) return
    await saveSectionEdit(conceptId, sectionKey, edit ? edit.originalText : originalText, draft)
    setEditing(false)
  }

  async function handleRestore() {
    await restoreSectionEdit(conceptId, sectionKey)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
        <label className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Edit {label}</label>
        <textarea
          autoFocus
          rows={10}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Edit ${label}`}
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="small" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="small" disabled={!draft.trim()} onClick={() => void handleSave()}>
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {edit ? (
        <div className="rounded-md border border-border bg-surface p-5">
          {edit.editedText.split('\n\n').map((para, i) => (
            <p key={i} className="whitespace-pre-line font-body text-body text-ink-primary leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      ) : (
        children
      )}

      {/* Retrieval Correction §8 — this row must read as belonging to
          THIS section, not as a stray control floating between it and
          whatever renders next (e.g. Core Concept's own Sources card).
          A top border ties it visually to the content directly above,
          and the button is labeled with the section name so it's
          unambiguous on a phone screen when sections run close together. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 px-1 pt-2.5">
        {edit && (
          <span className="inline-flex items-center gap-1 font-ui text-micro text-ink-tertiary">
            <PencilSimple size={11} aria-hidden /> Edited by you
          </span>
        )}
        <button type="button" onClick={startEditing} className="font-ui text-micro font-medium text-olive hover:underline">
          Edit {label}
        </button>
        {edit && (
          <button
            type="button"
            onClick={() => void handleRestore()}
            className="inline-flex items-center gap-1 font-ui text-micro font-medium text-ink-tertiary hover:underline"
          >
            <ArrowCounterClockwise size={11} aria-hidden /> Restore original
          </button>
        )}
      </div>
    </div>
  )
}
