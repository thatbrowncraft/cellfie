import { useRef, useState } from 'react'
import { UploadSimple, CheckCircle, XCircle, WarningCircle } from '@phosphor-icons/react'
import { Dialog, Button } from '@/shared/components'
import { parseMarkdownNotesExport, importMarkdownNotes, ImportValidationError, type ParsedMarkdownNote } from '@/core/export'

interface ImportMarkdownDialogProps {
  open: boolean
  onClose: () => void
}

type Stage = 'pick' | 'error' | 'confirm' | 'importing' | 'done'

/**
 * Study Vault → Notes → Import Markdown. The counterpart to "Export
 * Markdown" on the same page, and deliberately the same three-stage
 * shape as Settings' `ImportBackupDialog` (pick a file → show exactly
 * what will be restored, and what can't be → only then write anything) —
 * see `core/export`'s `parseMarkdownNotesExport`/`importMarkdownNotes`
 * for why a book link, a linked highlight, and the page number can never
 * be restored this way, and why importing the same file twice creates
 * two copies rather than being treated as "already imported."
 */
export function ImportMarkdownDialog({ open, onClose }: ImportMarkdownDialogProps) {
  const [stage, setStage] = useState<Stage>('pick')
  const [errorMessage, setErrorMessage] = useState('')
  const [pending, setPending] = useState<ParsedMarkdownNote[] | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStage('pick')
    setErrorMessage('')
    setPending(null)
    setImportedCount(0)
  }

  function handleClose() {
    if (stage === 'importing') return
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    try {
      const { notes } = await parseMarkdownNotesExport(file)
      setPending(notes)
      setStage('confirm')
    } catch (err) {
      setErrorMessage(err instanceof ImportValidationError ? err.message : 'Something went wrong reading that file.')
      setStage('error')
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setStage('importing')
    const { imported } = await importMarkdownNotes(pending)
    setImportedCount(imported)
    setStage('done')
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import Markdown"
      size="md"
      closeOnEscape={stage !== 'importing'}
      actions={
        stage === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Choose a different file
            </Button>
            <Button variant="primary" onClick={() => void handleConfirm()} disabled={!pending?.length}>
              Import {pending?.length ?? 0} note{pending?.length === 1 ? '' : 's'}
            </Button>
          </>
        ) : stage === 'done' ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleClose} disabled={stage === 'importing'}>
            Cancel
          </Button>
        )
      }
    >
      {stage === 'pick' && (
        <div className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-border p-10 text-center">
          <UploadSimple size={32} className="text-ink-tertiary" aria-hidden />
          <p className="font-body text-body text-ink-secondary">
            Choose a Cellfie notes export (.md) — the file "Export Markdown" on this page produces.
          </p>
          <Button variant="secondary" size="small" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="text/markdown,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <p className="font-ui text-caption text-ink-tertiary">
            Each note in the file is added as a new note — this never overwrites or removes anything already here.
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <XCircle size={32} className="text-error" aria-hidden />
          <p className="font-body text-body text-ink-primary">{errorMessage}</p>
          <Button variant="secondary" size="small" onClick={reset}>
            Try a different file
          </Button>
        </div>
      )}

      {stage === 'confirm' && pending && (
        <div className="flex flex-col gap-4">
          <p className="font-body text-body text-ink-secondary">
            This file contains {pending.length} note{pending.length === 1 ? '' : 's'}. Each will be added as a new,
            standalone note.
          </p>

          {pending.length > 0 && (
            <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border bg-surface">
              {pending.map((note, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="flex items-center gap-2 truncate font-ui text-ui text-ink-primary">
                    <CheckCircle size={16} className="shrink-0 text-olive" aria-hidden />
                    <span className="truncate">{note.title}</span>
                  </span>
                  {note.tags.length > 0 && (
                    <span className="shrink-0 font-ui text-caption text-ink-tertiary">
                      {note.tags.map((t) => `#${t}`).join(' ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-border bg-surface-raised p-3">
            <p className="flex items-center gap-2 font-ui text-caption font-medium text-ink-secondary">
              <WarningCircle size={14} aria-hidden />
              Not restored
            </p>
            <p className="mt-1 font-ui text-caption text-ink-tertiary">
              A note's original book link and page number can't be restored from a Markdown file (it only records the
              book's title, not a way to reconnect to it on this device) — any quoted highlight text is kept as part
              of the note's own content instead of being linked. Every note imports as a standalone note dated today.
            </p>
          </div>
        </div>
      )}

      {stage === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-body text-body text-ink-secondary">Importing…</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle size={32} className="text-olive" weight="fill" aria-hidden />
          <p className="font-body text-body text-ink-primary">
            Imported {importedCount} note{importedCount === 1 ? '' : 's'}.
          </p>
        </div>
      )}
    </Dialog>
  )
}
