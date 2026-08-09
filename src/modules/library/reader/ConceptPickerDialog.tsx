import { useMemo, useState } from 'react'
import { Dialog, Button, SearchField } from '@/shared/components'
import { db, type Concept } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { addConceptSource, createConcept, findConceptByNameOrAlias } from '@/core/concepts'

interface ConceptPickerDialogProps {
  open: boolean
  onClose: () => void
  onLinked?: (concept: Concept) => void
  /** What's being linked — used to build the ConceptSource row (§16, reader integration). */
  source: {
    sourceType: 'highlight' | 'note' | 'bookmark'
    sourceId: string
    libraryItemId: string
    pageNumber?: number
    sourceText: string
  }
}

/**
 * Reader integration (§16): "Add to Concept" from a highlight — select an
 * existing concept or create a new one, then link it via a real
 * ConceptSource row. This is the only UI path that creates a
 * highlight→concept link; nothing here invents a concept without the
 * person naming it.
 */
export function ConceptPickerDialog({ open, onClose, onLinked, source }: ConceptPickerDialogProps) {
  const concepts = useLiveQuery<Concept[]>(() => db.concepts.toArray(), [], [])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return concepts.slice(0, 8)
    return concepts
      .filter((c) => c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [concepts, query])

  const trimmedQuery = query.trim()
  const exactMatch = concepts.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase())

  async function linkTo(concept: Concept) {
    setSaving(true)
    try {
      await addConceptSource({
        conceptId: concept.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        libraryItemId: source.libraryItemId,
        pageNumber: source.pageNumber,
        sourceText: source.sourceText
      })
      onLinked?.(concept)
      setQuery('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateAndLink() {
    if (!trimmedQuery) return
    setSaving(true)
    try {
      const existing = await findConceptByNameOrAlias(trimmedQuery)
      const concept = existing ?? (await createConcept({ name: trimmedQuery, aliases: [], tags: [] }, true))
      await linkTo(concept)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add to concept">
      <div className="flex flex-col gap-3">
        <SearchField placeholder="Search or name a concept…" onChange={setQuery} />

        {matches.length === 0 && !trimmedQuery && (
          <p className="font-ui text-caption text-ink-tertiary">No concepts yet — type a name to create one.</p>
        )}

        {matches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void linkTo(c)}
                  className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left font-ui text-body text-ink-primary hover:bg-surface-raised"
                >
                  {c.name}
                  <span className="font-ui text-micro text-ink-tertiary">Link</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {trimmedQuery && !exactMatch && (
          <Button variant="secondary" disabled={saving} onClick={() => void handleCreateAndLink()}>
            {saving ? 'Saving…' : `+ Create "${trimmedQuery}" and link`}
          </Button>
        )}
      </div>
    </Dialog>
  )
}
