import { useEffect, useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { Dialog, Button, Input, Dropdown } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import {
  documentTypeLabels,
  type Collection,
  type DocumentType,
  type LibraryItem
} from '@/core/db'
import { toggleItemCollection, updateLibraryItem } from '@/core/db/library'

interface EditMetadataDialogProps {
  item: LibraryItem | null
  collections: Collection[]
  onClose: () => void
}

const documentTypeOptions = (Object.entries(documentTypeLabels) as [DocumentType, string][]).map(
  ([value, label]) => ({ value, label })
)

/**
 * Edit Details dialog — covers metadata (title/author/type/language/tags)
 * and collection membership in one place, since both are "manage this
 * item" actions and a card-level context menu shouldn't need a submenu
 * (Design System §10.21 notes menus should stay simple/keyboard-friendly).
 */
export function EditMetadataDialog({ item, collections, onClose }: EditMetadataDialogProps) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('other')
  const [language, setLanguage] = useState('en')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setTitle(item.title)
    setAuthor(item.author ?? '')
    setDocumentType(item.documentType)
    setLanguage(item.language)
    setTagsInput(item.tags.join(', '))
  }, [item])

  if (!item) return null

  async function handleSave() {
    if (!item) return
    setSaving(true)
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await updateLibraryItem(item.id, {
      title: title.trim() || item.fileName,
      author: author.trim() || undefined,
      documentType,
      language: language.trim() || 'en',
      tags
    })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title="Edit details"
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          label="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Unknown"
        />
        <Dropdown
          label="Document type"
          options={documentTypeOptions}
          value={documentType}
          onChange={(v) => setDocumentType(v as DocumentType)}
        />
        <Input label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} />
        <Input
          label="Tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          helperText="Comma-separated, e.g. immunology, semester 3"
        />

        {collections.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-ui text-ui font-medium text-ink-primary">Collections</span>
            <ul className="flex flex-col gap-1">
              {collections.map((collection) => {
                const isMember = item.collectionIds.includes(collection.id)
                return (
                  <li key={collection.id}>
                    <button
                      type="button"
                      aria-pressed={isMember}
                      onClick={() => toggleItemCollection(item.id, collection.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-sm border border-border px-4 py-2 text-left font-ui text-ui transition-colors duration-micro',
                        isMember ? 'border-olive bg-surface-raised text-ink-primary' : 'text-ink-secondary hover:bg-surface-raised'
                      )}
                    >
                      {collection.name}
                      {isMember && <Check size={16} className="text-olive" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}
