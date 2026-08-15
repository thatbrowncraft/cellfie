/**
 * MindMapStudio — Second Refinement §Part 1. A real, user-drawn
 * mind-map/flowchart canvas: draggable nodes with a shape/accent
 * choice, labeled connections between them, pan, zoom, and Fit to
 * Screen. Backed by `ConceptMapNode`/`ConceptMapEdge` (see
 * core/concepts/mindMapStudio.ts) — every node and edge is something
 * the person explicitly added; nothing here is generated.
 *
 * Mobile containment (§"MOBILE BEHAVIOUR", explicitly called out as
 * critical): the canvas is a fixed-height, `overflow-hidden` box with
 * `touch-action: none`. Panning/zooming/dragging all happen INSIDE
 * that box via a single CSS `transform: translate(...) scale(...)` on
 * an inner layer — the box's own size never changes, so nothing here
 * can push the surrounding page into horizontal scroll the way a
 * naturally-sized wide canvas would.
 *
 * Deliberately simplified vs. a full graphics editor (see this app's
 * own change notes for what's out of scope this pass): no undo/redo
 * history, no font-size/bold/italic controls, no custom border/
 * background colors beyond a small accent palette, no per-edge line
 * style choice (always a curved arrow). Each of those is a real
 * feature its own team could ask for later — dragging, connecting,
 * shapes, persistence, and mobile containment were the acceptance
 * criteria that actually mattered, and those are real here.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Plus,
  Trash,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  TreeStructure,
  UploadSimple,
  X,
  PencilSimple
} from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, EmptyState } from '@/shared/components'
import type { Concept, ConceptMapEdge, ConceptMapNode, ConceptMapNodeAccent, ConceptMapNodeShape, ConceptAsset } from '@/core/db'
import {
  addMapEdge,
  addMapNode,
  deleteMapEdge,
  deleteMapNode,
  listMapEdges,
  listMapNodes,
  updateMapNode
} from '@/core/concepts/mindMapStudio'
import { importConceptAssetFile, listConceptAssets, removeConceptAsset } from '@/core/concepts/assets'
import { useLiveQuery } from '@/core/db/useLiveQuery'
import { useOpfsObjectUrl } from '@/modules/library/hooks/useOpfsObjectUrl'

interface MindMapStudioProps {
  concept: Concept
}

type ToolMode = 'select' | 'connect' | 'delete'

const NODE_WIDTH = 140
const NODE_HEIGHT_ESTIMATE = 56
const CLICK_MOVE_THRESHOLD = 6
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2

const SHAPE_OPTIONS = [
  { value: 'rounded', label: 'Rounded rectangle' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'pill', label: 'Pill' },
  { value: 'diamond', label: 'Diamond' }
]

const ACCENT_OPTIONS = [
  { value: 'terracotta', label: 'Terracotta' },
  { value: 'olive', label: 'Olive' },
  { value: 'sage', label: 'Sage' },
  { value: 'ink', label: 'Neutral' }
]

const ACCENT_CLASSES: Record<ConceptMapNodeAccent, string> = {
  terracotta: 'bg-terracotta text-canvas border-terracotta',
  olive: 'bg-olive text-canvas border-olive',
  sage: 'bg-sage text-ink-primary border-sage',
  ink: 'bg-surface-raised text-ink-primary border-ink-tertiary'
}

function shapeClass(shape: ConceptMapNodeShape): string {
  switch (shape) {
    case 'rectangle':
      return 'rounded-none'
    case 'circle':
      return 'rounded-full aspect-square w-24 h-24 flex items-center justify-center text-center'
    case 'pill':
      return 'rounded-full'
    case 'diamond':
      return '' // handled via clip-path inline style, see render
    case 'rounded':
    default:
      return 'rounded-lg'
  }
}

export function MindMapStudio({ concept }: MindMapStudioProps) {
  const nodes = useLiveQuery<ConceptMapNode[]>(() => listMapNodes(concept.id), [concept.id], [])
  const edges = useLiveQuery<ConceptMapEdge[]>(() => listMapEdges(concept.id), [concept.id], [])
  const imports = useLiveQuery<ConceptAsset[]>(() => listConceptAssets(concept.id, 'mindmap-import'), [concept.id], [])

  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 420 })
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [mode, setMode] = useState<ToolMode>('select')
  const [connectFirst, setConnectFirst] = useState<string | undefined>(undefined)
  const [pendingEdge, setPendingEdge] = useState<{ source: string; target: string } | undefined>(undefined)
  const [edgeLabelInput, setEdgeLabelInput] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addShape, setAddShape] = useState<ConceptMapNodeShape>('rounded')
  const [addAccent, setAddAccent] = useState<ConceptMapNodeAccent>('terracotta')

  const [editingNode, setEditingNode] = useState<ConceptMapNode | undefined>(undefined)
  const [editLabel, setEditLabel] = useState('')
  const [editShape, setEditShape] = useState<ConceptMapNodeShape>('rounded')
  const [editAccent, setEditAccent] = useState<ConceptMapNodeAccent>('terracotta')

  const [confirmDeleteNode, setConfirmDeleteNode] = useState<ConceptMapNode | undefined>(undefined)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | undefined>(undefined)
  const [viewingImport, setViewingImport] = useState<ConceptAsset | undefined>(undefined)

  // Drag state kept in a ref (not React state) so pointermove doesn't
  // thrash re-renders — position only lands back in state/DB on pointerup.
  const dragRef = useRef<{
    kind: 'pan' | 'node'
    nodeId?: string
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  const [liveDrag, setLiveDrag] = useState<{ nodeId: string; x: number; y: number } | undefined>(undefined)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function toCanvasPoint(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    const localX = clientX - (rect?.left ?? 0)
    const localY = clientY - (rect?.top ?? 0)
    return { x: (localX - pan.x) / zoom, y: (localY - pan.y) / zoom }
  }

  function handleCanvasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return // a node/edge handles its own pointerdown
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startX: pan.x, startY: pan.y, moved: false }
  }

  function handleNodePointerDown(e: ReactPointerEvent<HTMLDivElement>, node: ConceptMapNode) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'node',
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: node.x,
      startY: node.y,
      moved: false
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    if (Math.abs(dx) > CLICK_MOVE_THRESHOLD || Math.abs(dy) > CLICK_MOVE_THRESHOLD) drag.moved = true

    if (drag.kind === 'pan') {
      setPan({ x: drag.startX + dx, y: drag.startY + dy })
    } else if (drag.kind === 'node' && drag.nodeId) {
      const newX = drag.startX + dx / zoom
      const newY = drag.startY + dy / zoom
      setLiveDrag({ nodeId: drag.nodeId, x: newX, y: newY })
    }
  }

  async function handlePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return

    if (drag.kind === 'node' && drag.nodeId) {
      if (drag.moved && liveDrag) {
        await updateMapNode(drag.nodeId, { x: liveDrag.x, y: liveDrag.y })
      } else if (!drag.moved) {
        handleNodeClick(drag.nodeId)
      }
      setLiveDrag(undefined)
    }
  }

  function handleNodeClick(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    if (mode === 'connect') {
      if (!connectFirst) {
        setConnectFirst(nodeId)
      } else if (connectFirst === nodeId) {
        setConnectFirst(undefined)
      } else {
        setPendingEdge({ source: connectFirst, target: nodeId })
        setEdgeLabelInput('')
        setConnectFirst(undefined)
      }
      return
    }

    if (mode === 'delete') {
      setConfirmDeleteNode(node)
      return
    }

    setEditingNode(node)
    setEditLabel(node.label)
    setEditShape(node.shape)
    setEditAccent(node.accent)
  }

  function handleEdgeClick(edgeId: string) {
    if (mode !== 'delete') return
    void deleteMapEdge(edgeId)
  }

  function openAddDialog() {
    setAddLabel('')
    setAddShape('rounded')
    setAddAccent('terracotta')
    setAddOpen(true)
  }

  async function handleAddNode() {
    const trimmed = addLabel.trim()
    if (!trimmed) return
    const center = toCanvasPoint(
      (containerRef.current?.getBoundingClientRect().left ?? 0) + canvasSize.width / 2,
      (containerRef.current?.getBoundingClientRect().top ?? 0) + canvasSize.height / 2
    )
    const cascadeOffset = (nodes.length % 6) * 22
    await addMapNode(concept.id, trimmed, { x: center.x + cascadeOffset - NODE_WIDTH / 2, y: center.y + cascadeOffset - NODE_HEIGHT_ESTIMATE / 2 }, addShape, addAccent)
    setAddOpen(false)
  }

  async function handleSaveEdit() {
    if (!editingNode) return
    const trimmed = editLabel.trim()
    if (!trimmed) return
    await updateMapNode(editingNode.id, { label: trimmed, shape: editShape, accent: editAccent })
    setEditingNode(undefined)
  }

  async function handleConfirmDeleteNode() {
    if (!confirmDeleteNode) return
    await deleteMapNode(confirmDeleteNode.id)
    setConfirmDeleteNode(undefined)
  }

  async function handleConfirmEdge() {
    if (!pendingEdge) return
    await addMapEdge(concept.id, pendingEdge.source, pendingEdge.target, edgeLabelInput.trim() || undefined)
    setPendingEdge(undefined)
  }

  function zoomBy(delta: number) {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + delta).toFixed(2)))))
  }

  function fitToScreen() {
    if (nodes.length === 0) {
      setPan({ x: 40, y: 40 })
      setZoom(1)
      return
    }
    const minX = Math.min(...nodes.map((n) => n.x))
    const minY = Math.min(...nodes.map((n) => n.y))
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT_ESTIMATE))
    const bboxW = Math.max(maxX - minX, 1)
    const bboxH = Math.max(maxY - minY, 1)
    const padding = 48
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((canvasSize.width - padding) / bboxW, (canvasSize.height - padding) / bboxH, 1.25)))
    setZoom(Number(nextZoom.toFixed(2)))
    setPan({
      x: (canvasSize.width - bboxW * nextZoom) / 2 - minX * nextZoom,
      y: (canvasSize.height - bboxH * nextZoom) / 2 - minY * nextZoom
    })
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setImportError('Only images or PDFs can be imported.')
      return
    }
    setImportError(undefined)
    setImporting(true)
    try {
      await importConceptAssetFile(concept.id, 'mindmap-import', file)
    } catch {
      setImportError('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  function nodePosition(node: ConceptMapNode) {
    if (liveDrag && liveDrag.nodeId === node.id) return { x: liveDrag.x, y: liveDrag.y }
    return { x: node.x, y: node.y }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar — Second Refinement §"MIND MAP TOOLBAR". Wraps into a
          compact strip on mobile rather than forcing horizontal scroll. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2">
        <Button variant="secondary" size="small" icon={<Plus size={14} />} onClick={openAddDialog}>
          Add node
        </Button>
        <Button
          variant={mode === 'connect' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => {
            setMode(mode === 'connect' ? 'select' : 'connect')
            setConnectFirst(undefined)
          }}
        >
          Connect
        </Button>
        <Button
          variant={mode === 'delete' ? 'destructive' : 'secondary'}
          size="small"
          icon={<Trash size={14} />}
          onClick={() => setMode(mode === 'delete' ? 'select' : 'delete')}
        >
          Delete
        </Button>
        <div className="mx-1 h-6 w-px bg-border" aria-hidden />
        <Button variant="secondary" size="small" icon={<MagnifyingGlassMinus size={14} />} onClick={() => zoomBy(-0.15)} aria-label="Zoom out" />
        <Button variant="secondary" size="small" icon={<MagnifyingGlassPlus size={14} />} onClick={() => zoomBy(0.15)} aria-label="Zoom in" />
        <Button variant="secondary" size="small" icon={<TreeStructure size={14} />} onClick={fitToScreen}>
          Fit to screen
        </Button>
        <div className="mx-1 h-6 w-px bg-border" aria-hidden />
        <label className="inline-flex">
          <Button
            variant="secondary"
            size="small"
            icon={<UploadSimple size={14} />}
            disabled={importing}
            onClick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.click()}
          >
            {importing ? 'Importing…' : 'Import mind map'}
          </Button>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void handleImportFile(e)} />
        </label>
      </div>

      {mode === 'connect' && (
        <p className="font-ui text-caption text-ink-tertiary">
          {connectFirst ? 'Now tap the node to connect it to.' : 'Tap a node to start a connection, then tap the node to connect it to.'}
        </p>
      )}
      {mode === 'delete' && <p className="font-ui text-caption text-ink-tertiary">Tap a node or connection to delete it.</p>}
      {importError && <p className="font-ui text-caption text-error">{importError}</p>}

      {/* Bounded canvas — see this file's header comment for why this
          never lets the map overflow the page on mobile. */}
      {nodes.length === 0 ? (
        <EmptyState
          icon={<TreeStructure size={32} />}
          title="No concept map yet."
          description="Build your own map as you study this concept. Try starting with the concept in the center, then branch into structure, function, process, and applications."
        />
      ) : (
        <div
          ref={containerRef}
          className="relative h-[420px] w-full touch-none overflow-hidden rounded-md border border-border bg-surface-raised"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => void handlePointerUp()}
          onPointerCancel={() => void handlePointerUp()}
        >
          <div
            className="absolute left-0 top-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          >
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
              <defs>
                <marker id="mm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-ink-tertiary" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const source = nodeById.get(edge.sourceNodeId)
                const target = nodeById.get(edge.targetNodeId)
                if (!source || !target) return null
                const sp = nodePosition(source)
                const tp = nodePosition(target)
                const x1 = sp.x + NODE_WIDTH / 2
                const y1 = sp.y + NODE_HEIGHT_ESTIMATE / 2
                const x2 = tp.x + NODE_WIDTH / 2
                const y2 = tp.y + NODE_HEIGHT_ESTIMATE / 2
                const midX = (x1 + x2) / 2
                const midY = (y1 + y2) / 2
                return (
                  <g key={edge.id} className="pointer-events-auto" style={{ cursor: mode === 'delete' ? 'pointer' : 'default' }} onClick={() => handleEdgeClick(edge.id)}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink-tertiary" strokeWidth={1.5} markerEnd="url(#mm-arrow)" />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16} />
                    {edge.label && (
                      <text x={midX} y={midY - 4} textAnchor="middle" className="fill-ink-tertiary font-ui text-[10px]">
                        {edge.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {nodes.map((node) => {
              const pos = nodePosition(node)
              const isConnectSource = connectFirst === node.id
              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                  className={`absolute flex min-h-[44px] w-[140px] cursor-grab select-none items-center justify-center border px-3 py-2 text-center font-ui text-caption font-medium leading-snug active:cursor-grabbing ${ACCENT_CLASSES[node.accent]} ${shapeClass(node.shape)} ${isConnectSource ? 'ring-2 ring-offset-2 ring-ink-primary' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    ...(node.shape === 'diamond' ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', padding: '28px 20px' } : {})
                  }}
                >
                  {node.label}
                </div>
              )
            })}
          </div>

          <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-surface/80 px-2 py-1 font-ui text-micro text-ink-tertiary">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      )}

      {/* Imported mind maps stay a separate list from the editable map —
          they're a static image/PDF, not editable nodes. */}
      {imports.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Imported mind maps</h4>
          <div className="flex flex-wrap gap-2">
            {imports.map((asset) => (
              <ImportedMapThumb key={asset.id} asset={asset} onView={() => setViewingImport(asset)} onDelete={() => void removeConceptAsset(asset.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Add node dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add node">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            placeholder="Node text"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
          />
          <Dropdown label="Shape" options={SHAPE_OPTIONS} value={addShape} onChange={(v) => setAddShape(v as ConceptMapNodeShape)} />
          <Dropdown label="Color" options={ACCENT_OPTIONS} value={addAccent} onChange={(v) => setAddAccent(v as ConceptMapNodeAccent)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="small" disabled={!addLabel.trim()} onClick={() => void handleAddNode()}>
              Add
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit node dialog */}
      <Dialog open={Boolean(editingNode)} onClose={() => setEditingNode(undefined)} title="Edit node">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary"
          />
          <Dropdown label="Shape" options={SHAPE_OPTIONS} value={editShape} onChange={(v) => setEditShape(v as ConceptMapNodeShape)} />
          <Dropdown label="Color" options={ACCENT_OPTIONS} value={editAccent} onChange={(v) => setEditAccent(v as ConceptMapNodeAccent)} />
          <div className="flex justify-between gap-3">
            <Button
              variant="destructive"
              size="small"
              icon={<Trash size={14} />}
              onClick={() => {
                if (editingNode) setConfirmDeleteNode(editingNode)
                setEditingNode(undefined)
              }}
            >
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="small" onClick={() => setEditingNode(undefined)}>
                Cancel
              </Button>
              <Button variant="primary" size="small" icon={<PencilSimple size={14} />} disabled={!editLabel.trim()} onClick={() => void handleSaveEdit()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete node confirm */}
      <Dialog open={Boolean(confirmDeleteNode)} onClose={() => setConfirmDeleteNode(undefined)} title="Delete this node?">
        <div className="flex flex-col gap-4">
          <p className="font-body text-body text-ink-secondary">
            This also deletes any connections to or from "{confirmDeleteNode?.label}". This can't be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setConfirmDeleteNode(undefined)}>
              Cancel
            </Button>
            <Button variant="destructive" size="small" onClick={() => void handleConfirmDeleteNode()}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* New edge label prompt */}
      <Dialog open={Boolean(pendingEdge)} onClose={() => setPendingEdge(undefined)} title="Label this connection (optional)">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={edgeLabelInput}
            onChange={(e) => setEdgeLabelInput(e.target.value)}
            placeholder="e.g. causes, part of, leads to…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-body text-body text-ink-primary placeholder:text-ink-tertiary"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="small" onClick={() => setPendingEdge(undefined)}>
              Cancel
            </Button>
            <Button variant="primary" size="small" onClick={() => void handleConfirmEdge()}>
              Connect
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Imported map viewer */}
      <Dialog open={Boolean(viewingImport)} onClose={() => setViewingImport(undefined)} title={viewingImport?.label ?? ''} size="lg">
        {viewingImport && <ImportedMapPreview asset={viewingImport} />}
      </Dialog>
    </div>
  )
}

function ImportedMapThumb({ asset, onView, onDelete }: { asset: ConceptAsset; onView: () => void; onDelete: () => void }) {
  const url = useOpfsObjectUrl(asset.filePath)
  const isImage = asset.mimeType?.startsWith('image/')
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onView}
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-border bg-surface"
      >
        {isImage && url ? (
          <img src={url} alt={asset.label} className="h-full w-full object-cover" />
        ) : (
          <span className="font-ui text-micro text-ink-tertiary">PDF</span>
        )}
      </button>
      <button
        type="button"
        aria-label="Delete import"
        onClick={onDelete}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-canvas opacity-0 group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function ImportedMapPreview({ asset }: { asset: ConceptAsset }) {
  const url = useOpfsObjectUrl(asset.filePath)
  if (!url) return <p className="font-ui text-caption text-ink-tertiary">Loading…</p>
  if (asset.mimeType?.startsWith('image/')) return <img src={url} alt={asset.label} className="max-h-[70vh] w-full object-contain" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="font-ui text-caption font-medium text-olive hover:underline">
      Open PDF in new tab
    </a>
  )
}
