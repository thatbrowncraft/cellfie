import { useRef, useState, type DragEvent } from 'react'
import { UploadSimple, CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react'
import { Dialog, Button } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import { importFiles, type ImportResult, type ImportStage } from '@/core/import-engine'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

interface FileRow {
  fileName: string
  stage: ImportStage
  result?: ImportResult
}

const stageProgress: Record<ImportStage, number> = {
  hashing: 20,
  'checking-duplicate': 40,
  parsing: 65,
  saving: 90,
  done: 100,
  duplicate: 100,
  unsupported: 100,
  error: 100
}

/**
 * Import Dialog — drives `core/import-engine`. Progress renders as the
 * slim determinate olive bar Design System §12 specifies for bulk
 * import/PDF indexing; each file gets its own row since imports run
 * sequentially and can individually succeed, duplicate, or fail.
 */
export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [rows, setRows] = useState<FileRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setRows(files.map((f) => ({ fileName: f.name, stage: 'hashing' })))
    setIsImporting(true)

    const results = await importFiles(files, (event) => {
      setRows((prev) =>
        prev.map((row) => (row.fileName === event.fileName ? { ...row, stage: event.stage } : row))
      )
    })

    setRows((prev) =>
      prev.map((row) => {
        const result = results.find((r) => r.fileName === row.fileName)
        return result ? { ...row, result, stage: result.status === 'imported' ? 'done' : row.stage } : row
      })
    )

    setIsImporting(false)
    // No manual refresh needed here — LibraryPage reads via a Dexie
    // liveQuery, so newly-imported items appear the moment they're
    // written to IndexedDB.
  }

  function handleClose() {
    if (isImporting) return
    setRows([])
    onClose()
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  const allDone = rows.length > 0 && !isImporting

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import files"
      size="lg"
      closeOnEscape={!isImporting}
      actions={
        <Button variant="secondary" onClick={handleClose} disabled={isImporting}>
          {allDone ? 'Done' : 'Cancel'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {rows.length === 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center gap-3 rounded-md border-2 border-dashed p-10 text-center transition-colors duration-standard',
              isDragging ? 'border-olive bg-surface-raised' : 'border-border'
            )}
          >
            <UploadSimple size={32} className="text-ink-tertiary" aria-hidden />
            <p className="font-body text-body text-ink-secondary">
              Drag books or study material here, or choose them from your device.
            </p>
            <Button variant="secondary" size="small" onClick={() => inputRef.current?.click()}>
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf,application/epub+zip,.epub,text/html,.html,.htm,.xhtml"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <p className="font-ui text-caption text-ink-tertiary">
              PDF · EPUB · XHTML/HTML. Everything stays on this device.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.fileName} className="rounded-sm border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-ui text-ui text-ink-primary">{row.fileName}</span>
                  <StatusBadge row={row} />
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-standard ease-standard',
                      row.result?.status === 'error' || row.result?.status === 'unsupported'
                        ? 'bg-error'
                        : row.result?.status === 'duplicate'
                          ? 'bg-warning'
                          : 'bg-olive'
                    )}
                    style={{ width: `${stageProgress[row.stage]}%` }}
                  />
                </div>
                {row.result?.status === 'duplicate' && (
                  <p className="mt-2 font-ui text-caption text-ink-secondary">
                    Already in your library as "{row.result.duplicateOf.title}" — skipped.
                  </p>
                )}
                {row.result?.status === 'unsupported' && (
                  <p className="mt-2 font-ui text-caption text-ink-secondary">{row.result.reason}</p>
                )}
                {row.result?.status === 'error' && (
                  <p className="mt-2 font-ui text-caption text-error">{row.result.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {allDone && (
          <Button variant="tertiary" size="small" onClick={() => setRows([])} className="self-start">
            Import more files
          </Button>
        )}
      </div>
    </Dialog>
  )
}

function StatusBadge({ row }: { row: FileRow }) {
  if (!row.result) {
    return <span className="shrink-0 font-ui text-caption text-ink-tertiary">{stageLabel(row.stage)}</span>
  }
  if (row.result.status === 'imported') {
    return (
      <span className="flex shrink-0 items-center gap-1 font-ui text-caption text-success">
        <CheckCircle size={16} weight="fill" aria-hidden /> Imported
      </span>
    )
  }
  if (row.result.status === 'duplicate') {
    return (
      <span className="flex shrink-0 items-center gap-1 font-ui text-caption text-warning">
        <WarningCircle size={16} weight="fill" aria-hidden /> Duplicate
      </span>
    )
  }
  return (
    <span className="flex shrink-0 items-center gap-1 font-ui text-caption text-error">
      <XCircle size={16} weight="fill" aria-hidden /> {row.result.status === 'unsupported' ? 'Unsupported' : 'Failed'}
    </span>
  )
}

function stageLabel(stage: ImportStage): string {
  switch (stage) {
    case 'hashing':
      return 'Checking file…'
    case 'checking-duplicate':
      return 'Checking library…'
    case 'parsing':
      return 'Reading file…'
    case 'saving':
      return 'Saving…'
    default:
      return 'Working…'
  }
}
