import { useNavigate } from 'react-router-dom'
import { GraduationCap } from '@phosphor-icons/react'
import { Card, CardBody } from '@/shared/components'
import { EXAM_SUBJECTS, countTopicsForSubject } from '@/core/exam-prep/subjects'

/**
 * Exam Prep — landing page (brief: "a scalable container for future
 * exam-preparation material"). Reads its subject list from
 * `core/exam-prep/subjects.ts` rather than hardcoding a card here, so
 * adding the next subject (Current Affairs, Comprehension, ...) later
 * never touches this component — only "Constitution of India" is seeded
 * today, since only it has real content behind it.
 */
export function ExamPrepPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Exam Prep</p>
        <h1 className="mt-1 font-display text-display font-semibold text-ink-primary">Exam Prep</h1>
        <p className="mt-2 max-w-2xl font-body text-body text-ink-secondary">
          Cellfie's study room for competitive-exam syllabi — structured, scannable topics with quick revision and
          exam focus built in, not a PDF dump.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAM_SUBJECTS.map((subject) => (
          <Card
            key={subject.id}
            interactive
            onClick={() => navigate(`/exam-prep/${subject.id}`)}
          >
            <CardBody className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-olive">
                <GraduationCap size={20} aria-hidden />
                <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                  {countTopicsForSubject(subject.id)} topics
                </p>
              </div>
              <p className="font-display text-h3 font-medium text-ink-primary">{subject.title}</p>
              <p className="font-body text-caption text-ink-secondary">{subject.shortDescription}</p>
              <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{subject.genZNote}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
