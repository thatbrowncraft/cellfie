import { useState } from 'react'
import { ArrowDown, ArrowUp, Lightning, Sparkle, Trash } from '@phosphor-icons/react'
import { cn } from '../../../shared/utils/cn'
import { Button, Tabs } from '../../../shared/components'
import type { Comparison, ComparisonAspect } from '../../../core/comparison/types'
import { KEY_DIFFERENCE_TAGLINE, STUDY_MODE_TAGLINE } from '../../../core/comparison/microcopy'
import { ProvenanceBadge } from './ProvenanceBadge'

export type StudyMode = 'off' | 'column-mask' | 'matrix-blind' | 'key-difference-focus'

interface ComparisonWorkspaceViewProps {
  comparison: Comparison
  editable: boolean
  studyMode?: StudyMode
  onChangeAspectValue?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onToggleKeyDifference?: (aspectId: string) => void
  onRemoveAspect?: (aspectId: string) => void
  onMoveAspect?: (aspectId: string, direction: 'up' | 'down') => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B') => void
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
  studyMode = 'off',
  onChangeAspectValue,
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
            {comparison.aspects.map((aspect, index) => (
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
                  masked={isMasked(studyMode, aspect, 'A')}
                  onChange={onChangeAspectValue}
                  onFillFromSource={onFillFromSource}
                />
                <AspectCell
                  aspect={aspect}
                  side="B"
                  editable={editable}
                  masked={isMasked(studyMode, aspect, 'B')}
                  onChange={onChangeAspectValue}
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
            ))}
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
                      onChangeAspectValue={onChangeAspectValue}
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

function AspectCell({
  aspect,
  side,
  editable,
  masked,
  onChange,
  onFillFromSource
}: {
  aspect: ComparisonAspect
  side: 'A' | 'B'
  editable: boolean
  masked: boolean
  onChange?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B') => void
}) {
  const value = side === 'A' ? aspect.valueA : aspect.valueB
  const sources = side === 'A' ? aspect.sourcesA : aspect.sourcesB

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
          <button
            type="button"
            onClick={() => onFillFromSource(aspect, side)}
            className="inline-flex items-center gap-1 font-ui text-micro text-olive hover:underline"
          >
            <Lightning size={12} aria-hidden />
            Fill from a source
          </button>
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
  onChangeAspectValue,
  onFillFromSource
}: {
  comparison: Comparison
  aspect: ComparisonAspect
  studyMode: StudyMode
  editable: boolean
  onChangeAspectValue?: (aspectId: string, side: 'A' | 'B', value: string) => void
  onFillFromSource?: (aspect: ComparisonAspect, side: 'A' | 'B') => void
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
            {editable ? (
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
            {editable ? (
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
          {!editable ? null : (
            <div className="flex gap-3">
              {!aspect.valueA && onFillFromSource && (
                <button type="button" onClick={() => onFillFromSource(aspect, 'A')} className="inline-flex items-center gap-1 font-ui text-micro text-olive hover:underline">
                  <Lightning size={12} aria-hidden /> Fill {comparison.itemA.name} from a source
                </button>
              )}
              {!aspect.valueB && onFillFromSource && (
                <button type="button" onClick={() => onFillFromSource(aspect, 'B')} className="inline-flex items-center gap-1 font-ui text-micro text-olive hover:underline">
                  <Lightning size={12} aria-hidden /> Fill {comparison.itemB.name} from a source
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
