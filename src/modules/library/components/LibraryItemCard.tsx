import { FileText, PencilSimple, FolderPlus, ArrowSquareOut, Trash } from '@phosphor-icons/react'
import { Card, ContextMenu, type ContextMenuAction } from '@/shared/components'
import { documentTypeLabels, indexingStatusLabels, type LibraryItem } from '@/core/db'
import { cn } from '@/shared/utils/cn'
import { useOpfsObjectUrl } from '../hooks/useOpfsObjectUrl'
import { formatFileSize, formatRelativeDate } from '../utils/format'

interface LibraryItemCardProps {
  item: LibraryItem
  onEdit: () => void
  onManageCollections: () => void
  onOpen: () => void
  onRemove: () => void
}

/**
 * Library Item Card — Design System §10.2 (Card). PDF thumbnails are
 * deliberately plain (no deckled-edge illustration frame, §7: that
 * treatment is reserved for illustrated/curated content, never PDF
 * thumbnails or UI screenshots).
 */
export function LibraryItemCard({ item, onEdit, onManageCollections, onOpen, onRemove }: LibraryItemCardProps) {
  const thumbnailUrl = useOpfsObjectUrl(item.thumbnailPath)

  const actions: ContextMenuAction[] = [
    { id: 'open', label: 'Open PDF', icon: <ArrowSquareOut size={16} />, onSelect: onOpen },
    { id: 'edit', label: 'Edit details', icon: <PencilSimple size={16} />, onSelect: onEdit },
    { id: 'collections', label: 'Add to collection', icon: <FolderPlus size={16} />, onSelect: onManageCollections },
    { id: 'remove', label: 'Remove', icon: <Trash size={16} />, destructive: true, onSelect: onRemove }
  ]

  return (
    <Card interactive onClick={onEdit} className="flex flex-col gap-4" role="button" aria-label={`${item.title} — edit details`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-canvas">
          {thumbnailUrl ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img src={thumbnailUrl} alt={`Cover of ${item.title}`} className="h-full w-full object-cover" />
          ) : (
            <FileText size={28} className="text-ink-tertiary" aria-hidden />
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu actions={actions} triggerLabel={`More actions for ${item.title}`} />
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-display text-h3 font-medium leading-snug text-ink-primary line-clamp-2">{item.title}</h3>
        <p className="mt-1 font-ui text-caption text-ink-secondary line-clamp-1">
          {item.author ?? 'Unknown author'}
          {item.pageCount ? ` · ${item.pageCount} pages` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="wash-sage rounded-full px-3 py-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-primary">
          {documentTypeLabels[item.documentType]}
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5 font-ui text-caption text-ink-tertiary',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              item.indexingStatus === 'failed' ? 'bg-error' : 'bg-olive'
            )}
            aria-hidden
          />
          {indexingStatusLabels[item.indexingStatus]}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 font-ui text-caption text-ink-tertiary">
        <span>{formatFileSize(item.fileSize)}</span>
        <span>Added {formatRelativeDate(item.createdAt)}</span>
      </div>
    </Card>
  )
}
