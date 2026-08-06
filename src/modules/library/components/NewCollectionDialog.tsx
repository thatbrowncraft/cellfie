import { useState } from 'react'
import { Dialog, Button, Input } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import { createCollection } from '@/core/db/collections'
import type { CollectionAccent } from '@/core/db'

interface NewCollectionDialogProps {
  open: boolean
  onClose: () => void
}

const accents: { value: CollectionAccent; label: string; swatchClass: string }[] = [
  { value: 'olive', label: 'Olive', swatchClass: 'bg-olive' },
  { value: 'sage', label: 'Sage', swatchClass: 'bg-sage' },
  { value: 'terracotta', label: 'Terracotta', swatchClass: 'bg-terracotta' }
]

export function NewCollectionDialog({ open, onClose }: NewCollectionDialogProps) {
  const [name, setName] = useState('')
  const [accent, setAccent] = useState<CollectionAccent>('olive')
  const [saving, setSaving] = useState(false)

  function handleClose() {
    setName('')
    setAccent('olive')
    onClose()
  }

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    await createCollection(name, accent)
    setSaving(false)
    handleClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New collection"
      actions={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Everything about immune response"
          autoFocus
        />
        <div className="flex flex-col gap-2">
          <span className="font-ui text-ui font-medium text-ink-primary">Accent</span>
          <div className="flex gap-3" role="radiogroup" aria-label="Accent color">
            {accents.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={accent === option.value}
                aria-label={option.label}
                onClick={() => setAccent(option.value)}
                className={cn(
                  'h-9 w-9 rounded-full transition-all duration-micro',
                  option.swatchClass,
                  accent === option.value ? 'ring-2 ring-offset-2 ring-terracotta ring-offset-surface' : ''
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
