import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookmarkSimple,
  Copy,
  Plus,
  Star,
  Trash,
  WarningCircle
} from '@phosphor-icons/react'
import { Button, Dialog, Dropdown, EmptyState } from '../../shared/components'
import { EmptyStateLayout } from '../../shared/layouts'
import { getCuratedComparisonById } from '../../core/comparison/registry'
import {
  deleteSavedComparison,
  duplicateSavedComparison,
  findOverlayForCurated,
  hideCuratedAspect,
  mergeCuratedWithOverlay,
  saveCuratedComparison,
  setNotes,
  toggleFavoriteByRouteId,
  updateCustomAspects,
  upsertAspectOverride
} from '../../core/comparison/userComparisons'
import { recordComparisonViewed, removeFromRecentComparisons } from '../../core/comparison/recentlyViewed'
import { getSuggestedAspects } from '../../core/comparison/domainPresets'
import { getComparisonTagline, COMPLETION_TAGLINE } from '../../core/comparison/microcopy'
import type { Comparison, ComparisonAspect } from '../../core/comparison/types'
import { COMPARISON_DIFFICULTY_LABELS, COMPARISON_FREQUENCY_LABELS } from '../../core/comparison/types'
import { db } from '../../core/db'
import { ComparisonWorkspaceView, type StudyMode } from './components/ComparisonWorkspaceView'
import { ComparisonSourcesPanel } from './components/ComparisonSourcesPanel'

type LoadState = 'loading' | 'found' | 'not-found'

const STUDY_MODE_OPTIONS = [
  { value: 'off', label: 'Study Mode: Off' },
  { value: 'column-mask', label: 'Column Mask (hide Item B)' },
  { value: 'matrix-blind', label: 'Matrix Blind (hide everything)' },
  { value: 'key-difference-focus', label: 'Key Difference Focus' }
]

/**
 * Comparison workspace (brief §19/§20/§24). Handles both entry points
 * transparently via the canonical route-id scheme:
 *  - a curated comparison id → renders curated content merged with any
 *    local overlay, and every edit lazily creates that overlay
 *    (brief §13's "Curated Comparison + User Editable Layer").
 *  - a custom saved comparison's own id → renders and edits it directly.
 *
 * A missing/deleted id (stale Dashboard recent, deleted custom
 * comparison, curated content removed from a future build) renders a
 * calm not-found state rather than crashing (brief §31).
 */
export function ComparisonWorkspacePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [comparison, setComparison] = useState<(Comparison & { notes?: string }) | null>(null)
  const [isCurated, setIsCurated] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [studyMode, setStudyMode] = useState<StudyMode>('off')
  const [editMode, setEditMode] = useState(false)
  const [sourcesFor, setSourcesFor] = useState<{ aspect: ComparisonAspect; side: 'A' | 'B' } | null>(null)
  const [showAddAspect, setShowAddAspect] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [completed, setCompleted] = useState(false)

  async function load() {
    setLoadState('loading')
    const curated = getCuratedComparisonById(id)
    if (curated) {
      const overlay = await findOverlayForCurated(id)
      const merged = mergeCuratedWithOverlay(curated, overlay)
      setComparison(merged)
      setIsCurated(true)
      setNotesDraft(merged.notes ?? '')
      setFavorite(Boolean(overlay?.favorite))
      setLoadState('found')
      void recordComparisonViewed({ id, itemAName: curated.itemA.name, itemBName: curated.itemB.name, domain: curated.domain })
      return
    }
    const record = await db.savedComparisons.get(id)
    if (record?.sourceType === 'custom' && record.itemA && record.itemB && record.aspects) {
      const custom: Comparison & { notes?: string } = {
        id: record.id,
        domain: (record.domain as Comparison['domain']) ?? 'custom',
        difficulty: (record.difficulty as Comparison['difficulty']) ?? 'intermediate',
        frequency: (record.frequency as Comparison['frequency']) ?? 'common',
        audience: ['student', 'lab-learner', 'researcher'],
        tags: [],
        itemA: record.itemA,
        itemB: record.itemB,
        aspects: record.aspects,
        notes: record.notes
      }
      setComparison(custom)
      setIsCurated(false)
      setNotesDraft(record.notes ?? '')
      setFavorite(record.favorite)
      setLoadState('found')
      void recordComparisonViewed({ id, itemAName: record.itemA.name, itemBName: record.itemB.name, domain: custom.domain })
      return
    }
    setLoadState('not-found')
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const tagline = isCurated ? getComparisonTagline(id) : undefined

  async function handleToggleFavorite() {
    const next = !favorite
    setFavorite(next)
    await toggleFavoriteByRouteId(id, next)
  }

  async function persistAspectChange(aspectId: string, side: 'A' | 'B', value: string) {
    if (!comparison) return
    const nextAspects = comparison.aspects.map((a) => (a.id === aspectId ? { ...a, [side === 'A' ? 'valueA' : 'valueB']: value } : a))
    setComparison({ ...comparison, aspects: nextAspects })
    const changed = nextAspects.find((a) => a.id === aspectId)!
    if (isCurated) {
      await upsertAspectOverride(id, changed)
    } else {
      await updateCustomAspects(id, nextAspects)
    }
  }

  async function handleToggleKeyDifference(aspectId: string) {
    if (!comparison) return
    const nextAspects = comparison.aspects.map((a) => (a.id === aspectId ? { ...a, isKeyDifference: !a.isKeyDifference } : a))
    setComparison({ ...comparison, aspects: nextAspects })
    const changed = nextAspects.find((a) => a.id === aspectId)!
    if (isCurated) {
      await upsertAspectOverride(id, changed)
    } else {
      await updateCustomAspects(id, nextAspects)
    }
  }

  async function handleRemoveAspect(aspectId: string) {
    if (!comparison) return
    const nextAspects = comparison.aspects.filter((a) => a.id !== aspectId)
    setComparison({ ...comparison, aspects: nextAspects })
    if (isCurated) {
      await hideCuratedAspect(id, aspectId)
    } else {
      await updateCustomAspects(id, nextAspects)
    }
  }

  async function handleMoveAspect(aspectId: string, direction: 'up' | 'down') {
    if (!comparison) return
    const index = comparison.aspects.findIndex((a) => a.id === aspectId)
    if (index === -1) return
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= comparison.aspects.length) return
    const nextAspects = [...comparison.aspects]
    ;[nextAspects[index], nextAspects[swapWith]] = [nextAspects[swapWith], nextAspects[index]]
    setComparison({ ...comparison, aspects: nextAspects })
    // Reordering only ever persists for custom comparisons — a curated comparison's own aspect order stays as shipped; the overlay model (brief §13) tracks value/visibility overrides, not row order, keeping "what did the user actually change" simple and inspectable.
    if (!isCurated) {
      await updateCustomAspects(id, nextAspects)
    }
  }

  async function handleAddAspect(presetId: string, presetLabel: string) {
    if (!comparison) return
    const newAspect: ComparisonAspect = { id: presetId, label: presetLabel, valueA: '', valueB: '' }
    const nextAspects = [...comparison.aspects, newAspect]
    setComparison({ ...comparison, aspects: nextAspects })
    setShowAddAspect(false)
    if (isCurated) {
      await upsertAspectOverride(id, newAspect)
    } else {
      await updateCustomAspects(id, nextAspects)
    }
  }

  async function handleSaveNotes() {
    if (!comparison) return
    setComparison({ ...comparison, notes: notesDraft })
    if (isCurated) {
      const overlay = await saveCuratedComparison(id)
      await setNotes(overlay.id, notesDraft)
    } else {
      await setNotes(id, notesDraft)
    }
  }

  async function handleDuplicate() {
    const dup = await duplicateSavedComparison(id)
    if (dup) navigate(`/comparison/${dup.id}`)
  }

  async function handleDelete() {
    if (isCurated) {
      const overlay = await findOverlayForCurated(id)
      if (overlay) await deleteSavedComparison(overlay.id)
    } else {
      await deleteSavedComparison(id)
      await removeFromRecentComparisons(id)
    }
    setShowDeleteConfirm(false)
    navigate('/comparison', { replace: true })
  }

  const suggestedAspects = useMemo(() => {
    if (!comparison) return []
    const existingIds = new Set(comparison.aspects.map((a) => a.id))
    return getSuggestedAspects(comparison.domain).filter((a) => !existingIds.has(a.id))
  }, [comparison])

  if (loadState === 'loading') {
    return (
      <EmptyStateLayout>
        <EmptyState title="Loading comparison…" />
      </EmptyStateLayout>
    )
  }

  if (loadState === 'not-found' || !comparison) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={28} />}
          title="Comparison not found"
          description="This comparison doesn't exist, or it may have been deleted."
          action={
            <Button variant="secondary" onClick={() => navigate('/comparison')}>
              Back to Comparison Studio
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <button onClick={() => navigate('/comparison')} className="mb-4 inline-flex items-center gap-1.5 font-ui text-caption text-ink-secondary hover:text-ink-primary">
        <ArrowLeft size={14} /> Comparison Studio
      </button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink-primary">
            {comparison.itemA.name} <span className="text-ink-tertiary">vs</span> {comparison.itemB.name}
          </h1>
          {tagline && <p className="mt-1 font-body text-body italic text-ink-tertiary">{tagline}</p>}
          {comparison.overview && <p className="mt-2 max-w-2xl font-body text-body text-ink-secondary">{comparison.overview}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-ui text-micro text-ink-tertiary">
            <span>{COMPARISON_DIFFICULTY_LABELS[comparison.difficulty]}</span>
            <span aria-hidden>·</span>
            <span>{COMPARISON_FREQUENCY_LABELS[comparison.frequency]}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="small"
            icon={<Star size={16} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-terracotta' : undefined} />}
            onClick={handleToggleFavorite}
          >
            {favorite ? 'Favorited' : 'Favorite'}
          </Button>
          <Button variant="secondary" size="small" icon={<Copy size={16} />} onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button variant={editMode ? 'primary' : 'secondary'} size="small" onClick={() => setEditMode((v) => !v)}>
            {editMode ? 'Done editing' : 'Edit'}
          </Button>
          <Button variant="destructive" size="small" icon={<Trash size={16} />} onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </Button>
        </div>
      </header>

      <div className="mb-6 max-w-xs">
        <Dropdown label="Study Mode" options={STUDY_MODE_OPTIONS} value={studyMode} onChange={(v) => setStudyMode(v as StudyMode)} />
      </div>

      <ComparisonWorkspaceView
        comparison={comparison}
        editable={editMode}
        studyMode={studyMode}
        onChangeAspectValue={persistAspectChange}
        onToggleKeyDifference={handleToggleKeyDifference}
        onRemoveAspect={handleRemoveAspect}
        onMoveAspect={handleMoveAspect}
        onFillFromSource={(aspect, side) => setSourcesFor({ aspect, side })}
      />

      {editMode && (
        <div className="mt-4">
          <Button variant="tertiary" size="small" icon={<Plus size={14} />} onClick={() => setShowAddAspect(true)}>
            Add aspect
          </Button>
        </div>
      )}

      {comparison.overlay && (
        <div className="mt-8 flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-5">
          <h2 className="font-display text-h3 font-medium text-ink-primary">Learning Overlays</h2>
          {comparison.overlay.examHighYieldNote && (
            <p className="font-body text-body text-ink-secondary">
              <strong className="text-ink-primary">Exam High-Yield:</strong> {comparison.overlay.examHighYieldNote}
            </p>
          )}
          {comparison.overlay.memoryTrick && (
            <p className="font-body text-body text-ink-secondary">
              <strong className="text-ink-primary">Memory Trick:</strong> {comparison.overlay.memoryTrick}
            </p>
          )}
          {comparison.overlay.choiceRule && (
            <p className="font-body text-body text-ink-secondary">
              <strong className="text-ink-primary">Choice Rule:</strong> {comparison.overlay.choiceRule}
            </p>
          )}
          {comparison.overlay.commonMisconception && (
            <p className="font-body text-body text-ink-secondary">
              <strong className="text-ink-primary">Common Misconception:</strong> {comparison.overlay.commonMisconception}
            </p>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-2 font-display text-h3 font-medium text-ink-primary">Your Notes</h2>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="Add a personal note about this comparison…"
          rows={3}
          className="w-full resize-y rounded-sm border border-border bg-canvas p-3 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
        />
      </div>

      <div className="mt-8 flex items-center justify-between rounded-md border border-border bg-surface p-4">
        <p className="font-body text-body text-ink-secondary">Done comparing for now?</p>
        <Button variant="secondary" size="small" icon={<BookmarkSimple size={16} />} onClick={() => setCompleted(true)}>
          Mark as reviewed
        </Button>
      </div>
      {completed && <p className="mt-2 text-center font-body text-micro italic text-ink-tertiary">{COMPLETION_TAGLINE}</p>}

      {/* Fill-from-source panel, scoped to one aspect + side */}
      <Dialog open={Boolean(sourcesFor)} onClose={() => setSourcesFor(null)} title="Fill from a source" size="lg">
        {sourcesFor && (
          <ComparisonSourcesPanel
            title={`${sourcesFor.aspect.label} — ${sourcesFor.side === 'A' ? comparison.itemA.name : comparison.itemB.name}`}
            topicId={`${id}:${sourcesFor.aspect.id}:${sourcesFor.side}`}
            onAccept={(draft) => {
              persistAspectChange(sourcesFor.aspect.id, sourcesFor.side, draft.text)
            }}
          />
        )}
      </Dialog>

      {/* Add aspect */}
      <Dialog open={showAddAspect} onClose={() => setShowAddAspect(false)} title="Add an aspect">
        {suggestedAspects.length === 0 ? (
          <p className="font-body text-body text-ink-secondary">Every suggested aspect for this domain is already in this comparison.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {suggestedAspects.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  onClick={() => handleAddAspect(preset.id, preset.label)}
                  className="w-full rounded-sm px-3 py-2 text-left font-ui text-body text-ink-primary hover:bg-surface-raised"
                >
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={isCurated ? 'Remove your saved copy?' : 'Delete this comparison?'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          {isCurated
            ? "This only removes your saved copy and any edits/notes. Cellfie's curated comparison itself stays available under Discover."
            : 'This permanently removes your custom comparison and cannot be undone.'}
        </p>
      </Dialog>
    </div>
  )
}
