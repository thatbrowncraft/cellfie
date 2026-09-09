/**
 * core/exam-prep/registry — same loading strategy as
 * `core/laboratory/registry.ts` and `core/concepts/curatedLessons/registry.ts`:
 * Vite's `import.meta.glob` eagerly discovers every `*.json` file under
 * `src/content/exam-prep/<subject-folder>/` at build time. Adding a new
 * Constitution topic — or a whole new subject later — never means
 * touching this file's loading logic, only dropping in content and (for
 * a new subject) one more glob + registry entry following the same shape.
 *
 * Kept fully offline-first and bundle-time, like every other curated
 * content set in Cellfie: nothing here is fetched at runtime.
 */
import type { ExamSubjectId, ExamTopic } from './types'

function isValidTopic(x: unknown): x is ExamTopic {
  if (!x || typeof x !== 'object') return false
  const t = x as Partial<ExamTopic>
  return (
    typeof t.id === 'string' &&
    t.id.length > 0 &&
    typeof t.subjectId === 'string' &&
    typeof t.syllabusOrder === 'number' &&
    typeof t.title === 'string' &&
    typeof t.shortDescription === 'string' &&
    typeof t.genZNote === 'string' &&
    Array.isArray(t.sections) &&
    t.sections.length > 0 &&
    Boolean(t.quickRevision) &&
    Boolean(t.examFocus) &&
    Array.isArray(t.sources)
  )
}

function loadTopics(glob: Record<string, { default: unknown }>, subjectId: ExamSubjectId): ExamTopic[] {
  const topics: ExamTopic[] = []
  const seenIds = new Set<string>()
  for (const [path, mod] of Object.entries(glob)) {
    const data = mod.default
    if (!isValidTopic(data)) {
      // eslint-disable-next-line no-console
      console.warn(`[exam-prep] Skipping malformed topic content file: ${path}`)
      continue
    }
    if (data.subjectId !== subjectId) {
      // eslint-disable-next-line no-console
      console.warn(`[exam-prep] Skipping ${path}: subjectId "${data.subjectId}" does not match folder subject "${subjectId}"`)
      continue
    }
    if (seenIds.has(data.id)) {
      // eslint-disable-next-line no-console
      console.warn(`[exam-prep] Skipping ${path}: duplicate topic id "${data.id}"`)
      continue
    }
    seenIds.add(data.id)
    topics.push(data)
  }
  return topics.sort((a, b) => a.syllabusOrder - b.syllabusOrder)
}

const constitutionModules = import.meta.glob<{ default: unknown }>('/src/content/exam-prep/constitution/*.json', {
  eager: true
})

export const CONSTITUTION_TOPICS: ExamTopic[] = loadTopics(constitutionModules, 'constitution-of-india')

const CONSTITUTION_BY_ID = new Map(CONSTITUTION_TOPICS.map((t) => [t.id, t]))

/** Every topic for a subject, in syllabus order. Returns an empty array for a subject with no content yet (e.g. a future subject added to `subjects.ts` before its folder is populated) rather than throwing. */
export function listTopicsForSubject(subjectId: ExamSubjectId): ExamTopic[] {
  if (subjectId === 'constitution-of-india') return CONSTITUTION_TOPICS
  return []
}

export function getExamTopicById(subjectId: ExamSubjectId, id: string): ExamTopic | undefined {
  if (subjectId === 'constitution-of-india') return CONSTITUTION_BY_ID.get(id)
  return undefined
}
