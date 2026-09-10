/**
 * core/exam-prep/subjects — the Exam Prep landing page reads this list,
 * not a hardcoded card in the page component (mirrors
 * `config/subjects.registry.ts`'s "subjects are data, not code").
 *
 * "Constitution of India", "Quantitative Aptitude", "English Language",
 * "Logical Reasoning & General Intelligence", "General Knowledge &
 * Static GK", and "Current Affairs 2026" are seeded. Current Affairs is
 * a CURATED, hand-researched 2026-only dataset — not the live/dynamic
 * Knowledge Layer architecture (that's a separate, later task; see
 * `current-affairs-2026`'s topic files for the "curated, not live"
 * framing shown to the user). Adding the next subject later means
 * appending one entry here plus a matching topic folder under
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
  },
  {
    id: 'logical-reasoning',
    title: 'Logical Reasoning & General Intelligence',
    shortDescription:
      'Blood relations to seating arrangements — verbal, non-verbal, and analytical reasoning taught as a fixed solving process for each question type, not a bag of tricks.',
    genZNote: "Reasoning isn't cleverness on demand — it's five or six repeatable processes wearing different costumes.",
    icon: 'Brain'
  },
  {
    id: 'general-knowledge',
    title: 'General Knowledge & Static GK',
    shortDescription:
      'History, Geography, and Economy — the stable, exam-tested facts and timelines that don\u2019t change week to week (Current Affairs is a separate, dynamic layer, coming later).',
    genZNote: "Static GK is the GK that isn't going anywhere — learn it once, it stays true.",
    icon: 'Globe'
  },
  {
    id: 'current-affairs-2026',
    title: 'Current Affairs \u2022 2026',
    shortDescription:
      'Gujarat first, India second \u2014 a curated set of verified 2026 events researched and written for this exam, not a live feed. Every item is dated and sourced; nothing here updates automatically.',
    genZNote: "Today's headline can become tomorrow's MCQ \u2014 this is the 2026 shortlist worth actually remembering.",
    icon: 'Newspaper'
  }
]

export function getExamSubjectById(id: string): ExamSubject | undefined {
  return EXAM_SUBJECTS.find((s) => s.id === id)
}

/** Topic count per subject, for the landing page card — computed from the actual loaded content, never hardcoded. */
export function countTopicsForSubject(id: ExamSubjectId): number {
  return listTopicsForSubject(id).length
}
