import { useState } from 'react'
import { UploadSimple, Trash } from '@phosphor-icons/react'
import { Button, Dialog } from '@/shared/components'
import type { Concept, ConceptAsset } from '@/core/db'
import { importConceptAssetFile, listConceptAssets, removeConceptAsset } from '@/core/concepts/assets'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { useOpfsObjectUrl } from '@/modules/library/hooks/useOpfsObjectUrl'

interface ConceptVisualsImportProps {
  concept: Concept
}

/**
 * Visuals tab — "Import custom visual/PDF" (Concept Hub Refinement
 * item 11). Entirely separate from the scientific-visuals grid above
 * it: a custom import is a `ConceptAsset` (kind 'visual-import'),
 * stored via the same existing OPFS wrapper LibraryItem's own PDFs
 * use — see core/concepts/assets.ts and core/file-storage. Never
 * mixed into the scientific visuals array, and never treated as a
 * verified scientific source.
 */
export function ConceptVisualsImport({ concept }: ConceptVisualsImportProps) {
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | undefined>(undefined)
  const [viewing, setViewing] = useState<ConceptAsset | undefined>(undefined)

  const imports = useLiveQuery<ConceptAsset[]>(() => listConceptAssets(concept.id, 'visual-import'), [concept.id], [])

  async function handleImportFile(file: File) {
    setImportError(undefined)
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      setImportError('Please choose an image (PNG/JPG/WEBP/SVG) or a PDF.')
      return
    }
    setImporting(true)
    try {
      await importConceptAssetFile(concept.id, 'visual-import', file)
    } catch {
      setImportError("Couldn't import that file. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        <UploadSimple size={14} aria-hidden />
        Your imported visuals
      </h3>

      <label className="relative inline-flex">
        <span className="pointer-events-none">
          <Button variant="secondary" size="small" icon={<UploadSimple size={14} />} disabled={importing} type="button">
            {importing ? 'Importing…' : 'Import custom visual / PDF'}
          </Button>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={importing}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
      </label>
      {importError && <p className="mt-2 font-ui text-caption text-error">{importError}</p>}

      {imports.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imports.map((asset) => (
            <ImportedVisualThumb key={asset.id} asset={asset} onView={() => setViewing(asset)} />
          ))}
        </div>
      )}

      {viewing && <ImportedVisualDialog asset={viewing} onClose={() => setViewing(undefined)} />}
    </div>
  )
}

function ImportedVisualThumb({ asset, onView }: { asset: ConceptAsset; onView: () => void }) {
  const url = useOpfsObjectUrl(asset.filePath)
  const isImage = asset.mimeType?.startsWith('image/')

  return (
    <button
      type="button"
      onClick={onView}
      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface-raised"
    >
      {isImage && url ? (
        <img src={url} alt={asset.label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <UploadSimple size={20} className="text-ink-tertiary" aria-hidden />
          <span className="line-clamp-2 font-ui text-micro text-ink-secondary">{asset.label}</span>
        </div>
      )}
    </button>
  )
}

function ImportedVisualDialog({ asset, onClose }: { asset: ConceptAsset; onClose: () => void }) {
  const url = useOpfsObjectUrl(asset.filePath)
  const isImage = asset.mimeType?.startsWith('image/')

  async function handleDelete() {
    await removeConceptAsset(asset.id)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} title={asset.label} size="lg">
      {!url ? (
        <p className="font-ui text-caption text-ink-tertiary">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {isImage ? (
            <img src={url} alt={asset.label} className="max-h-[65vh] w-full rounded-md object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="font-ui text-caption text-ink-secondary">
                PDF preview isn't available inline — open it in a new tab instead.
              </p>
              <Button variant="primary" size="small" icon={<UploadSimple size={14} />} onClick={() => window.open(url, '_blank')}>
                Open PDF
              </Button>
            </div>
          )}
          <Button variant="destructive" size="small" icon={<Trash size={14} />} onClick={() => void handleDelete()}>
            Delete
          </Button>
        </div>
      )}
    </Dialog>
  )
}
