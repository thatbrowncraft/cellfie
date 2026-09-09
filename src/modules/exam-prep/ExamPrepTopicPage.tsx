import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, EmptyState } from '@/shared/components'
import { getExamSubjectById } from '@/core/exam-prep/subjects'
import { getExamTopicById } from '@/core/exam-prep/registry'
import { recordExamSubjectViewed } from '@/core/exam-prep/recentlyViewed'
import type { ExamSubjectId } from '@/core/exam-prep/types'
import { ExamFocusView, ExamLessonView, ExamQuickRevisionView } from './components/ExamLessonView'

/**
 * Exam Prep — topic detail page. One reusable page renders every
 * Constitution topic (and, later, every topic for any future subject)
 * from its JSON content file — see `core/exam-prep/registry.ts`. Static,
 * curated content only; no Dexie coupling, no extraction pipeline, no
 * per-topic component files.
 */
export function ExamPrepTopicPage() {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>()
  const navigate = useNavigate()

  const subject = useMemo(() => (subjectId ? getExamSubjectById(subjectId) : undefined), [subjectId])
  const topic = useMemo(
    () => (subjectId && topicId ? getExamTopicById(subjectId as ExamSubjectId, topicId) : undefined),
    [subjectId, topicId]
  )

  // Dashboard "Exam Prep" preview support — recorded at the subject level
  // (mirrors ExamPrepSubjectPage), so opening a topic bumps the same
  // "Constitution of India" recent entry to the front instead of creating
  // a separate per-topic entry. Fire-and-forget, never blocks render.
  useEffect(() => {
    if (subject && topic) {
      void recordExamSubjectViewed(subject.id)
    }
  }, [subject, topic])

  if (!subject || !topic) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Topic not found"
          description="This Exam Prep topic doesn't exist, or its content file couldn't be loaded."
          action={
            <Button variant="secondary" onClick={() => navigate('/exam-prep')}>
              Back to Exam Prep
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/exam-prep')} className="hover:text-ink-secondary hover:underline">
          Exam Prep
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate(`/exam-prep/${subject.id}`)}
          className="hover:text-ink-secondary hover:underline"
        >
          {subject.title}
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{topic.title}</span>
      </nav>

      <Button
        variant="tertiary"
        size="small"
        icon={<ArrowLeft size={16} />}
        onClick={() => navigate(`/exam-prep/${subject.id}`)}
        className="mb-4"
      >
        Back
      </Button>

      <header className="mb-8">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          {subject.title} · Topic {topic.syllabusOrder}
        </p>
        <h1 className="mt-1 font-display text-display font-semibold text-ink-primary">{topic.title}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{topic.genZNote}</p>
      </header>

      <div className="flex flex-col gap-6">
        <ExamLessonView topic={topic} />
        <ExamQuickRevisionView title={topic.title} quickRevision={topic.quickRevision} />
        <ExamFocusView title={topic.title} examFocus={topic.examFocus} />
      </div>
    </div>
  )
}
