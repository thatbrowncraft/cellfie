/**
 * core/concepts/studyMap — Concept Hub Quality Pass §2/§3/§9.
 *
 * "Study Map" / "Generate study diagram" — a visual representation of a
 * concept's already-verified scientific information, NOT a knowledge
 * graph. This module builds a plain display tree (root → module →
 * subsection → bullet) purely by re-shaping `DetailedStudyModule[]`
 * (core/concepts/detailedStudy.ts), which is itself built only from
 * real MeSH/PubMed/Europe PMC/structured-source data. Nothing here:
 *
 *   - reads or writes a ConceptRelation row
 *   - creates a Concept
 *   - invents a mechanism, sequence, or relationship that isn't already
 *     a literal structured field (a module heading, a subsection
 *     heading, or a bullet already split out at the source)
 *   - falls back to guessing a "process" shape — if the source material
 *     wasn't already structured that way, this simply renders the plain
 *     Concept → Definition/Classification/Principle/... shape, which is
 *     the deliberately "boring but honest" fallback the brief asks for
 *     over a fabricated pathway diagram.
 *
 * The caller (StudyMapView.tsx) is responsible for making clear this is
 * a generated STUDY visualization, never treating it as — or writing it
 * into — the person's own Connections/Mind Map graph.
 */

import type { Concept } from '../db'
import type { DetailedStudyModule } from './detailedStudy'

export interface StudyMapTreeNode {
  id: string
  label: string
  children: StudyMapTreeNode[]
}

const MAX_SUBSECTIONS_PER_MODULE = 3
const MAX_BULLETS_PER_SUBSECTION = 4
const MAX_LABEL_LENGTH = 70

function truncateLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
}

/**
 * Builds the diagram tree for one Detailed Study module. Prefers its
 * named subsections (already a real structured field — MeSH's
 * parent/children, a structured-abstract's own labeled sections, etc.);
 * when a module has only a single unlabeled subsection, its bullets (if
 * any) are surfaced directly under the module instead of under a
 * meaningless "untitled subsection" node. A module with neither named
 * subsections nor bullets still appears as a leaf — the module heading
 * itself ("Definition & Biological Scope" etc.) is real, verified
 * information, even with nothing further to branch into.
 */
function buildModuleNode(mod: DetailedStudyModule): StudyMapTreeNode {
  const namedSubsections = mod.subsections.filter((s) => s.heading).slice(0, MAX_SUBSECTIONS_PER_MODULE)

  if (namedSubsections.length > 0) {
    const children = namedSubsections.map((sub) => {
      const bulletChildren: StudyMapTreeNode[] = (sub.bullets ?? [])
        .slice(0, MAX_BULLETS_PER_SUBSECTION)
        .map((b, i) => ({ id: `${mod.id}:${sub.id}:b${i}`, label: truncateLabel(b), children: [] }))
      return { id: `${mod.id}:${sub.id}`, label: truncateLabel(sub.heading as string), children: bulletChildren }
    })
    return { id: `module:${mod.id}`, label: mod.heading, children }
  }

  const soleBullets = mod.subsections[0]?.bullets ?? []
  const bulletChildren: StudyMapTreeNode[] = soleBullets
    .slice(0, MAX_BULLETS_PER_SUBSECTION)
    .map((b, i) => ({ id: `${mod.id}:b${i}`, label: truncateLabel(b), children: [] }))
  return { id: `module:${mod.id}`, label: mod.heading, children: bulletChildren }
}

/**
 * Entry point. Returns `undefined` when no module has any verified
 * content yet — the caller must show an honest empty state, never an
 * empty/placeholder diagram. Only `available` modules (§ detailedStudy.ts —
 * a module reports `available: false` when it has nothing genuinely
 * distinct to say) are included, so a concept with only 1-2 populated
 * modules still gets a small, honest map instead of five empty branches.
 */
export function buildStudyMap(concept: Pick<Concept, 'name'>, modules: DetailedStudyModule[]): StudyMapTreeNode | undefined {
  const available = modules.filter((m) => m.available)
  if (available.length === 0) return undefined
  return {
    id: 'study-map-root',
    label: concept.name,
    children: available.map(buildModuleNode)
  }
}
