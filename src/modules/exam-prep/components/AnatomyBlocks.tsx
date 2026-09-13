/**
 * modules/exam-prep/components/AnatomyBlocks — the visual-study layer
 * that turns a Human Anatomy topic from "one image + text cards" into
 * something closer to a digital anatomy textbook + diagram-practice
 * tool: a structure/function grid, a directional pathway flow, a
 * side-by-side comparison grid, a gland→hormone reference table, an
 * illustration panel with a real full-size viewer, and a small
 * self-test quiz block (MCQ, true/false, structure↔function,
 * gland↔hormone, organ↔system, diagram identification).
 *
 * Every component here takes `core/exam-prep/types.ts`'s `AnatomyData`
 * shapes directly and renders nothing when its slice of that data is
 * absent — so a chapter can adopt one block at a time, and every
 * non-anatomy Exam Prep subject (which never sets `topic.anatomy`)
 * never even imports this file's components with data to render.
 *
 * Deliberately NOT a generic "quiz engine" shared across all of Exam
 * Prep — `AnatomyQuizBlock` is scoped to `AnatomyQuestion`, matching
 * the brief's ask for an anatomy-compatible question component without
 * retrofitting a shared quiz system onto Constitution/English/etc.
 */
import { useId, useState } from 'react'
import { ArrowsOut, Check, Info, X as XIcon } from '@phosphor-icons/react'
import { Dialog, IllustrationFrame } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import { resolveExamPrepAssetPath } from '@/shared/utils/resolveExamPrepAssetPath'
import type {
  AnatomyComparison,
  AnatomyHormoneRow,
  AnatomyPathway,
  AnatomyQuestion,
  AnatomyStructure
} from '@/core/exam-prep/types'

/* ------------------------------------------------------------------ */
/* Illustration panel — the existing IllustrationFrame, plus a real    */
/* full-size viewer. Still the SAME supplied HD asset — no cropping,   */
/* no relabeling, no generated stand-in.                                */
/* ------------------------------------------------------------------ */

interface AnatomyIllustrationPanelProps {
  src: string
  alt: string
  caption: string
  className?: string
}

export function AnatomyIllustrationPanel({ src, alt, caption, className }: AnatomyIllustrationPanelProps) {
  const [open, setOpen] = useState(false)
  const resolvedSrc = resolveExamPrepAssetPath(src)

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative w-full max-w-xl">
        <IllustrationFrame src={resolvedSrc} alt={alt} caption={caption} className="w-full" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-canvas/90 px-2.5 py-1.5 font-ui text-micro font-medium text-ink-secondary shadow-1 transition-colors duration-micro hover:bg-surface-raised"
        >
          <ArrowsOut size={14} aria-hidden />
          View full size
        </button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={caption} size="lg">
        <img src={resolvedSrc} alt={alt} className="max-h-[75vh] w-full rounded-md object-contain" />
        <p className="mt-3 font-body text-caption text-ink-secondary">
          Original labelled reference — use this view to study every structure before self-testing below.
        </p>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Structure identification + structure → function grid                */
/* ------------------------------------------------------------------ */

export function AnatomyStructureGrid({ structures }: { structures?: AnatomyStructure[] }) {
  if (!structures || structures.length === 0) return null

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        Structures to identify and know
      </h3>
      <p className="mb-3 font-body text-caption text-ink-secondary">
        Locate each structure in the illustration above, then study what it does.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {structures.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-sm border border-border bg-surface-raised">
            {s.image && (
              <img
                src={resolveExamPrepAssetPath(s.image.src)}
                alt={s.image.alt}
                className="h-32 w-full border-b border-border object-contain bg-surface"
              />
            )}
            <div className="p-3">
              <p className="font-ui text-ui font-semibold text-ink-primary">{s.name}</p>
              <p className="mt-1 font-body text-caption text-ink-secondary">{s.description}</p>
              {s.function && (
                <p className="mt-1.5 font-body text-caption text-ink-primary">
                  <span className="font-ui font-medium text-olive">Function → </span>
                  {s.function}
                </p>
              )}
              {s.highYield && (
                <p className="mt-1.5 flex items-start gap-1.5 font-body text-micro text-ink-tertiary">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                  {s.highYield}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Biological pathway flow                                              */
/* ------------------------------------------------------------------ */

export function AnatomyPathwayFlow({ pathways }: { pathways?: AnatomyPathway[] }) {
  if (!pathways || pathways.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {pathways.map((pathway) => (
        <div key={pathway.title} className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            {pathway.title}
          </h3>
          <ol className="flex flex-col items-start gap-0">
            {pathway.steps.map((step, i) => (
              <li key={i} className="flex flex-col items-start">
                <span className="rounded-sm border-l-4 border-terracotta bg-surface-raised px-3 py-2 font-body text-body text-ink-primary">
                  {step}
                </span>
                {i < pathway.steps.length - 1 && (
                  <span className="py-1 pl-3 font-ui text-body-lg leading-none text-terracotta" aria-hidden>
                    ↓
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Comparison grid — "commonly confused" structures/hormones            */
/* ------------------------------------------------------------------ */

export function AnatomyComparisonGrid({ comparisons }: { comparisons?: AnatomyComparison[] }) {
  if (!comparisons || comparisons.length === 0) return null

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        Commonly confused
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {comparisons.map((c, i) => (
          <div key={i} className="rounded-sm border-l-4 border-olive bg-surface-raised p-3">
            <p className="font-ui text-ui font-semibold text-ink-primary">
              {c.termA} <span className="text-ink-tertiary">vs.</span> {c.termB}
            </p>
            <p className="mt-1 font-body text-caption text-ink-secondary">{c.distinction}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Gland → hormone → function → target reference table                  */
/* ------------------------------------------------------------------ */

export function AnatomyHormoneTable({ rows }: { rows?: AnatomyHormoneRow[] }) {
  if (!rows || rows.length === 0) return null

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
        Hormone table
      </h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="bg-surface-raised">
              {['Gland', 'Hormone', 'Main function', 'Target'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn('border-t border-border', i % 2 === 1 && 'bg-surface')}>
                <td className="px-4 py-3 font-ui text-ui font-medium text-ink-secondary">{r.gland}</td>
                <td className="px-4 py-3 font-body text-body text-ink-primary">{r.hormone}</td>
                <td className="px-4 py-3 font-body text-body text-ink-primary">{r.function}</td>
                <td className="px-4 py-3 font-body text-body text-ink-secondary">{r.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Quiz block — MCQ / true-false / structure↔function / gland↔hormone / */
/* organ↔system / diagram identification / common-confusion             */
/* ------------------------------------------------------------------ */

function QuestionCard({
  question,
  index,
  illustration
}: {
  question: AnatomyQuestion
  index: number
  illustration?: { src: string; alt: string; caption: string }
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const groupId = useId()
  const answered = selected !== null
  const isCorrect = selected === question.correctIndex

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="mb-3 font-ui text-caption font-medium text-ink-tertiary">Question {index + 1}</p>

      {question.useIllustration && illustration && (
        <div className="mb-3 overflow-hidden rounded-md border border-border bg-surface-raised">
          <img
            src={resolveExamPrepAssetPath(illustration.src)}
            alt={illustration.alt}
            className="max-h-56 w-full object-contain"
          />
        </div>
      )}

      <p id={groupId} className="mb-3 font-body text-body font-medium text-ink-primary">
        {question.prompt}
      </p>

      <div role="radiogroup" aria-labelledby={groupId} className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const isSelected = selected === i
          const isRightOption = i === question.correctIndex
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={answered}
              onClick={() => setSelected(i)}
              className={cn(
                'flex items-start gap-2 rounded-sm border px-3 py-2 text-left font-body text-body transition-colors duration-micro',
                !answered && 'border-border bg-surface hover:bg-surface-raised text-ink-primary',
                answered && isRightOption && 'border-olive bg-olive/10 text-ink-primary',
                answered && isSelected && !isRightOption && 'border-error bg-error/10 text-ink-primary',
                answered && !isSelected && !isRightOption && 'border-border text-ink-secondary opacity-70'
              )}
            >
              {answered && isRightOption && <Check size={16} className="mt-0.5 shrink-0 text-olive" aria-hidden />}
              {answered && isSelected && !isRightOption && (
                <XIcon size={16} className="mt-0.5 shrink-0 text-error" aria-hidden />
              )}
              <span>
                {option}
                {answered && question.optionNotes?.[i] && (
                  <span className="mt-0.5 block font-body text-micro text-ink-tertiary">
                    {question.optionNotes[i]}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div
          className={cn(
            'mt-3 rounded-sm border-l-4 p-3 font-body text-caption',
            isCorrect ? 'border-olive bg-olive/5 text-ink-primary' : 'border-error bg-error/5 text-ink-primary'
          )}
        >
          <p className="mb-1 font-ui text-ui font-semibold">{isCorrect ? 'Correct' : 'Not quite'}</p>
          <p>{question.explanation}</p>
        </div>
      )}
    </div>
  )
}

export function AnatomyQuizBlock({
  title,
  questions,
  illustration
}: {
  title: string
  questions?: AnatomyQuestion[]
  illustration?: { src: string; alt: string; caption: string }
}) {
  if (!questions || questions.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Test yourself — {title}</h3>
      {questions.map((q, i) => (
        <QuestionCard key={q.id} question={q} index={i} illustration={illustration} />
      ))}
    </div>
  )
}
