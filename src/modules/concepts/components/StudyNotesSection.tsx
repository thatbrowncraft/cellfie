/**
 * StudyNotesSection — Second Refinement §Part 2/§Part 7. The "MY STUDY
 * NOTES" block, reused under Core Concept / Quick Revision / Exam
 * Focus (see ConceptDetailPage.tsx for where each is mounted). Always
 * rendered clearly separate from — never interleaved invisibly with —
 * Cellfie's own verified content above it, per the person's explicit
 * "coexist, don't merge" requirement.
 *
 * Block types are intentionally a manageable set (text, heading,
 * bullets, numbered, key-value, important/warning/definition/example
 * as accent-styled text, formula as monospace text) rather than a
 * full rich block-structured editor — each still supports add/edit/
 * delete/reorder, which is the actual requirement. A full table
 * builder or image-block editor is a larger follow-up, not attempted
 * here — see this app's own CHANGES notes.
 */
import { useState } from 'react'
import { NotePencil, PencilSimple, Trash, CaretUp, CaretDown, Plus } from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, type DropdownOption } from '@/shared/components'
import type { ConceptNoteBlockType, ConceptNoteSection, ConceptStudyNote } from '@/core/db'
import { addStudyNote, deleteStudyNote, listStudyNotes, moveStudyNote, updateStudyNote } from '@/core/concepts/studyNotes'
import { useLiveQuery } from '@/core/db/useLiveQuery'

interface StudyNotesSectionProps {
  conceptId: string
  section: ConceptNoteSection
  /** Copy tweak per mount point — "study note" / "revision point" / "exam note" — same underlying block model. */
  itemLabel?: string
}

const BLOCK_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'heading', label: 'Heading' },
  { value: 'bullets', label: 'Bullet list' },
  { value: 'numbered', label: 'Numbered list' },
  { value: 'keyvalue', label: 'Key → value list' },
  { value: 'important', label: 'Important point' },
  { value: 'definition', label: 'Definition' },
  { value: 'example', label: 'Example' },
  { value: 'warning', label: 'Warning / common mistake' },
  { value: 'formula', label: 'Formula / equation' }
]

const ACCENT_CLASS: Partial<Record<ConceptNoteBlockType, string>> = {
  important: 'border-terracotta',
  warning: 'border-warning',
  definition: 'border-olive',
  example: 'border-sage',
  formula: 'border-ink-tertiary'
}

const BLOCK_TYPE_LABEL: Record<ConceptNoteBlockType, string> = {
  text: 'Note',
  heading: 'Heading',
  bullets: 'Bullet list',
  numbered: 'Numbered list',
  keyvalue: 'Key facts',
  important: 'Important point',
  definition: 'Definition',
  example: 'Example',
  warning: 'Warning / common mistake',
  formula: 'Formula'
}

function placeholderFor(blockType: ConceptNoteBlockType): string {
  switch (blockType) {
    case 'bullets':
    case 'numbered':
      return 'One point per line'
    case 'keyvalue':
      return 'One per line, e.g.\nGram positive: purple\nGram negative: pink'
    default:
      return 'Write your note…'
  }
}

export function StudyNotesSection({ conceptId, section, itemLabel = 'study note' }: StudyNotesSectionProps) {
  const notes = useLiveQuery<ConceptStudyNote[]>(() => listStudyNotes(conceptId, section), [conceptId, section], [])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [blockType, setBlockType] = useState<ConceptNoteBlockType>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined)

  function openAdd() {
    setEditingId(undefined)
    setBlockType('text')
    setTitle('')
    setContent('')
    setEditorOpen(true)
  }

  function openEdit(note: ConceptStudyNote) {
    setEditingId(note.id)
    setBlockType(note.blockType)
    setTitle(note.title ?? '')
    setContent(note.content)
    setEditorOpen(true)
  }

  async function handleSave() {
    const trimmed = content.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      if (editingId) {
        await updateStudyNote(editingId, { blockType, title: title.trim() || undefined, content: trimmed })
      } else {
        await addStudyNote(conceptId, section, blockType, trimmed, title.trim() || undefined)
      }
      setEditorOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteStudyNote(id)
    setConfirmDeleteId(undefined)
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">My study notes</h3>
        <Button variant="tertiary" size="small" icon={<Plus size={14} />} onClick={openAdd}>
          Add {itemLabel}
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="font-ui text-caption text-ink-tertiary">
          Nothing added yet. Your own notes stay clearly separate from Cellfie's content above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className={`rounded-sm border-l-4 bg-surface-raised p-3 ${ACCENT_CLASS[note.blockType] ?? 'border-ink-tertiary/40'}`}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <span className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                    {BLOCK_TYPE_LABEL[note.blockType]}
                  </span>
                  {note.title && <p className="font-ui text-caption font-semibold text-ink-primary">{note.title}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => void moveStudyNote(conceptId, section, note.id, 'up')}
                    className="p-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30"
                  >
                    <CaretUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === notes.length - 1}
                    onClick={() => void moveStudyNote(conceptId, section, note.id, 'down')}
                    className="p-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30"
                  >
                    <CaretDown size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => openEdit(note)}
                    className="p-1 text-ink-tertiary hover:text-ink-primary"
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => setConfirmDeleteId(note.id)}
                    className="p-1 text-ink-tertiary hover:text-error"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              {note.blockType === 'bullets' && (
                <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
                  {note.content.split('\n').filter(Boolean).map((line, li) => (
                    <li key={li}>{line}</li>
                  ))}
                </ul>
              )}
              {note.blockType === 'numbered' && (
                <ol className="list-decimal space-y-1 pl-5 font-body text-body text-ink-primary">
                  {note.content.split('\n').filter(Boolean).map((line, li) => (
                    <li key={li}>{line}</li>
                  ))}
                </ol>
              )}
              {note.blockType === 'keyvalue' && (
                <dl className="flex flex-col gap-1">
                  {note.content.split('\n').filter(Boolean).map((line, li) => {
                    const [k, ...rest] = line.split(':')
                    const v = rest.join(':').trim()
                    return (
                      <div key={li} className="flex gap-2 font-body text-body">
                        <dt className="font-medium text-ink-primary">{k.trim()}</dt>
                        {v && <dd className="text-ink-secondary">{v}</dd>}
                      </div>
                    )
                  })}
                </dl>
              )}
              {note.blockType === 'heading' && (
                <p className="font-ui text-ui font-semibold text-ink-primary">{note.content}</p>
              )}
              {note.blockType === 'formula' && (
                <p className="whitespace-pre-line font-mono text-body text-ink-primary">{note.content}</p>
              )}
              {!['bullets', 'numbered', 'keyvalue', 'heading', 'formula'].includes(note.blockType) && (
                <p className="whitespace-pre-line font-body text-body text-ink-primary">{note.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? 'Edit study note' : 'Add study note'} size="lg">
        <div className="flex flex-col gap-3">
          <Dropdown
            label="Type"
            options={BLOCK_TYPE_OPTIONS}
            value={blockType}
            onChange={(v) => setBlockType(v as ConceptNoteBlockType)}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
          />
          <textarea
            autoFocus
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholderFor(blockType)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="small" icon={<NotePencil size={14} />} disabled={saving || !content.trim()} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(undefined)} title="Delete this note?">
        <div className="flex flex-col gap-4">
          <p className="font-body text-body text-ink-secondary">This can't be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setConfirmDeleteId(undefined)}>
              Cancel
            </Button>
            <Button variant="destructive" size="small" onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
