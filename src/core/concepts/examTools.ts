/**
 * Exam Focus is derived from material the Learn tab already has. Uploaded
 * book content is preferred when available; online material remains the
 * fallback. No new network calls and no invented facts.
 */

import type { OnlineKnowledgeSection } from './onlineKnowledge'
import type { BookLesson } from './bookLesson'

export interface KeyExamPoint {
  text: string
  sourceName: string
  sourceUrl: string
}

export interface ImportantValue {
  text: string
  sourceName: string
  sourceUrl: string
}

export interface ExamTools {
  keyPoints: KeyExamPoint[]
  importantValues: ImportantValue[]
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const VALUE_PATTERN =
  /(-?\d+(?:\.\d+)?\s?(?:°C|°F|K)\b)|(\bpH\s?-?\d+(?:\.\d+)?)|(\d+(?:\.\d+)?\s?(?:nm|µm|mm|cm|kDa|Da|kb|bp)\b)|(\d+(?:\.\d+)?\s?(?:mM|µM|nM|mg\/mL|µg\/mL|mol\/L|M|%)\b)|(\d+(?:\.\d+)?\s?(?:hours?|hrs?|minutes?|mins?|seconds?|secs?|days?)\b)/i

function normalizeForDedupe(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function rankExamSentence(sentence: string, conceptName = ''): number {
  const lower = sentence.toLowerCase()
  let score = 0
  if (conceptName && lower.includes(conceptName.toLowerCase())) score += 3
  if (/\b(is|are|means|refers to|defined as|known as|called)\b/.test(lower)) score += 3
  if (/\b(consists of|comprises|includes|stages?|steps?)\b/.test(lower)) score += 3
  if (/\b(requires?|depends on|occurs|takes place|involves|uses?|produces?|results in|functions? as|used for)\b/.test(lower)) score += 2
  if (/\b(important|essential|major|primary|key|main|first|second|finally)\b/.test(lower)) score += 1
  if (/\b(figure|table|credit|access for free|link to learning)\b/.test(lower)) score -= 5
  if (sentence.length > 420) score -= 2
  if (sentence.length < 45) score -= 1
  return score
}

function deriveFromBookLesson(lesson: BookLesson): ExamTools {
  const keyCandidates: Array<{ text: string; score: number }> = []
  const importantValues: ImportantValue[] = []
  const seenKey = new Set<string>()
  const seenValue = new Set<string>()
  const sourceName = lesson.sources[0]?.name ?? 'Uploaded books'

  for (const section of lesson.sections) {
    for (const sentence of splitSentences(section.body ?? '')) {
      const key = normalizeForDedupe(sentence)
      if (!key || seenKey.has(key)) continue
      seenKey.add(key)

      const score = rankExamSentence(sentence, lesson.conceptDisplayName)
      if (score >= 2) keyCandidates.push({ text: sentence, score })

      if (VALUE_PATTERN.test(sentence)) {
        const valueKey = normalizeForDedupe(sentence)
        if (!seenValue.has(valueKey)) {
          seenValue.add(valueKey)
          importantValues.push({ text: sentence, sourceName, sourceUrl: '' })
        }
      }
    }
  }

  keyCandidates.sort((a, b) => b.score - a.score || a.text.length - b.text.length)
  return {
    keyPoints: keyCandidates.slice(0, 8).map(({ text }) => ({ text, sourceName, sourceUrl: '' })),
    importantValues: importantValues.slice(0, 6)
  }
}

function deriveFromOnlineSections(sections: OnlineKnowledgeSection[]): ExamTools {
  const keyPoints: KeyExamPoint[] = []
  const importantValues: ImportantValue[] = []
  const seenValueText = new Set<string>()

  for (const section of sections) {
    const sentences = splitSentences(section.text)
    const best = sentences
      .map((text) => ({ text, score: rankExamSentence(text) }))
      .sort((a, b) => b.score - a.score)[0]
    if (best?.text && best.score >= 1) {
      keyPoints.push({ text: best.text, sourceName: section.sourceName, sourceUrl: section.sourceUrl })
    }
    for (const sentence of sentences) {
      if (!VALUE_PATTERN.test(sentence)) continue
      const key = normalizeForDedupe(sentence)
      if (seenValueText.has(key)) continue
      seenValueText.add(key)
      importantValues.push({ text: sentence, sourceName: section.sourceName, sourceUrl: section.sourceUrl })
    }
  }

  return { keyPoints: keyPoints.slice(0, 6), importantValues: importantValues.slice(0, 6) }
}

export function buildExamTools(onlineSections: OnlineKnowledgeSection[], bookLesson?: BookLesson): ExamTools {
  if (bookLesson && bookLesson.sections.length > 0) return deriveFromBookLesson(bookLesson)
  return deriveFromOnlineSections(onlineSections)
}
