import { useState } from 'react'
import { Check, NotePencil, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/components'
import type { Concept } from '@/core/db'
import { updateConceptMemoryAid } from '@/core/concepts'

interface MemoryAidCardProps {
  concept: Concept
}

/**
 * Memory aid — 100% user-authored, never auto-generated or suggested.
 * Intentionally independent of ExamToolsPanel/ExamToolsData: this
 * component's only dependencies are `Concept.memoryAid` (the existing,
 * already-correct field in core/db/index.ts) and `updateConceptMemoryAid`
 * (the existing, already-correct write path in core/concepts/service.ts).
 * Neither of those changed — only where this UI is mounted did.
 * Rendered in the Learn tab, outside the study-mode switcher, so it
 * stays visible regardless of which mode (Quick Revision / Detailed
 * Study / Exam Focus) is active.
 */
export function MemoryAidCard({ concept }: MemoryAidCardProps) {
  const [text, setText] = useState(concept.memoryAid ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateConceptMemoryAid(concept.id, text)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setText('')
    setSaving(true)
    try {
      await updateConceptMemoryAid(concept.id, '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        <NotePencil size={14} aria-hidden />
        Memory aid
      </h3>
      <p className="mb-3 font-ui text-caption text-ink-secondary">
        Your own mnemonic for {concept.name} — never suggested automatically.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. a mnemonic that helps you remember this…"
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" size="small" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {text && (
          <Button variant="secondary" size="small" icon={<Trash size={13} />} disabled={saving} onClick={() => void handleClear()}>
            Clear
          </Button>
        )}
        {saved && (
          <span className="flex items-center gap-1 font-ui text-caption text-ink-tertiary">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
    </div>
  )
}
