import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Star, PushPin, Trash } from '@phosphor-icons/react'
import { Dialog, Button, Input, Tabs, MarkdownPreview } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import type { Note } from '@/core/db'
import { createNote, deleteNote, updateNote, type NoteInput } from '@/core/db/notes'

interface LinkedContext {
  itemId: string
  itemTitle: string
  page?: number
  highlightId?: string
}

interface NoteEditorDialogProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating a new note. */
  note?: Note
  /** Only used when creating a brand-new note from the reader (Sprint 2 §5, Linked Notes). */
  linkedContext?: LinkedContext
  onSaved?: (note: Note) => void
  onDeleted?: () => void
}

/**
 * The one note editor used everywhere a note gets written or edited:
 * Quick Capture (standalone, §3), the Notebook page's "New note"/edit
 * actions, and "Open as full note" from a highlight's sticky note (§2).
 * Keeps the linked book/page context read-only and visible so a note
 * never silently loses the "where I learned this" trail (§5).
 */
export function NoteEditorDialog({ open, onClose, note, linkedContext, onSaved, onDeleted }: NoteEditorDialogProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(note?.title ?? '')
    setContent(note?.contentMarkdown ?? '')
    setTagsInput(note?.tags.join(', ') ?? '')
    setFavorite(note?.favorite ?? false)
    setPinned(note?.pinned ?? false)
  }, [open, note])

  if (!open) return null

  const itemId = note?.itemId ?? linkedContext?.itemId
  const page = note?.page ?? linkedContext?.page
  const highlightId = note?.highlightId ?? linkedContext?.highlightId
  const linkedTitle = linkedContext?.itemTitle

  async function handleSave() {
    const input: NoteInput = {
      title,
      contentMarkdown: content,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      favorite,
      pinned,
      itemId,
      page,
      highlightId
    }
    if (note) {
      await updateNote(note.id, input)
      onSaved?.({ ...note, ...input, tags: input.tags, updatedAt: Date.now() } as Note)
    } else {
      const created = await createNote(input)
      onSaved?.(created)
    }
    onClose()
  }

  async function handleDelete() {
    if (!note) return
    await deleteNote(note.id)
    onDeleted?.()
    onClose()
  }

  function openSource() {
    if (!itemId) return
    onClose()
    navigate(`/library/${itemId}/read${page ? `?page=${page}` : ''}`)
  }

  return (
    <Dialog open={open} onClose={onClose} title={note ? 'Edit note' : 'New note'} size="lg" actions={
      <>
        {note && (
          <Button variant="destructive" icon={<Trash size={16} />} onClick={() => void handleDelete()}>
            Delete
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()}>
          Save
        </Button>
      </>
    }>
      <div className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled note" />

        {(itemId || linkedTitle) && (
          <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-raised px-3 py-2">
            <BookOpen size={16} className="shrink-0 text-terracotta" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-ui text-caption text-ink-secondary">
              Linked to {linkedTitle ?? 'a book'}
              {page ? `, page ${page}` : ''}
            </span>
            {itemId && (
              <button type="button" onClick={openSource} className="shrink-0 font-ui text-caption font-medium text-olive hover:underline">
                Open source
              </button>
            )}
          </div>
        )}

        <div>
          <label className="mb-2 block font-ui text-ui font-medium text-ink-primary" htmlFor="note-content">
            Content (Markdown)
          </label>
          <Tabs
            tabs={[
              {
                id: 'write',
                label: 'Write',
                content: (
                  <textarea
                    id="note-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    placeholder="Write in Markdown — **bold**, *italic*, `code`, > quotes, - lists…"
                    className="w-full resize-y rounded-sm border border-border bg-canvas px-4 py-3 font-mono text-caption text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-2 focus:border-olive"
                  />
                )
              },
              {
                id: 'preview',
                label: 'Preview',
                content: (
                  <div className="min-h-[220px] rounded-sm border border-border bg-canvas px-4 py-3">
                    {content.trim() ? (
                      <MarkdownPreview markdown={content} />
                    ) : (
                      <p className="font-ui text-caption text-ink-tertiary">Nothing to preview yet.</p>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>

        <Input
          label="Tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. mitosis, exam-1, chapter-3"
          helperText="Comma-separated."
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={favorite}
            onClick={() => setFavorite((f) => !f)}
            className={cn(
              'flex items-center gap-2 rounded-sm border px-3 py-2 font-ui text-caption font-medium transition-colors duration-micro',
              favorite ? 'border-terracotta bg-surface-raised text-ink-primary' : 'border-border text-ink-secondary hover:bg-surface-raised'
            )}
          >
            <Star size={16} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-terracotta' : ''} />
            Favorite
          </button>
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => setPinned((p) => !p)}
            className={cn(
              'flex items-center gap-2 rounded-sm border px-3 py-2 font-ui text-caption font-medium transition-colors duration-micro',
              pinned ? 'border-olive bg-surface-raised text-ink-primary' : 'border-border text-ink-secondary hover:bg-surface-raised'
            )}
          >
            <PushPin size={16} weight={pinned ? 'fill' : 'regular'} className={pinned ? 'text-olive' : ''} />
            Pinned
          </button>
        </div>
      </div>
    </Dialog>
  )
}
