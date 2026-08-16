/**
 * core/concepts/sectionPlainText — Book-First Learning Engine, Phase 2.
 *
 * `EditableSection` needs one plain-text string per major section
 * regardless of which of the (quite differently shaped) content sources
 * produced it — a `CuratedLesson`/`BookLesson`, the MeSH/PubChem
 * `DetailedStudyModule[]` fallback, `OnlineKnowledgeSection[]`, or
 * `ExamTools`. These are pure, read-only flattening functions — never
 * called anywhere except to build that one string; nothing here writes
 * to the database or changes what's rendered when no edit exists.
 */
import type { LessonSection, ExamFocusSummary } from './curatedLessons/types'
import type { DetailedStudyModule } from './detailedStudy'
import type { OnlineKnowledgeSection } from './onlineKnowledge'
import type { ExamTools } from './examTools'

interface QuickRevisionLike {
  oneLineDefinition: string
  keyFacts: string[]
  keyTerms?: string[]
}

export function quickRevisionPlainText(qr: QuickRevisionLike): string {
  const parts = [qr.oneLineDefinition]
  if (qr.keyFacts.length > 0) parts.push(qr.keyFacts.map((f) => `- ${f}`).join('\n'))
  if (qr.keyTerms && qr.keyTerms.length > 0) parts.push(`Key terms: ${qr.keyTerms.join(', ')}`)
  return parts.filter(Boolean).join('\n\n')
}

export function lessonSectionsPlainText(sections: LessonSection[]): string {
  return sections
    .map((s) => {
      const lines = [s.heading]
      if (s.body) lines.push(s.body)
      if (s.bullets && s.bullets.length > 0) lines.push(s.bullets.map((b) => `- ${b}`).join('\n'))
      if (s.steps && s.steps.length > 0) lines.push(s.steps.map((st) => `${st.name}: ${st.explanation}`).join('\n'))
      return lines.join('\n')
    })
    .join('\n\n')
}

export function onlineSectionsPlainText(sections: OnlineKnowledgeSection[]): string {
  return sections
    .map((s) => (s.heading ? `${s.heading}\n${s.text}` : s.text))
    .join('\n\n')
}

export function detailedModulesPlainText(modules: DetailedStudyModule[]): string {
  return modules
    .filter((m) => m.available)
    .map((m) => {
      const body = m.subsections
        .map((s) => {
          const lines: string[] = []
          if (s.heading) lines.push(s.heading)
          if (s.body) lines.push(s.body)
          if (s.bullets && s.bullets.length > 0) lines.push(s.bullets.map((b) => `- ${b}`).join('\n'))
          return lines.join('\n')
        })
        .join('\n\n')
      return `${m.heading}\n${body}`
    })
    .join('\n\n')
}

export function examFocusPlainText(examFocus: ExamFocusSummary): string {
  const parts: string[] = []
  if (examFocus.highYieldFacts.length > 0) parts.push(`High-yield facts:\n${examFocus.highYieldFacts.map((f) => `- ${f}`).join('\n')}`)
  if (examFocus.mustRemember.length > 0) parts.push(`Must remember:\n${examFocus.mustRemember.map((f) => `- ${f}`).join('\n')}`)
  if (examFocus.commonTraps.length > 0) parts.push(`Common traps:\n${examFocus.commonTraps.map((f) => `- ${f}`).join('\n')}`)
  if (examFocus.confusedTerms && examFocus.confusedTerms.length > 0) {
    parts.push(`Commonly confused:\n${examFocus.confusedTerms.map((c) => `${c.termA} vs ${c.termB}: ${c.distinction}`).join('\n')}`)
  }
  if (examFocus.possibleQuestions && examFocus.possibleQuestions.length > 0) {
    parts.push(`Questions to think through:\n${examFocus.possibleQuestions.map((q) => `- ${q}`).join('\n')}`)
  }
  return parts.join('\n\n')
}

export function examToolsPlainText(examTools: ExamTools): string {
  const parts: string[] = []
  if (examTools.keyPoints.length > 0) parts.push(`Key exam points:\n${examTools.keyPoints.map((p) => `- ${p.text}`).join('\n')}`)
  if (examTools.importantValues.length > 0) parts.push(`Important values:\n${examTools.importantValues.map((v) => `- ${v.text}`).join('\n')}`)
  return parts.join('\n\n')
}
