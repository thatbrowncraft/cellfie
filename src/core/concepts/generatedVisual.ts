/**
 * core/concepts/generatedVisual — Visuals tab, native-illustration
 * fallback.
 *
 * NOT the Study Map. Visuals answers "show me a trustworthy scientific
 * visual for this concept" — first by trying a real external image
 * (`fetchVisualReferences`, onlineKnowledge.ts: PubChem structure PNGs,
 * Open-i biomedical figures), and only when neither exists, by drawing
 * a small native illustration from this concept's own verified
 * structured data as a last resort. That native illustration is a
 * labeled figure (a hub-and-satellite diagram of a handful of a
 * concept's real structural/compositional parts, each with its own
 * source), never the Study Map's flowchart re-rendered in a card —
 * different data selection (favors Structure/Classification over the
 * full module set), different shape (flat radial, no hierarchy/steps),
 * and no tap-to-drill interaction beyond a single expandable source
 * list, so the two features stay visually and functionally distinct.
 *
 * No AI, no invented parts: every label/detail below is a direct
 * excerpt (or a truncation of one) already present in a `DetailedStudyModule`
 * built from real MeSH/PubChem/PubMed/Europe PMC data. A concept with
 * fewer than 2 usable parts returns `undefined` — the caller shows the
 * "Import custom visual / PDF" empty state, never a fabricated figure.
 */

import type { Concept } from '../db'
import type { DetailedStudyModule } from './detailedStudy'

export interface GeneratedVisualPart {
  id: string
  label: string
  detail: string
  sourceRefs: { sourceName: string; sourceUrl: string }[]
}

export interface GeneratedVisual {
  title: string
  parts: GeneratedVisualPart[]
  sourceRefs: { sourceName: string; sourceUrl: string }[]
}

const MAX_PARTS = 6
const MAX_LABEL = 40

function truncateLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= MAX_LABEL) return trimmed
  return `${trimmed.slice(0, MAX_LABEL - 1).trimEnd()}…`
}

/** Preference order: a concept's physical/compositional parts (Structure) first, then how it's categorized (Classification), then its mechanism/function — Definition and Relationships rarely name discrete "parts" worth drawing as a diagram. */
const PART_MODULE_PRIORITY: DetailedStudyModule['id'][] = ['structure', 'classification', 'mechanism']

export function buildGeneratedVisual(concept: Pick<Concept, 'name'>, modules: DetailedStudyModule[]): GeneratedVisual | undefined {
  const byId = new Map(modules.map((m) => [m.id, m]))
  const parts: GeneratedVisualPart[] = []
  const usedTexts = new Set<string>()
  const sourceRefs: { sourceName: string; sourceUrl: string }[] = []
  const seenSourceUrls = new Set<string>()

  for (const modId of PART_MODULE_PRIORITY) {
    const mod = byId.get(modId)
    if (!mod || !mod.available) continue

    for (const sub of mod.subsections) {
      if (parts.length >= MAX_PARTS) break
      for (const bullet of sub.bullets ?? []) {
        if (parts.length >= MAX_PARTS) break
        const key = bullet.trim().toLowerCase()
        if (usedTexts.has(key)) continue
        usedTexts.add(key)
        parts.push({
          id: `part:${parts.length}`,
          label: truncateLabel(bullet),
          detail: bullet,
          sourceRefs: mod.sourceRefs
        })
      }
      // A named subsection with a body (not just bullets) also counts
      // as one labeled part — e.g. Structure's "Core principle".
      if (parts.length < MAX_PARTS && sub.heading && sub.body) {
        const key = sub.body.trim().toLowerCase()
        if (!usedTexts.has(key)) {
          usedTexts.add(key)
          parts.push({ id: `part:${parts.length}`, label: truncateLabel(sub.heading), detail: sub.body, sourceRefs: mod.sourceRefs })
        }
      }
    }

    for (const ref of mod.sourceRefs) {
      if (seenSourceUrls.has(ref.sourceUrl)) continue
      seenSourceUrls.add(ref.sourceUrl)
      sourceRefs.push(ref)
    }
  }

  if (parts.length < 2) return undefined

  return { title: concept.name, parts, sourceRefs }
}
