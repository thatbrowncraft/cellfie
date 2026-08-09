import { useEffect, useState } from 'react'
import { Dialog, Button, Input } from '@/shared/components'
import type { Concept } from '@/core/db'
import { createConcept, findConceptByNameOrAlias, updateConcept, type ConceptInput } from '@/core/concepts'

interface ConceptFormDialogProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating (§5, "+ New Concept"). */
  concept?: Concept
  onSaved?: (concept: Concept) => void
}

/**
 * Manual concept creation/editing (§5). Name, comma-separated aliases and
 * tags (matching the Notes editor's convention), and an optional
 * description that is stored verbatim — never auto-generated (§1, §14).
 */
export function ConceptFormDialog({ open, onClose, concept, onSaved }: ConceptFormDialogProps) {
  const [name, setName] = useState('')
  const [aliasesInput, setAliasesInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(concept?.name ?? '')
    setAliasesInput(concept?.aliases.join(', ') ?? '')
    setTagsInput(concept?.tags.join(', ') ?? '')
    setDescription(concept?.description ?? '')
    setError(undefined)
  }, [open, concept])

  if (!open) return null

  function parseList(input: string): string[] {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Give this concept a name.')
      return
    }
    setSaving(true)
    try {
      const input: ConceptInput = {
        name: trimmedName,
        aliases: parseList(aliasesInput),
        tags: parseList(tagsInput),
        description: description.trim() || undefined
      }
      if (concept) {
        await updateConcept(concept.id, input)
        onSaved?.({ ...concept, ...input, description: input.description })
      } else {
        const existing = await findConceptByNameOrAlias(trimmedName)
        if (existing) {
          setError(`A concept named "${existing.name}" already exists.`)
          setSaving(false)
          return
        }
        const created = await createConcept(input, true)
        onSaved?.(created)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={concept ? 'Edit concept' : 'New concept'}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save concept'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gram staining" error={error} />
        <Input
          label="Aliases"
          helperText="Comma-separated alternate names, e.g. Gram stain, Gram-staining"
          value={aliasesInput}
          onChange={(e) => setAliasesInput(e.target.value)}
        />
        <Input
          label="Tags"
          helperText="Comma-separated, e.g. microbiology, staining, bacteriology"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="concept-description" className="font-ui text-ui font-medium text-ink-primary">
            Description
          </label>
          <textarea
            id="concept-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Optional — your own notes on what this concept means. Left blank, the concept page shows “No description saved yet.”"
            className="w-full resize-none rounded-sm border border-border bg-canvas px-4 py-3 font-ui text-body text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-2 focus:border-olive"
          />
        </div>
      </div>
    </Dialog>
  )
}
