import { NotePencil } from '@phosphor-icons/react'
import type { Note } from '@/core/db'
import { formatRelativeDate } from '../utils/format'

interface ReaderNoteListProps {
  notes: Note[]
  onOpen: (note: Note) => void
}

/** Plain-text preview, stripped of the light Markdown syntax used in note bodies. */
function snippet(markdown: string, max = 90): string {
  const plain = markdown.replace(/^#{1,3}\s+/gm, '').replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}

export function ReaderNoteList({ notes, onOpen }: ReaderNoteListProps) {
  if (notes.length === 0) {
    return (
      <p className="font-ui text-caption text-ink-tertiary">
        No notes on this book yet. Highlight text and add a sticky note, or write one from Quick Capture.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            onClick={() => onOpen(note)}
            className="flex w-full flex-col items-start gap-1 rounded-sm px-2 py-2 text-left hover:bg-surface-raised"
          >
            <span className="flex w-full items-center gap-2 font-ui text-ui font-medium text-ink-primary">
              <NotePencil size={15} className="shrink-0 text-olive" aria-hidden />
              <span className="truncate">{note.title}</span>
              {note.page && <span className="shrink-0 font-ui text-micro text-ink-tertiary">p.{note.page}</span>}
            </span>
            {note.contentMarkdown.trim() && (
              <span className="pl-6 font-ui text-caption text-ink-tertiary">{snippet(note.contentMarkdown)}</span>
            )}
            <span className="pl-6 font-ui text-micro text-ink-tertiary">{formatRelativeDate(note.updatedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
