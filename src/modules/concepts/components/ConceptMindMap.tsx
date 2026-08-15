import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadSimple, Link, NotePencil, TreeStructure, Trash, Sparkle } from '@phosphor-icons/react'
import { EmptyState, Button, Dialog } from '@/shared/components'
import { buildStudyMap, type Concept, type DetailedStudyModule, type MeshClassification, type MindMapNode } from '@/core/concepts'
import { addMindMapNode, importConceptAssetFile, listConceptAssets, removeConceptAsset } from '@/core/concepts/assets'
import type { ConceptAsset } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { useOpfsObjectUrl } from '@/modules/library/hooks/useOpfsObjectUrl'
import { StudyMapView } from './StudyMapView'

interface ConceptMindMapProps {
  root: MindMapNode
  concept: Concept
  /** Concept Hub Quality Pass §2 — Detailed Study's already-verified
   *  modules, reused (never re-fetched) to build the "Study Map" tab.
   *  See core/concepts/studyMap.ts. */
  detailedStudyModules: DetailedStudyModule[]
  /** Raw MeSH classification, reused (never re-fetched) so the Study
   *  Map can build its relationship skeleton straight from MeSH's own
   *  typed parent/child/associated-concept data instead of reverse-
   *  parsing Detailed Study's rendered bullets. */
  mesh?: MeshClassification
}

/**
 * Mind map for a single concept — Concept Hub Refinement. Plain
 * vertical/indented tree (flexbox, not SVG): wraps naturally on
 * mobile, needs no coordinate math, scrolls the same way the rest of
 * the page does. Built purely from `buildConceptMindMap`
 * (core/concepts/graph.ts), which follows ONLY user-created
 * (`origin: 'manual'`) ConceptRelation rows plus the person's own
 * free-text annotation nodes (ConceptAsset kind 'mindmap-node') — see
 * that file's own header comment. No book nodes, no raw source
 * strings, no same-page/shared-tag/literature-co-occurrence inference,
 * no invented categories, and — the point of this refinement — no
 * scientific/literature edges of any kind.
 *
 * "Add Node to Graph" and "Import Mind Map (Image/PDF)" let the person
 * extend this view with their own material without ever creating a
 * ConceptRelation: an added node is a `ConceptAsset` annotation with no
 * edge to any real Concept, and an imported diagram is stored
 * separately again (kind 'mindmap-import') and listed below the tree,
 * not merged into it — see core/concepts/assets.ts.
 */
export function ConceptMindMap({ root, concept, detailedStudyModules, mesh }: ConceptMindMapProps) {
  const navigate = useNavigate()
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [nodeLabel, setNodeLabel] = useState('')
  const [savingNode, setSavingNode] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | undefined>(undefined)
  const [viewingImport, setViewingImport] = useState<ConceptAsset | undefined>(undefined)

  const imports = useLiveQuery<ConceptAsset[]>(() => listConceptAssets(concept.id, 'mindmap-import'), [concept.id], [])

  // Concept Hub Quality Pass §2/§5 — "My Concept Map" (user-created
  // ConceptRelations only) and "Study Map" (generated from verified
  // scientific data, see studyMap.ts) are two clearly separate views,
  // never merged into one graph. Defaults to whichever actually has
  // something to show: the person's own map if they've built one,
  // otherwise the generated Study Map so the tab isn't just a dead end.
  const studyMap = useMemo(() => buildStudyMap(concept, detailedStudyModules, mesh), [concept, detailedStudyModules, mesh])
  const [view, setView] = useState<'mine' | 'study'>(root.children.length > 0 ? 'mine' : 'study')

  async function handleAddNode() {
    const trimmed = nodeLabel.trim()
    if (!trimmed) return
    setSavingNode(true)
    try {
      await addMindMapNode(concept.id, trimmed)
      setNodeLabel('')
      setAddNodeOpen(false)
    } finally {
      setSavingNode(false)
    }
  }

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
      await importConceptAssetFile(concept.id, 'mindmap-import', file)
    } catch {
      setImportError("Couldn't import that file. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="small" icon={<NotePencil size={14} />} onClick={() => setAddNodeOpen(true)}>
          Add node to graph
        </Button>
        <label className="relative inline-flex">
          <span className="pointer-events-none">
            <Button variant="secondary" size="small" icon={<UploadSimple size={14} />} disabled={importing} type="button">
              {importing ? 'Importing…' : 'Import mind map (image/PDF)'}
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
      </div>
      {importError && <p className="font-ui text-caption text-error">{importError}</p>}

      {/* Concept Hub Quality Pass §5 — "My Concept Map" and "Study Map"
          are two distinct views of two distinct data sources; switching
          between them never mixes the two into one graph. */}
      <div className="flex gap-2 border-b border-border pb-3">
        <Button variant={view === 'mine' ? 'primary' : 'secondary'} size="small" onClick={() => setView('mine')}>
          My concept map
        </Button>
        <Button
          variant={view === 'study' ? 'primary' : 'secondary'}
          size="small"
          icon={<Sparkle size={14} />}
          onClick={() => setView('study')}
        >
          Study map
        </Button>
      </div>

      {view === 'mine' ? (
        root.children.length === 0 ? (
          <EmptyState
            icon={<TreeStructure size={32} />}
            title="No concept connections yet."
            description="Connect this concept to another concept from the Connections tab, or add a node of your own above, and this mind map will branch out from here."
          />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className="rounded-lg bg-terracotta px-4 py-2 font-ui text-body font-medium text-canvas">
              {root.label}
            </div>
            <div className="flex w-full flex-col gap-2 border-l-2 border-border pl-4">
              {root.children.map((child) => (
                <MindMapBranch key={child.id} node={child} onNavigate={(id) => navigate(`/concepts/${id}`)} />
              ))}
            </div>
          </div>
        )
      ) : studyMap ? (
        <div className="flex flex-col gap-2">
          <p className="font-ui text-caption text-ink-tertiary">
            Generated from this concept's verified study data — a visual explanation, not a connections graph. It's
            never saved as a Connection and never appears in "My concept map" above.
          </p>
          <StudyMapView map={studyMap} />
        </div>
      ) : (
        <EmptyState
          icon={<Sparkle size={32} />}
          title="Not enough verified study data yet."
          description="Once Detailed Study has verified content for this concept (Definition, Classification, Structure, Mechanism, or Relationships), a Study Map will generate here automatically."
        />
      )}

      {imports.length > 0 && (
        <div>
          <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Imported maps
          </h3>
          <div className="flex flex-col gap-2">
            {imports.map((asset) => (
              <ImportedAssetRow key={asset.id} asset={asset} onView={() => setViewingImport(asset)} />
            ))}
          </div>
        </div>
      )}

      <Dialog open={addNodeOpen} onClose={() => setAddNodeOpen(false)} title="Add node to graph">
        <div className="flex flex-col gap-3">
          <p className="font-ui text-caption text-ink-secondary">
            A note for yourself on this mind map — not connected to any other concept.
          </p>
          <input
            autoFocus
            value={nodeLabel}
            onChange={(e) => setNodeLabel(e.target.value)}
            placeholder="e.g. Remember for the practical exam"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setAddNodeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={savingNode || !nodeLabel.trim()}
              onClick={() => void handleAddNode()}
            >
              {savingNode ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      </Dialog>

      {viewingImport && <ImportViewerDialog asset={viewingImport} onClose={() => setViewingImport(undefined)} />}
    </div>
  )
}

function ImportedAssetRow({ asset, onView }: { asset: ConceptAsset; onView: () => void }) {
  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    await removeConceptAsset(asset.id)
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <button
        type="button"
        onClick={onView}
        className="flex min-w-0 flex-1 items-center gap-2 text-left font-ui text-caption text-ink-primary hover:underline"
      >
        <UploadSimple size={14} className="shrink-0 text-ink-tertiary" aria-hidden />
        <span className="truncate">{asset.label}</span>
      </button>
      <button
        type="button"
        onClick={(e) => void handleDelete(e)}
        aria-label={`Delete ${asset.label}`}
        className="shrink-0 text-ink-tertiary hover:text-error"
      >
        <Trash size={14} />
      </button>
    </div>
  )
}

function ImportViewerDialog({ asset, onClose }: { asset: ConceptAsset; onClose: () => void }) {
  const url = useOpfsObjectUrl(asset.filePath)
  const isImage = asset.mimeType?.startsWith('image/')

  return (
    <Dialog open onClose={onClose} title={asset.label} size="lg">
      {!url ? (
        <p className="font-ui text-caption text-ink-tertiary">Loading…</p>
      ) : isImage ? (
        <img src={url} alt={asset.label} className="max-h-[70vh] w-full rounded-md object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="font-ui text-caption text-ink-secondary">
            PDF preview isn't available inline — open it in a new tab instead.
          </p>
          <Button variant="primary" size="small" icon={<UploadSimple size={14} />} onClick={() => window.open(url, '_blank')}>
            Open PDF
          </Button>
        </div>
      )}
    </Dialog>
  )
}

function MindMapBranch({ node, onNavigate }: { node: MindMapNode; onNavigate: (id: string) => void }) {
  if (node.isAnnotation) {
    return (
      <div className="flex w-fit max-w-full items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface px-3 py-1.5 font-ui text-caption text-ink-secondary">
        <NotePencil size={12} className="shrink-0 text-ink-tertiary" aria-hidden />
        {node.label}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className="flex w-fit max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-left font-ui text-caption font-medium text-ink-primary hover:bg-surface-raised"
      >
        <Link size={12} className="shrink-0 text-ink-tertiary" aria-hidden />
        {node.label}
      </button>
      {node.children.length > 0 && (
        <div className="flex flex-col gap-2 border-l-2 border-border pl-4">
          {node.children.map((child) => (
            <MindMapBranch key={child.id} node={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
