import { useRef, useState } from 'react'
import { UploadSimple, CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react'
import { Dialog, Button } from '../../../shared/components'
import {
  parseJsonBackup,
  importJsonBackup,
  ImportValidationError,
  type ImportSummary
} from '../../../core/export'

interface ImportBackupDialogProps {
  open: boolean
  onClose: () => void
}

/** Friendlier labels for the confirmation summary — falls back to the raw table name for anything not listed (e.g. a future module's new table), so nothing silently disappears from the summary just because this map wasn't updated. */
const TABLE_LABELS: Record<string, string> = {
  notes: 'Notes',
  highlights: 'Highlights',
  readerBookmarks: 'Bookmarks',
  collections: 'Collections',
  concepts: 'Concepts',
  conceptSources: 'Concept sources',
  conceptRelations: 'Concept relations',
  conceptAssets: 'Mind map notes',
  conceptMapNodes: 'Mind map nodes',
  conceptMapEdges: 'Mind map connections',
  conceptStudyNotes: 'Study Overview edits',
  conceptSectionEdits: 'Study Overview edits',
  savedOrganisms: 'Saved organisms',
  savedLabItems: 'Saved Laboratory items',
  savedComparisons: 'Saved comparisons'
}

function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? name
}

type Stage = 'pick' | 'error' | 'confirm' | 'importing' | 'done'

/**
 * Settings → Your data → Import. Three real steps, each one visible to
 * the person rather than happening silently: pick a file → read/validate
 * it and show exactly what will (and won't) be restored → only then
 * write anything. See `core/export`'s `parseJsonBackup`/`importJsonBackup`
 * for why library book files and custom-image files specifically can
 * never be part of this — that limitation is surfaced here rather than
 * discovered later as a broken book.
 */
export function ImportBackupDialog({ open, onClose }: ImportBackupDialogProps) {
  const [stage, setStage] = useState<Stage>('pick')
  const [errorMessage, setErrorMessage] = useState('')
  const [pending, setPending] = useState<Awaited<ReturnType<typeof parseJsonBackup>> | null>(null)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStage('pick')
    setErrorMessage('')
    setPending(null)
    setResult(null)
  }

  function handleClose() {
    if (stage === 'importing') return
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    try {
      const parsed = await parseJsonBackup(file)
      setPending(parsed)
      setStage('confirm')
    } catch (err) {
      setErrorMessage(err instanceof ImportValidationError ? err.message : 'Something went wrong reading that file.')
      setStage('error')
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setStage('importing')
    const summary = await importJsonBackup(pending.backup)
    setResult(summary)
    setStage('done')
  }

  const restoredEntries = pending ? Object.entries(pending.summary.restoredCounts) : []
  const totalRestored = restoredEntries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import a backup"
      size="md"
      closeOnEscape={stage !== 'importing'}
      actions={
        stage === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Choose a different file
            </Button>
            <Button variant="primary" onClick={() => void handleConfirm()} disabled={totalRestored === 0}>
              Restore {totalRestored > 0 ? `${totalRestored} item${totalRestored === 1 ? '' : 's'}` : ''}
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
          <p className="font-body text-body text-ink-secondary">Choose a Cellfie backup file (.json) exported from Settings.</p>
          <Button variant="secondary" size="small" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <p className="font-ui text-caption text-ink-tertiary">
            This merges into what's already on this device — it never deletes anything.
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
            Backup from {new Date(pending.summary.exportedAt).toLocaleString()} (Cellfie {pending.summary.appVersion}). This will be merged
            into what's already on this device — an item already here with the same id is overwritten with the backup's version; nothing
            else is touched or removed.
          </p>

          {restoredEntries.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {restoredEntries.map(([name, count]) => (
                <li key={name} className="flex items-center justify-between px-4 py-2">
                  <span className="flex items-center gap-2 font-ui text-ui text-ink-primary">
                    <CheckCircle size={16} className="text-olive" aria-hidden />
                    {tableLabel(name)}
                  </span>
                  <span className="font-ui text-caption text-ink-tertiary">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 font-ui text-ui text-ink-tertiary">
              <WarningCircle size={16} aria-hidden />
              Nothing in this file can be restored.
            </p>
          )}

          {pending.summary.preferencesRestored > 0 && (
            <p className="font-ui text-caption text-ink-tertiary">Theme and reading preferences will also be restored.</p>
          )}

          {(pending.summary.skippedTables.length > 0 || pending.summary.skippedFileBackedAssets > 0) && (
            <div className="rounded-md border border-border bg-surface-raised p-3">
              <p className="flex items-center gap-2 font-ui text-caption font-medium text-ink-secondary">
                <WarningCircle size={14} aria-hidden />
                Not restored
              </p>
              <p className="mt-1 font-ui text-caption text-ink-tertiary">
                Your uploaded book files, custom organism photos, and any imported mind-map/visual files aren't included in a backup (only
                their metadata is, and it can't be reattached to a file automatically) — reading, unread state, and Library entries for
                those books won't come back. Everything else that references them (Notes, Highlights, Concepts, saved items) is restored
                and will simply show "Unknown" wherever it pointed at one of those files.
              </p>
            </div>
          )}
        </div>
      )}

      {stage === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-body text-body text-ink-secondary">Restoring…</p>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle size={32} className="text-olive" weight="fill" aria-hidden />
          <p className="font-body text-body text-ink-primary">
            Restored {Object.values(result.restoredCounts).reduce((a, b) => a + b, 0)} item
            {Object.values(result.restoredCounts).reduce((a, b) => a + b, 0) === 1 ? '' : 's'}.
          </p>
          <p className="font-ui text-caption text-ink-tertiary">You may need to reopen a page to see the restored content.</p>
        </div>
      )}
    </Dialog>
  )
}
