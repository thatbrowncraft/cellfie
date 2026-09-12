/**
 * ExamLessonView — the Exam Prep equivalent of
 * `modules/concepts/components/CuratedLessonView.tsx`.
 *
 * Deliberately a SEPARATE component rather than importing/reusing the
 * Concepts one directly: `CuratedLessonView` is typed against
 * `core/concepts/curatedLessons`'s `CuratedLesson`/`LessonViewData`,
 * which are shaped around a Dexie `Concept` and the book-extraction
 * pipeline. Exam Prep topics (`core/exam-prep/types.ts`) reuse the same
 * underlying section/quickRevision/examFocus TYPES, but are not Concepts
 * and must never be forced through Concept-shaped props. Duplicating
 * this small, presentational component keeps the two module boundaries
 * clean and means nothing about the Concepts UI ever needs to change to
 * ship or evolve Exam Prep (brief: "do not redesign existing Concepts
 * UI"). The visual language (classes, layout) intentionally matches
 * `CuratedLessonView` exactly, so Exam Prep still *feels* native to
 * Cellfie.
 */
import { ComparisonTable as DesignComparisonTable } from '@/shared/components'
import type { ExamFocusSummary, ExamTopic, LessonSection, QuickRevisionSummary } from '@/core/exam-prep/types'

function SectionBody({ section }: { section: LessonSection }) {
  return (
    <>
      {section.body && (
        <div className="flex flex-col gap-2">
          {section.body.split('\n\n').map((para, i) => (
            <p key={i} className="font-body text-body text-ink-primary leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-5 font-body text-body text-ink-primary leading-relaxed">
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {section.steps && section.steps.length > 0 && (
        <div className="flex flex-col gap-3">
          {section.steps.map((step, i) => (
            <div key={i} className="rounded-sm border-l-4 border-terracotta bg-surface-raised p-3">
              <p className="font-ui text-ui font-semibold text-ink-primary">{step.name}</p>
              <p className="mt-1 font-body text-body text-ink-primary">{step.explanation}</p>
              <p className="mt-1 font-body text-caption italic text-ink-secondary">{step.purpose}</p>
            </div>
          ))}
        </div>
      )}

      {section.table && (
        <div className="mt-1">
          {section.table.columnHeaders.length === 2 ? (
            <DesignComparisonTable
              itemA={section.table.columnHeaders[0]}
              itemB={section.table.columnHeaders[1]}
              rows={section.table.rows.map((r) => ({ aspect: r[0], valueA: r[1] ?? '', valueB: r[2] ?? '' }))}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr className="bg-surface-raised">
                    <th className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-secondary"> </th>
                    {section.table.columnHeaders.map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-ui text-ui font-medium text-ink-primary">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={
                            ci === 0
                              ? 'px-4 py-3 font-ui text-ui font-medium text-ink-secondary'
                              : 'px-4 py-3 font-body text-body text-ink-primary'
                          }
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.table.caption && <p className="mt-1 font-ui text-micro text-ink-tertiary">{section.table.caption}</p>}
        </div>
      )}
    </>
  )
}

export function ExamQuickRevisionView({ title, quickRevision }: { title: string; quickRevision: QuickRevisionSummary }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Quick revision — {title}</h3>
      <p className="mb-3 font-body text-body font-medium text-ink-primary">{quickRevision.oneLineDefinition}</p>

      {quickRevision.keyFacts.length > 0 && (
        <>
          <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Key facts</h4>
          <ul className="mb-3 list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
            {quickRevision.keyFacts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}

      {quickRevision.keyTerms && quickRevision.keyTerms.length > 0 && (
        <>
          <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Key terms</h4>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {quickRevision.keyTerms.map((t) => (
              <span key={t} className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro text-ink-secondary">
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      {quickRevision.commonConfusion && quickRevision.commonConfusion.length > 0 && (
        <>
          <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Common confusion</h4>
          <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
            {quickRevision.commonConfusion.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function ExamFocusView({ title, examFocus }: { title: string; examFocus: ExamFocusSummary }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Exam focus — {title}</h3>

      <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">High-yield facts</h4>
      <ul className="mb-3 list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
        {examFocus.highYieldFacts.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>

      <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Common traps</h4>
      <ul className="mb-3 list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
        {examFocus.commonTraps.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>

      <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Must remember</h4>
      <ul className="mb-3 list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
        {examFocus.mustRemember.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>

      {examFocus.confusedTerms && examFocus.confusedTerms.length > 0 && (
        <>
          <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Commonly confused terms</h4>
          <div className="mb-3 flex flex-col gap-2">
            {examFocus.confusedTerms.map((c, i) => (
              <div key={i} className="rounded-sm border-l-4 border-olive bg-surface-raised p-2.5">
                <p className="font-ui text-caption font-semibold text-ink-primary">
                  {c.termA} vs. {c.termB}
                </p>
                <p className="font-body text-caption text-ink-secondary">{c.distinction}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {examFocus.possibleQuestions && examFocus.possibleQuestions.length > 0 && (
        <>
          <h4 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">Possible questions</h4>
          <ul className="list-disc space-y-1 pl-5 font-body text-body text-ink-primary">
            {examFocus.possibleQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function ExamLessonView({ topic }: { topic: ExamTopic }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-terracotta/40 bg-surface-raised px-4 py-2.5">
        <p className="font-ui text-caption font-medium text-ink-secondary">
          Cellfie study content — a curated Exam Prep lesson, informed by the Constitution's own text and standard
          educational sources (listed below), not auto-generated.
        </p>
      </div>

      {topic.sections.map((section) => (
        <div key={section.id} className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{section.heading}</h3>
          <SectionBody section={section} />
        </div>
      ))}

      {topic.sources.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5">
          <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Sources this lesson is informed by</h3>
          <div className="flex flex-col gap-2">
            {topic.sources.map((source, i) => (
              <span key={i} className="font-body text-caption text-ink-secondary">
                {source.name}
                <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                  {source.kind === 'educational' ? 'Educational' : 'Scientific'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
