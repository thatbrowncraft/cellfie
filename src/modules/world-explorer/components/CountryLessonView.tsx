/**
 * CountryLessonView — World Explorer's equivalent of
 * `modules/exam-prep/components/ExamLessonView.tsx`.
 *
 * Deliberately a separate small component, typed against
 * `core/world-explorer/types`'s `CountryProfile` rather than
 * `core/exam-prep/types`'s `ExamTopic` — same reasoning ExamLessonView
 * itself gives for not being forced through Concepts' `CuratedLesson`
 * props: different module, same underlying section/quickRevision/
 * examFocus shape, so the same section-rendering logic is duplicated
 * here rather than importing a component typed against an unrelated
 * union (`ExamSubjectId` has no "country" member, and shouldn't).
 * Visual language matches `ExamLessonView` and `CuratedLessonView`
 * exactly, so this still feels native to Cellfie rather than a bolted
 * -on feature.
 *
 * Sections render as individually collapsible cards (World Explorer
 * content brief: "visually clean, collapsible ... easy to scan on
 * mobile") in the canonical order from `core/world-explorer/sectionMeta`,
 * regardless of the order a given country's JSON happens to list them
 * in. A country with 7 sections and a country with 20 render through
 * the exact same component — depth differs, structure doesn't.
 */
import { useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { ComparisonTable as DesignComparisonTable } from '@/shared/components'
import { cn } from '@/shared/utils/cn'
import { sortSectionsForDisplay } from '@/core/world-explorer/sectionMeta'
import type { ExamFocusSummary, LessonSection, QuickRevisionSummary, CountryProfile } from '@/core/world-explorer/types'

/** Exported so `WorldExplorerTopicPage` can render one country's section body inside its own per-country card — same rendering rules (bullets/body/steps/table), no duplicated logic. */
export function SectionBody({ section }: { section: LessonSection }) {
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

/**
 * A single collapsible card — same visual card language as before
 * (`rounded-md border border-border bg-surface`), now with a tappable
 * header so a 15-section country doesn't turn into an endless scroll.
 * Controlled from the parent so an "Expand all" / "Collapse all"
 * toggle can drive every card at once.
 */
function CollapsibleCard({
  id,
  heading,
  isOpen,
  onToggle,
  children
}: {
  id: string
  heading: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`country-section-${id}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <h3 className="font-ui text-ui font-semibold text-ink-primary">{heading}</h3>
        <CaretDown
          size={18}
          className={cn('shrink-0 text-ink-tertiary transition-transform duration-micro ease-standard', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      {isOpen && (
        <div id={`country-section-${id}`} className="flex flex-col gap-2 px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

export function CountryQuickRevisionView({ title, quickRevision }: { title: string; quickRevision: QuickRevisionSummary }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">⚡ Quick revision — {title}</h3>
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

export function CountryExamFocusView({ title, examFocus }: { title: string; examFocus: ExamFocusSummary }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">🎯 Why it matters for exams — {title}</h3>

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

/** Brief §"Gen Z Memory Hook" — the compact, country-specific memory line, surfaced as its own card at the end of the revision flow (it also appears as a tagline near the country name; repeating it here is deliberate — it's the very last thing a student sees before moving on). */
export function CountryMemoryHookView({ genZNote }: { genZNote: string }) {
  return (
    <div className="rounded-md border border-terracotta/40 bg-surface p-5">
      <h3 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">🧠 Memory hook</h3>
      <p className="font-ui text-body-lg italic text-ink-primary">{genZNote}</p>
    </div>
  )
}

/** Brief §7 — a clear, non-intrusive educational-use notice, shown once per country profile rather than as a legal-page-style banner. */
export function EducationalUseNotice() {
  return (
    <div className="rounded-md border border-terracotta/40 bg-surface-raised px-4 py-2.5">
      <p className="font-ui text-caption font-medium text-ink-secondary">
        🎓 World Explorer provides structured information for learning, general knowledge and competitive-exam
        preparation. It's presented for educational purposes and shouldn't be treated as medical, legal, political,
        financial, commercial or professional advice.
      </p>
    </div>
  )
}

export function CountryLessonView({ profile }: { profile: CountryProfile }) {
  const orderedSections = sortSectionsForDisplay(profile.sections)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function expandAll() {
    setOpenIds(new Set(orderedSections.map((s) => s.id)))
  }

  function collapseAll() {
    setOpenIds(new Set())
  }

  const allOpen = openIds.size === orderedSections.length && orderedSections.length > 0

  return (
    <div className="flex flex-col gap-3">
      <EducationalUseNotice />

      <div className="flex items-center justify-between">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          {orderedSections.length} section{orderedSections.length === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="font-ui text-micro font-medium text-terracotta hover:underline"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {orderedSections.map((section) => (
        <CollapsibleCard
          key={section.id}
          id={section.id}
          heading={section.heading}
          isOpen={openIds.has(section.id)}
          onToggle={() => toggle(section.id)}
        >
          <SectionBody section={section} />
        </CollapsibleCard>
      ))}

      <div className="rounded-md border border-border bg-surface p-5">
        <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Sources this profile is informed by</h3>
        <div className="flex flex-col gap-2">
          {profile.sources.map((source, i) => (
            <span key={i} className="font-body text-caption text-ink-secondary">
              {source.name}
              <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                {source.kind === 'educational' ? 'Educational' : 'Scientific'}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
