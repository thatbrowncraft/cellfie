import { BookOpen, PushPin, Star } from '@phosphor-icons/react'
import { Card, CardBody, CardFooter, CardHeader } from '@/shared/components'
import { formatRelativeDate } from '@/modules/library/utils/format'
import type { Note } from '@/core/db'
import { toggleNoteFavorite, toggleNotePinned } from '@/core/db/notes'

interface NoteCardProps {
  note: Note
  linkedBookTitle?: string
  onOpen: () => void
}

/** Strips Markdown syntax down to plain text for a short preview snippet. */
function snippet(markdown: string, max = 140): string {
  const plain = markdown
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}

export function NoteCard({ note, linkedBookTitle, onOpen }: NoteCardProps) {
  return (
    <Card interactive onClick={onOpen} className="flex flex-col">
      <CardHeader className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-display text-h3 font-medium text-ink-primary">{note.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {note.pinned && <PushPin size={16} weight="fill" className="text-olive" aria-label="Pinned" />}
          {note.favorite && <Star size={16} weight="fill" className="text-terracotta" aria-label="Favorite" />}
        </div>
      </CardHeader>
      <CardBody className="flex-1">
        <p className="font-body text-body text-ink-secondary">{snippet(note.contentMarkdown) || 'No content yet.'}</p>
        {linkedBookTitle && (
          <p className="mt-3 flex items-center gap-1.5 font-ui text-caption text-ink-tertiary">
            <BookOpen size={14} aria-hidden />
            {linkedBookTitle}
            {note.page ? `, p.${note.page}` : ''}
          </p>
        )}
      </CardBody>
      <CardFooter className="flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro text-ink-tertiary">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-ui text-caption text-ink-tertiary">{formatRelativeDate(note.updatedAt)}</span>
          <button
            type="button"
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={(e) => {
              e.stopPropagation()
              void toggleNotePinned(note.id)
            }}
            className="text-ink-tertiary hover:text-olive"
          >
            <PushPin size={16} weight={note.pinned ? 'fill' : 'regular'} />
          </button>
          <button
            type="button"
            aria-label={note.favorite ? 'Remove favorite' : 'Mark favorite'}
            onClick={(e) => {
              e.stopPropagation()
              void toggleNoteFavorite(note.id)
            }}
            className="text-ink-tertiary hover:text-terracotta"
          >
            <Star size={16} weight={note.favorite ? 'fill' : 'regular'} />
          </button>
        </div>
      </CardFooter>
    </Card>
  )
}
