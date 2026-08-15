/**
 * core/concepts/examTools — Concept 2.0 Phase 5. Pure, offline derivation
 * of exam-oriented study aids from data this app has ALREADY fetched and
 * verified — the Learn tab's online knowledge sections (Phase 1) and this
 * concept's stored relationships (Phase 2). No network calls of its own,
 * no AI, no invented facts: every card here is either a direct excerpt
 * from a real source (attributed) or a template filled in with real
 * stored data (a relationship's own type/evidence). Per §10, a block is
 * simply omitted — never padded with a placeholder — when there isn't
 * real material to build it from.
 *
 * Third Refinement §14: the old "Quick questions" block (one card per
 * section reading "What is X, according to <source>?") is removed —
 * that's a source lookup, not exam preparation, and it doesn't belong
 * anywhere near Exam Focus. This is the fallback path for concepts that
 * don't have a curated lesson yet (see curatedLessons/registry.ts); a
 * curated lesson's own `examFocus.possibleQuestions` — real conceptual
 * questions, hand-authored — is the intended replacement, rendered by
 * CuratedExamFocusView, not this file.
 */

import type { OnlineKnowledgeSection } from './onlineKnowledge'

export interface KeyExamPoint {
  text: string
  sourceName: string
  sourceUrl: string
}

export interface ImportantValue {
  /** The real sentence/snippet containing the value — never just the bare number, so it stays meaningful out of context. */
  text: string
  sourceName: string
  sourceUrl: string
}

export interface ExamTools {
  keyPoints: KeyExamPoint[]
  importantValues: ImportantValue[]
}

/** Splits on sentence-ending punctuation followed by a space+capital/digit or end of string — the same lightweight heuristic used elsewhere in this codebase (see textDisplay.ts), not a full NLP tokenizer. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Generic, unit-driven — matches ANY concept's text the same way, never
// keyed to what the concept IS (no "if DNA then temperature" rule). Covers
// the value families §10 names: temperature, pH, wavelength/size/mass,
// concentration, time.
const VALUE_PATTERN =
  /(-?\d+(?:\.\d+)?\s?(?:°C|°F|K)\b)|(\bpH\s?-?\d+(?:\.\d+)?)|(\d+(?:\.\d+)?\s?(?:nm|µm|mm|cm|kDa|Da|kb|bp)\b)|(\d+(?:\.\d+)?\s?(?:mM|µM|nM|mg\/mL|µg\/mL|mol\/L|M|%)\b)|(\d+(?:\.\d+)?\s?(?:hours?|hrs?|minutes?|mins?|seconds?|secs?|days?)\b)/i

/**
 * §10 "Key exam points" + "Important values". Built purely from
 * `sections` (already fetched for the Learn tab) — no new network calls.
 * `keyPoints` takes each section's own first sentence (the source's own
 * opening statement, never a middle-of-nowhere excerpt). `importantValues`
 * scans every sentence of every section for a recognized unit and keeps
 * the whole sentence as context, deduplicated.
 */
function deriveFromSections(sections: OnlineKnowledgeSection[]): {
  keyPoints: KeyExamPoint[]
  importantValues: ImportantValue[]
} {
  const keyPoints: KeyExamPoint[] = []
  const importantValues: ImportantValue[] = []
  const seenValueText = new Set<string>()

  for (const section of sections) {
    const sentences = splitSentences(section.text)
    if (sentences[0]) {
      keyPoints.push({ text: sentences[0], sourceName: section.sourceName, sourceUrl: section.sourceUrl })
    }
    for (const sentence of sentences) {
      if (!VALUE_PATTERN.test(sentence)) continue
      const dedupeKey = sentence.toLowerCase()
      if (seenValueText.has(dedupeKey)) continue
      seenValueText.add(dedupeKey)
      importantValues.push({ text: sentence, sourceName: section.sourceName, sourceUrl: section.sourceUrl })
    }
  }

  return { keyPoints: keyPoints.slice(0, 6), importantValues: importantValues.slice(0, 6) }
}

/**
 * Single entry point for Exam Focus's key-points/values content.
 * Everything here is derived from data the page already has in memory
 * (this concept's fetched online-knowledge sections) — no new fetches,
 * so it's instant and works offline once those have loaded once.
 *
 * "Compare" and "Common confusion" aren't produced here: a reliable,
 * generic way to auto-detect that two concepts are commonly CONFUSED
 * (§10) — as opposed to merely related — would need either hardcoded
 * per-topic knowledge (explicitly ruled out by this brief) or an AI
 * judgment call (also ruled out), so this app doesn't fabricate that
 * signal. Instead, ExamToolsPanel.tsx's OWN `relatedEntries` prop
 * (the person's own manual connections — never passed through this
 * function) is what the Exam Focus UI offers as compare candidates —
 * the person picks which comparison actually matters to them and reads
 * both concepts' real sourced material side by side, forming the
 * comparison themselves. A memory aid is 100% user-authored
 * (`updateConceptMemoryAid` in service.ts, independent component
 * MemoryAidCard.tsx) and never appears here as a suggestion.
 */
export function buildExamTools(sections: OnlineKnowledgeSection[]): ExamTools {
  return deriveFromSections(sections)
}
