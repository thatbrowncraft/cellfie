import { useState } from 'react'
import { ArrowDown, ArrowUp, Books, Globe, Lightning, NotePencil, Sparkle, Trash } from '@phosphor-icons/react'
import { cn } from '../../../shared/utils/cn'
import { Button, Tabs } from '../../../shared/components'
import type { Comparison, ComparisonAspect } from '../../../core/comparison/types'
import { KEY_DIFFERENCE_TAGLINE, STUDY_MODE_TAGLINE } from '../../../core/comparison/microcopy'
import { ProvenanceBadge } from './ProvenanceBadge'

export type StudyMode = 'off' | 'column-mask' | 'matrix-blind' | 'key-difference-focus'

interface ComparisonWorkspaceViewProps {
  comparison: Comparison
  editable: boolean
  /** Whether this comparison has a curated JSON backing it at all — see `curatedAspectIds` for the per-row distinction. */
  isCurated?: boolean
  /** Aspect ids that exist in the *shipped* curated JSON (correction-pass Part 5/6/9) — these rows protect their curated value and only accept a separate "your note" layer, plus fill-ins where curated left a side blank. Any aspect id NOT in this set (a fully custom comparison's aspects, or one the user added themselves on top of a curated comparison) stays directly, fully editable exactly as before. */
  curatedAspectIds?: Set<string>
  studyMode?: StudyMode
  onChangeAspectValue?: (aspectId: string, side: 'A' | 'B', value: string) => void
  /** Persists the user's own annotation for one side of a curated aspect — always separate from the curated value itself. */
  onChangeNote?: (aspectId: string, side: 'A' | 'B', note: string) => void
  onToggleKeyDifference?: (aspectId: string) => void
  onRemoveAspect?: (aspectId: string) => void
  onMoveAspect?: (aspectId: string, direction: 'up' | 'down') => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B', defaultTab?: 'my-library' | 'online') => void
}

function isMasked(studyMode: StudyMode, aspect: ComparisonAspect, side: 'A' | 'B'): boolean {
  if (studyMode === 'matrix-blind') return true
  if (studyMode === 'column-mask') return side === 'B'
  if (studyMode === 'key-difference-focus') return Boolean(aspect.isKeyDifference)
  return false
}

/** One masked/revealable cell value — click to reveal, matching brief §24 "the user reveals answers interactively." */
function MaskableValue({ value, masked }: { value: string; masked: boolean }) {
  const [revealed, setRevealed] = useState(false)
  if (!masked || revealed) {
    return <span>{value}</span>
  }
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="rounded-sm border border-dashed border-border-strong px-3 py-1 font-ui text-caption text-ink-tertiary hover:border-olive hover:text-olive"
    >
      Tap to reveal
    </button>
  )
}

export function ComparisonWorkspaceView({
  comparison,
  editable,
  isCurated = false,
  curatedAspectIds,
  studyMode = 'off',
  onChangeAspectValue,
  onChangeNote,
  onToggleKeyDifference,
  onRemoveAspect,
  onMoveAspect,
  onFillFromSource
}: ComparisonWorkspaceViewProps) {
  return (
    <div>
      {/* Desktop: real <table>, matching ComparisonTable's semantics (real thead/tbody, never a div-grid faux-table). */}
      <div className="hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-surface-raised">
              <th scope="col" className="w-48 px-4 py-3 text-left font-ui text-ui font-medium text-ink-secondary">
                Aspect
              </th>
              <th scope="col" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
                {comparison.itemA.name}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
                {comparison.itemB.name}
              </th>
              {editable && <th scope="col" className="w-24 px-2 py-3" aria-label="Row actions" />}
            </tr>
          </thead>
          <tbody>
            {comparison.aspects.map((aspect, index) => {
              const locked = isCurated && Boolean(curatedAspectIds?.has(aspect.id))
              return (
                <tr
                  key={aspect.id}
                  className={cn(
                    'border-t border-border align-top',
                    aspect.isKeyDifference ? 'bg-terracotta/5' : index % 2 === 1 ? 'bg-surface' : undefined
                  )}
                >
                  <th scope="row" className="px-4 py-3 text-left align-top font-ui text-ui font-medium text-ink-secondary">
                    <div className="flex items-start gap-1.5">
                      {aspect.isKeyDifference && <Sparkle size={14} className="mt-0.5 shrink-0 text-terracotta" aria-hidden />}
                      <span>{aspect.label}</span>
                    </div>
                    {aspect.isKeyDifference && studyMode === 'off' && (
                      <p className="mt-1 font-body text-micro italic text-ink-tertiary">{KEY_DIFFERENCE_TAGLINE}</p>
                    )}
                  </th>
                  <AspectCell
                    aspect={aspect}
                    side="A"
                    editable={editable}
                    locked={locked}
                    masked={isMasked(studyMode, aspect, 'A')}
                    onChange={onChangeAspectValue}
                    onChangeNote={onChangeNote}
                    onFillFromSource={onFillFromSource}
                  />
                  <AspectCell
                    aspect={aspect}
                    side="B"
                    editable={editable}
                    locked={locked}
                    masked={isMasked(studyMode, aspect, 'B')}
                    onChange={onChangeAspectValue}
                    onChangeNote={onChangeNote}
                    onFillFromSource={onFillFromSource}
                  />
                  {editable && (
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Move aspect up"
                          disabled={index === 0}
                          onClick={() => onMoveAspect?.(aspect.id, 'up')}
                          className="rounded-sm p-1 text-ink-tertiary hover:bg-surface-raised hover:text-ink-primary disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move aspect down"
                          disabled={index === comparison.aspects.length - 1}
                          onClick={() => onMoveAspect?.(aspect.id, 'down')}
                          className="rounded-sm p-1 text-ink-tertiary hover:bg-surface-raised hover:text-ink-primary disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={aspect.isKeyDifference ? 'Unmark as key difference' : 'Mark as key difference'}
                          onClick={() => onToggleKeyDifference?.(aspect.id)}
                          className={cn('rounded-sm p-1 hover:bg-surface-raised', aspect.isKeyDifference ? 'text-terracotta' : 'text-ink-tertiary hover:text-ink-primary')}
                        >
                          <Sparkle size={14} weight={aspect.isKeyDifference ? 'fill' : 'regular'} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove aspect"
                          onClick={() => onRemoveAspect?.(aspect.id)}
                          className="rounded-sm p-1 text-ink-tertiary hover:bg-error/10 hover:text-error"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: segmented Both / Item A / Item B — never a squeezed 3-column table (brief §19). */}
      <div className="md:hidden">
        <Tabs
          tabs={[
            {
              id: 'both',
              label: 'Both',
              content: (
                <div className="flex flex-col divide-y divide-border">
                  {comparison.aspects.map((aspect) => (
                    <MobileBothCard
                      key={aspect.id}
                      comparison={comparison}
                      aspect={aspect}
                      studyMode={studyMode}
                      editable={editable}
                      locked={isCurated && Boolean(curatedAspectIds?.has(aspect.id))}
                      onChangeAspectValue={onChangeAspectValue}
                      onChangeNote={onChangeNote}
                      onFillFromSource={onFillFromSource}
                    />
                  ))}
                </div>
              )
            },
            {
              id: 'itemA',
              label: comparison.itemA.name,
              content: (
                <ul className="flex flex-col gap-4">
                  {comparison.aspects.map((aspect) => (
                    <li key={aspect.id}>
                      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{aspect.label}</p>
                      <p className="mt-1 font-body text-body text-ink-primary">
                        <MaskableValue value={aspect.valueA} masked={isMasked(studyMode, aspect, 'A')} />
                      </p>
                    </li>
                  ))}
                </ul>
              )
            },
            {
              id: 'itemB',
              label: comparison.itemB.name,
              content: (
                <ul className="flex flex-col gap-4">
                  {comparison.aspects.map((aspect) => (
                    <li key={aspect.id}>
                      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{aspect.label}</p>
                      <p className="mt-1 font-body text-body text-ink-primary">
                        <MaskableValue value={aspect.valueB} masked={isMasked(studyMode, aspect, 'B')} />
                      </p>
                    </li>
                  ))}
                </ul>
              )
            }
          ]}
        />
      </div>

      {studyMode !== 'off' && <p className="mt-4 text-center font-body text-micro italic text-ink-tertiary">{STUDY_MODE_TAGLINE}</p>}
    </div>
  )
}

/**
 * The note editor + "empty" actions shared by desktop `AspectCell` and
 * `MobileBothCard` for a *locked* (real curated) aspect side. Kept as
 * one component so the curated/user-layer behavior can't drift between
 * the two layouts (correction-pass Part 5/6/8/9).
 */
function CuratedSideExtras({
  aspect,
  side,
  value,
  editable,
  onChange,
  onChangeNote,
  onFillFromSource
}: {
  aspect: ComparisonAspect
  side: 'A' | 'B'
  value: string
  editable: boolean
  onChange?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onChangeNote?: (aspectId: string, side: 'A' | 'B', note: string) => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B', defaultTab?: 'my-library' | 'online') => void
}) {
  const note = side === 'A' ? aspect.noteA : aspect.noteB
  const [addingInfo, setAddingInfo] = useState(false)
  const [editingNote, setEditingNote] = useState(false)

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {!value && !addingInfo && (
        <div className="flex flex-col gap-1.5">
          <p className="font-ui text-micro italic text-ink-tertiary">No information yet</p>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button variant="tertiary" size="small" onClick={() => setAddingInfo(true)}>
                Add information
              </Button>
              <Button variant="tertiary" size="small" icon={<Books size={12} aria-hidden />} onClick={() => onFillFromSource?.(aspect, side, 'my-library')}>
                Find in My Library
              </Button>
              <Button variant="tertiary" size="small" icon={<Globe size={12} aria-hidden />} onClick={() => onFillFromSource?.(aspect, side, 'online')}>
                Search Online Knowledge
              </Button>
            </div>
          )}
        </div>
      )}
      {!value && addingInfo && (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange?.(aspect.id, side, e.target.value)}
          onBlur={() => setAddingInfo(false)}
          rows={2}
          placeholder="Type what you know…"
          className="w-full resize-y rounded-sm border border-border bg-canvas p-2 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
        />
      )}

      {note && !editingNote && (
        <div className="flex items-start gap-1.5 rounded-sm border-l-2 border-olive bg-surface-raised/60 px-2 py-1.5">
          <NotePencil size={13} className="mt-0.5 shrink-0 text-olive" aria-hidden />
          <p className="font-body text-micro italic text-ink-secondary">{note}</p>
        </div>
      )}
      {editingNote && (
        <textarea
          autoFocus
          value={note ?? ''}
          onChange={(e) => onChangeNote?.(aspect.id, side, e.target.value)}
          onBlur={() => setEditingNote(false)}
          rows={2}
          placeholder="Your own note — a memory trick, correction, or extra detail…"
          className="w-full resize-y rounded-sm border border-olive/50 bg-canvas p-2 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
        />
      )}
      {editable && !editingNote && (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="inline-flex w-fit items-center gap-1 font-ui text-micro font-medium text-olive hover:underline"
        >
          <NotePencil size={12} aria-hidden />
          {note ? 'Edit your note' : 'Add your information'}
        </button>
      )}
    </div>
  )
}

function AspectCell({
  aspect,
  side,
  editable,
  locked,
  masked,
  onChange,
  onChangeNote,
  onFillFromSource
}: {
  aspect: ComparisonAspect
  side: 'A' | 'B'
  editable: boolean
  locked: boolean
  masked: boolean
  onChange?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onChangeNote?: (aspectId: string, side: 'A' | 'B', note: string) => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B', defaultTab?: 'my-library' | 'online') => void
}) {
  const value = side === 'A' ? aspect.valueA : aspect.valueB
  const sources = side === 'A' ? aspect.sourcesA : aspect.sourcesB

  // Locked (real curated) aspect: the curated value is read-only, never overwritten in place — editing surfaces a separate note layer plus fill-in-when-blank actions instead of a raw textarea (correction-pass Part 5/6/8/9).
  if (locked) {
    return (
      <td className="px-4 py-3 align-top font-body text-body text-ink-primary">
        {value && <MaskableValue value={value} masked={masked} />}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {sources?.map((s, i) => (
            <ProvenanceBadge key={i} source={s} />
          ))}
        </div>
        <CuratedSideExtras aspect={aspect} side={side} value={value} editable={editable} onChange={onChange} onChangeNote={onChangeNote} onFillFromSource={onFillFromSource} />
      </td>
    )
  }

  return (
    <td className="px-4 py-3 align-top font-body text-body text-ink-primary">
      {editable ? (
        <textarea
          value={value}
          onChange={(e) => onChange?.(aspect.id, side, e.target.value)}
          rows={2}
          className="w-full resize-y rounded-sm border border-border bg-canvas p-2 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
        />
      ) : (
        <MaskableValue value={value} masked={masked} />
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {sources?.map((s, i) => (
          <ProvenanceBadge key={i} source={s} />
        ))}
        {editable && !value && onFillFromSource && (
          <Button variant="tertiary" size="small" icon={<Lightning size={12} aria-hidden />} onClick={() => onFillFromSource(aspect, side)}>
            Fill from a source
          </Button>
        )}
      </div>
    </td>
  )
}

function MobileBothCard({
  comparison,
  aspect,
  studyMode,
  editable,
  locked,
  onChangeAspectValue,
  onChangeNote,
  onFillFromSource
}: {
  comparison: Comparison
  aspect: ComparisonAspect
  studyMode: StudyMode
  editable: boolean
  locked: boolean
  onChangeAspectValue?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onChangeNote?: (aspectId: string, side: 'A' | 'B', note: string) => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B', defaultTab?: 'my-library' | 'online') => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="py-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-1.5 font-ui text-ui font-medium text-ink-primary">
          {aspect.isKeyDifference && <Sparkle size={14} className="text-terracotta" aria-hidden />}
          {aspect.label}
        </span>
        <span className="font-ui text-micro text-ink-tertiary">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-sm border-l-2 border-olive bg-surface-raised p-3">
            <p className="font-ui text-micro font-medium text-ink-tertiary">{comparison.itemA.name}</p>
            {locked ? (
              <>
                {aspect.valueA && (
                  <p className="mt-1 font-body text-body text-ink-primary">
                    <MaskableValue value={aspect.valueA} masked={isMasked(studyMode, aspect, 'A')} />
                  </p>
                )}
                <CuratedSideExtras
                  aspect={aspect}
                  side="A"
                  value={aspect.valueA}
                  editable={editable}
                  onChange={onChangeAspectValue}
                  onChangeNote={onChangeNote}
                  onFillFromSource={onFillFromSource}
                />
              </>
            ) : editable ? (
              <textarea
                value={aspect.valueA}
                onChange={(e) => onChangeAspectValue?.(aspect.id, 'A', e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-sm border border-border bg-canvas p-2 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
              />
            ) : (
              <p className="mt-1 font-body text-body text-ink-primary">
                <MaskableValue value={aspect.valueA} masked={isMasked(studyMode, aspect, 'A')} />
              </p>
            )}
          </div>
          <div className="rounded-sm border-l-2 border-terracotta bg-surface-raised p-3">
            <p className="font-ui text-micro font-medium text-ink-tertiary">{comparison.itemB.name}</p>
            {locked ? (
              <>
                {aspect.valueB && (
                  <p className="mt-1 font-body text-body text-ink-primary">
                    <MaskableValue value={aspect.valueB} masked={isMasked(studyMode, aspect, 'B')} />
                  </p>
                )}
                <CuratedSideExtras
                  aspect={aspect}
                  side="B"
                  value={aspect.valueB}
                  editable={editable}
                  onChange={onChangeAspectValue}
                  onChangeNote={onChangeNote}
                  onFillFromSource={onFillFromSource}
                />
              </>
            ) : editable ? (
              <textarea
                value={aspect.valueB}
                onChange={(e) => onChangeAspectValue?.(aspect.id, 'B', e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-sm border border-border bg-canvas p-2 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
              />
            ) : (
              <p className="mt-1 font-body text-body text-ink-primary">
                <MaskableValue value={aspect.valueB} masked={isMasked(studyMode, aspect, 'B')} />
              </p>
            )}
          </div>
          {aspect.isKeyDifference && studyMode === 'off' && <p className="font-body text-micro italic text-ink-tertiary">{KEY_DIFFERENCE_TAGLINE}</p>}
          {!locked && editable && (
            <div className="flex flex-wrap gap-3">
              {!aspect.valueA && onFillFromSource && (
                <Button variant="tertiary" size="small" icon={<Lightning size={12} aria-hidden />} onClick={() => onFillFromSource(aspect, 'A')}>
                  Fill {comparison.itemA.name} from a source
                </Button>
              )}
              {!aspect.valueB && onFillFromSource && (
                <Button variant="tertiary" size="small" icon={<Lightning size={12} aria-hidden />} onClick={() => onFillFromSource(aspect, 'B')}>
                  Fill {comparison.itemB.name} from a source
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
