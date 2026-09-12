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

// Vite's import.meta.glob requires a static string literal per call — one
// glob per subject folder is unavoidable, but everything AFTER the glob
// (validation, sorting, lookup-by-id) is fully generic below. Adding the
// NEXT subject means adding one glob line here plus one entry in the
// `SUBJECT_TOPICS` map — nothing else in this file, or in any page
// component, needs to change (brief §47, "future scalability").
const constitutionModules = import.meta.glob<{ default: unknown }>('/src/content/exam-prep/constitution/*.json', {
  eager: true
})
const quantitativeAptitudeModules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/quantitative-aptitude/*.json',
  { eager: true }
)
const englishLanguageModules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/english/*.json',
  { eager: true }
)
const logicalReasoningModules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/logical-reasoning/*.json',
  { eager: true }
)
const generalKnowledgeModules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/general-knowledge/*.json',
  { eager: true }
)
const currentAffairs2026Modules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/current-affairs-2026/*.json',
  { eager: true }
)
const internationalOrganizationsModules = import.meta.glob<{ default: unknown }>(
  '/src/content/exam-prep/international-organizations/*.json',
  { eager: true }
)
const isoModules = import.meta.glob<{ default: unknown }>('/src/content/exam-prep/iso/*.json', { eager: true })

export const CONSTITUTION_TOPICS: ExamTopic[] = loadTopics(constitutionModules, 'constitution-of-india')
export const QUANTITATIVE_APTITUDE_TOPICS: ExamTopic[] = loadTopics(
  quantitativeAptitudeModules,
  'quantitative-aptitude'
)
export const ENGLISH_LANGUAGE_TOPICS: ExamTopic[] = loadTopics(englishLanguageModules, 'english-language')
export const LOGICAL_REASONING_TOPICS: ExamTopic[] = loadTopics(logicalReasoningModules, 'logical-reasoning')
export const GENERAL_KNOWLEDGE_TOPICS: ExamTopic[] = loadTopics(generalKnowledgeModules, 'general-knowledge')
export const CURRENT_AFFAIRS_2026_TOPICS: ExamTopic[] = loadTopics(
  currentAffairs2026Modules,
  'current-affairs-2026'
)
export const INTERNATIONAL_ORGANIZATIONS_TOPICS: ExamTopic[] = loadTopics(
  internationalOrganizationsModules,
  'international-organizations'
)
export const ISO_TOPICS: ExamTopic[] = loadTopics(isoModules, 'iso')

const SUBJECT_TOPICS: Record<ExamSubjectId, ExamTopic[]> = {
  'constitution-of-india': CONSTITUTION_TOPICS,
  'quantitative-aptitude': QUANTITATIVE_APTITUDE_TOPICS,
  'english-language': ENGLISH_LANGUAGE_TOPICS,
  'logical-reasoning': LOGICAL_REASONING_TOPICS,
  'general-knowledge': GENERAL_KNOWLEDGE_TOPICS,
  'current-affairs-2026': CURRENT_AFFAIRS_2026_TOPICS,
  'international-organizations': INTERNATIONAL_ORGANIZATIONS_TOPICS,
  iso: ISO_TOPICS
}

const SUBJECT_TOPICS_BY_ID: Record<ExamSubjectId, Map<string, ExamTopic>> = Object.fromEntries(
  Object.entries(SUBJECT_TOPICS).map(([subjectId, topics]) => [subjectId, new Map(topics.map((t) => [t.id, t]))])
) as Record<ExamSubjectId, Map<string, ExamTopic>>

/** Every topic for a subject, in syllabus order. Returns an empty array for a subject with no content yet (e.g. a future subject added to `subjects.ts` before its folder is populated) rather than throwing. */
export function listTopicsForSubject(subjectId: ExamSubjectId): ExamTopic[] {
  return SUBJECT_TOPICS[subjectId] ?? []
}

export function getExamTopicById(subjectId: ExamSubjectId, id: string): ExamTopic | undefined {
  return SUBJECT_TOPICS_BY_ID[subjectId]?.get(id)
}
