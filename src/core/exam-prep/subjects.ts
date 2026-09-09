/**
 * core/exam-prep/subjects — the Exam Prep landing page reads this list,
 * not a hardcoded card in the page component (mirrors
 * `config/subjects.registry.ts`'s "subjects are data, not code").
 *
 * "Constitution of India" and "Quantitative Aptitude" are seeded —
 * Current Affairs, Reasoning, Static GK, and anything else from the
 * syllabus are deliberately NOT added as empty placeholder subjects here
 * (brief: "do not fabricate empty fake content for subjects that are not
 * implemented yet"). Adding the next subject later means appending one
 * entry here plus a matching topic folder under
 * `src/content/exam-prep/<subject-id>/` — nothing about the landing
 * page, the subject page, or the topic page needs to change.
 */
import type { ExamSubject, ExamSubjectId } from './types'
import { listTopicsForSubject } from './registry'

export const EXAM_SUBJECTS: ExamSubject[] = [
  {
    id: 'constitution-of-india',
    title: 'Constitution of India',
    shortDescription:
      'Preamble to Constitutional Bodies — the full Part B syllabus, broken into study-sized topics with quick revision and exam focus for each.',
    genZNote: "Know the rulebook before the MCQs start throwing Article numbers at you.",
    icon: 'Scroll'
  },
  {
    id: 'quantitative-aptitude',
    title: 'Quantitative Aptitude',
    shortDescription:
      'Number System to Chain Rule — the full Part A maths syllabus, taught exam-first: the concept, the fast method, and when the fast method is actually safe to use.',
    genZNote: "Same maths you already half-know, minus the panic — this is the cheat-code layer on top of it.",
    icon: 'Calculator'
  },
  {
    id: 'english-language',
    title: 'English Language',
    shortDescription:
      'Grammar, vocabulary, sentence skills, voice & speech, and common errors — the full Part B English syllabus, broken into study-sized topics with quick revision and exam focus for each.',
    genZNote: "The subject you think you already know until an exam asks you to explain WHY 'discuss about' is wrong.",
    icon: 'Books'
  }
]

export function getExamSubjectById(id: string): ExamSubject | undefined {
  return EXAM_SUBJECTS.find((s) => s.id === id)
}

/** Topic count per subject, for the landing page card — computed from the actual loaded content, never hardcoded. */
export function countTopicsForSubject(id: ExamSubjectId): number {
  return listTopicsForSubject(id).length
}
