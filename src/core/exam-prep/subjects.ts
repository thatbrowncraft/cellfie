/**
 * core/exam-prep/subjects — the Exam Prep landing page reads this list,
 * not a hardcoded card in the page component (mirrors
 * `config/subjects.registry.ts`'s "subjects are data, not code").
 *
 * Only "Constitution of India" is seeded — Current Affairs, Comprehension,
 * and anything else from the syllabus PDF are deliberately NOT added as
 * empty placeholder subjects here (brief: "do not fabricate empty fake
 * content for subjects that are not implemented yet"). Adding the next
 * subject later means appending one entry here plus a matching topic
 * folder under `src/content/exam-prep/<subject-id>/` — nothing about the
 * landing page, the subject page, or the topic page needs to change.
 */
import type { ExamSubject, ExamSubjectId } from './types'
import { CONSTITUTION_TOPICS } from './registry'

export const EXAM_SUBJECTS: ExamSubject[] = [
  {
    id: 'constitution-of-india',
    title: 'Constitution of India',
    shortDescription:
      'Preamble to Constitutional Bodies — the full Part B syllabus, broken into study-sized topics with quick revision and exam focus for each.',
    genZNote: "Know the rulebook before the MCQs start throwing Article numbers at you.",
    icon: 'Scroll'
  }
]

export function getExamSubjectById(id: string): ExamSubject | undefined {
  return EXAM_SUBJECTS.find((s) => s.id === id)
}

/** Topic count per subject, for the landing page card — computed from the actual loaded content, never hardcoded. */
export function countTopicsForSubject(id: ExamSubjectId): number {
  if (id === 'constitution-of-india') return CONSTITUTION_TOPICS.length
  return 0
}
