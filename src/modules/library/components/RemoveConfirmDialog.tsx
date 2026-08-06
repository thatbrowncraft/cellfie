import { useState } from 'react'
import { Dialog, Button } from '@/shared/components'
import type { LibraryItem } from '@/core/db'
import { removeLibraryItem } from '@/core/db/library'

interface RemoveConfirmDialogProps {
  item: LibraryItem | null
  onClose: () => void
}

/** Destructive confirmation — Design System §10.19: destructive dialogs require an explicit action, not just Esc. */
export function RemoveConfirmDialog({ item, onClose }: RemoveConfirmDialogProps) {
  const [removing, setRemoving] = useState(false)

  if (!item) return null

  async function handleRemove() {
    if (!item) return
    setRemoving(true)
    await removeLibraryItem(item)
    setRemoving(false)
    onClose()
  }

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title="Remove from library?"
      closeOnEscape={!removing}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </>
      }
    >
      <p>
        "{item.title}" and its stored file will be permanently deleted from this device. This can't be undone.
      </p>
    </Dialog>
  )
}
