/**
 * core/concepts/studyMap — Mind Map Redesign.
 *
 * Replaces the old implementation, which rendered Detailed Study's five
 * fixed module headings directly as the Study Map's top-level boxes
 * (`Definition & Biological Scope`, `Classification & Taxonomic
 * Hierarchy`, ...). That made Study Map a re-skin of Detailed Study
 * with no real graph structure and no way to tell "this concept is a
 * lab procedure" from "this concept is a molecule" — see this file's
 * git history for the version being replaced.
 *
 * This version builds an actual small GRAPH (`StudyMapNode[]` +
 * `StudyMapEdge[]`) from the same already-verified input
 * (`DetailedStudyModule[]`, built only from real MeSH/PubChem/PubMed/
 * Europe PMC data — see detailedStudy.ts) but:
 *
 *   1. Detects whether the concept's own verified text describes a
 *      PROCEDURE (a real bullet list or clearly sequential prose under
 *      a methods/procedure/protocol-flavored heading) and, if so,
 *      builds a linear step-by-step flow instead of a module tree.
 *   2. Otherwise builds a CONCEPTUAL map: a root node branching into
 *      only the modules that actually have distinct content, each
 *      branching into its own real subsections/bullets — never a fixed
 *      five-branch shape, and a module with only one short subsection
 *      collapses onto a single tappable leaf instead of a redundant
 *      wrapper node.
 *   3. Every non-root node carries the REAL text it came from
 *      (`detail`) and its source (`sourceRefs`), so the renderer can
 *      show "what this node actually says" on tap — this is new; the
 *      old tree only carried a label, so tapping a box did nothing.
 *
 * Still true of the old version, unchanged:
 *   - reads or writes NO `ConceptRelation` row
 *   - creates NO Concept
 *   - invents NO mechanism, sequence, or relationship beyond what a
 *     literal structured field (a bullet, a labeled subsection, a
 *     sentence with an explicit sequence marker like "First," /
 *     "Step 2:") already states
 *   - NO AI/LLM call of any kind — every label and detail string below
 *     is a direct excerpt or a truncation of one, never generated text
 *   - a concept with nothing genuinely distinct to show returns
 *     `undefined`; the caller must show an honest empty state, never a
 *     fabricated placeholder graph
 *
 * The caller (StudyMapView.tsx, via ConceptMindMap.tsx) is responsible
 * for making clear this is a generated, READ-ONLY study visualization —
 * never the person's own "My concept map" (graph.ts), and tapping a
 * node never creates a ConceptRelation.
 */

import type { Concept } from '../db'
import type { DetailedStudyModule, DetailedStudySubsection } from './detailedStudy'

export type StudyMapNodeKind = 'root' | 'category' | 'detail' | 'step' | 'outcome'

export interface StudyMapSourceRef {
  sourceName: string
  sourceUrl: string
}

export interface StudyMapNode {
  id: string
  /** Short label for the node's box — truncated for display. */
  label: string
  kind: StudyMapNodeKind
  /** The real underlying text (untruncated). Absent only for pure grouping nodes with nothing beyond their own label. Tapping a node with `detail` and/or `sourceRefs` reveals this — see StudyMapView.tsx. */
  detail?: string
  sourceRefs: StudyMapSourceRef[]
}

export interface StudyMapEdge {
  id: string
  from: string
  to: string
}

export interface StudyMap {
  nodes: StudyMapNode[]
  edges: StudyMapEdge[]
  rootId: string
  /** 'procedure' → the graph is a single linear sequence (draw as a top-to-bottom flow with directional arrows). 'conceptual' → the graph branches (draw as a hierarchy). */
  shape: 'procedure' | 'conceptual'
}

const MAX_LABEL_CATEGORY = 42
const MAX_LABEL_DETAIL = 56
const MAX_SUBSECTIONS_PER_MODULE = 3
const MAX_BULLETS_PER_SUBSECTION = 4

function truncateLabel(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

const CATEGORY_LABEL: Record<DetailedStudyModule['id'], string> = {
  definition: 'Definition',
  classification: 'Classification',
  structure: 'Structure & Composition',
  mechanism: 'Mechanism & Function',
  relationships: 'Key Relationships'
}

// ---------------------------------------------------------------------
// Procedure detection.
//
// A concept counts as a "procedure" only when its own verified text
// already presents steps as either (a) a real bullet list under a
// heading that reads as procedural, or (b) prose whose sentences
// themselves carry explicit sequence markers ("First,", "Step 2:",
// "Next,", "Finally,") under such a heading. Anything short of that
// falls through to the conceptual map — the deliberate "boring but
// honest" fallback over a fabricated pathway, same principle the old
// version of this file used for its own fallback.
// ---------------------------------------------------------------------

const PROCEDURE_HEADING = /\b(method|methods|procedure|protocol|technique|interventions?|design|steps?|stages?|process)\b/i
const STEP_MARKER =
  /(^|[.;:]\s+)(first|second|third|fourth|fifth|initially|then|next|after(?:wards)?|following this|subsequently|finally|lastly|step\s*\d+|\(\d+\))/i
const OUTCOME_WORDS = /\b(result|outcome|interpret(?:ation)?|indicates?|positive|negative|diagnos(?:is|tic))\b/i

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface DetectedStep {
  detail: string
}

function detectProcedureSteps(modules: DetailedStudyModule[]): { steps: DetectedStep[]; sourceRefs: StudyMapSourceRef[] } | undefined {
  // Preference 1 — a real bullet list (already a literal structured
  // field, e.g. from a source that itself enumerated steps) sitting
  // under a procedure-flavored heading.
  for (const mod of modules) {
    for (const sub of mod.subsections) {
      if (sub.heading && PROCEDURE_HEADING.test(sub.heading) && sub.bullets && sub.bullets.length >= 3) {
        return { steps: sub.bullets.map((b) => ({ detail: b })), sourceRefs: mod.sourceRefs }
      }
    }
  }

  // Preference 2 — prose under a procedure-flavored heading whose own
  // sentences already carry explicit sequence language. The longest
  // qualifying candidate wins so a short incidental "First," doesn't
  // beat a genuinely described protocol elsewhere.
  let best: { steps: DetectedStep[]; sourceRefs: StudyMapSourceRef[] } | undefined
  for (const mod of modules) {
    for (const sub of mod.subsections) {
      if (!sub.body) continue
      const headingIsProcedural = sub.heading ? PROCEDURE_HEADING.test(sub.heading) : false
      const sentences = splitIntoSentences(sub.body)
      const markerCount = sentences.filter((s) => STEP_MARKER.test(s)).length
      const qualifies = markerCount >= 3 || (headingIsProcedural && markerCount >= 2)
      if (qualifies && (!best || sentences.length > best.steps.length)) {
        best = { steps: sentences.map((s) => ({ detail: s })), sourceRefs: mod.sourceRefs }
      }
    }
  }
  return best
}

function buildProcedureMap(concept: Pick<Concept, 'name'>, steps: DetectedStep[], sourceRefs: StudyMapSourceRef[]): StudyMap {
  const capped = steps.slice(0, 8)
  const nodes: StudyMapNode[] = [{ id: 'root', label: concept.name, kind: 'root', sourceRefs: [] }]
  const edges: StudyMapEdge[] = []

  let previousId = 'root'
  capped.forEach((step, i) => {
    const isLast = i === capped.length - 1
    const id = `step:${i}`
    nodes.push({
      id,
      label: truncateLabel(step.detail, MAX_LABEL_DETAIL),
      kind: isLast && OUTCOME_WORDS.test(step.detail) ? 'outcome' : 'step',
      detail: step.detail,
      sourceRefs
    })
    edges.push({ id: `e:${previousId}->${id}`, from: previousId, to: id })
    previousId = id
  })

  return { nodes, edges, rootId: 'root', shape: 'procedure' }
}

// ---------------------------------------------------------------------
// Conceptual map — root branching into only the modules with genuinely
// distinct content, each branching into its own real subsections and
// bullets. Structurally similar in spirit to the old five-heading tree,
// but: (a) skips modules with nothing beyond one short paragraph
// (collapsed onto a single tappable node instead of an empty-looking
// branch), (b) every node carries its real source text for tap-to-
// reveal, (c) category labels are short display names, not the full
// Detailed Study module heading repeated verbatim.
// ---------------------------------------------------------------------

function addSubsectionNodes(
  nodes: StudyMapNode[],
  edges: StudyMapEdge[],
  parentId: string,
  modId: string,
  sub: DetailedStudySubsection,
  index: number,
  sourceRefs: StudyMapSourceRef[]
): void {
  const subId = `${modId}:${sub.id}`
  const subLabel = sub.heading ? truncateLabel(sub.heading, MAX_LABEL_CATEGORY) : undefined

  // A named subsection becomes its own node when it has a heading; an
  // unlabeled subsection's bullets/body attach directly to the parent
  // instead of a meaningless "untitled subsection" wrapper.
  const branchId = subLabel ? subId : parentId
  if (subLabel) {
    nodes.push({ id: subId, label: subLabel, kind: 'detail', detail: sub.body, sourceRefs })
    edges.push({ id: `e:${parentId}->${subId}:${index}`, from: parentId, to: subId })
  }

  const bullets = (sub.bullets ?? []).slice(0, MAX_BULLETS_PER_SUBSECTION)
  bullets.forEach((b, i) => {
    const bId = `${subId}:b${i}`
    nodes.push({ id: bId, label: truncateLabel(b, MAX_LABEL_DETAIL), kind: 'detail', detail: b, sourceRefs })
    edges.push({ id: `e:${branchId}->${bId}`, from: branchId, to: bId })
  })

  // A subsection with a body but no bullets and no heading was already
  // folded into the parent above (no node of its own); a subsection
  // with a body AND a heading shows that body as the node's own
  // `detail` (set above), so it needs no further child node.
}

function buildConceptualMap(concept: Pick<Concept, 'name'>, modules: DetailedStudyModule[]): StudyMap {
  const nodes: StudyMapNode[] = [{ id: 'root', label: concept.name, kind: 'root', sourceRefs: [] }]
  const edges: StudyMapEdge[] = []

  for (const mod of modules) {
    const catId = `cat:${mod.id}`
    const namedSubsections = mod.subsections.filter((s) => s.heading).slice(0, MAX_SUBSECTIONS_PER_MODULE)
    const soleSubsection = namedSubsections.length === 0 ? mod.subsections[0] : undefined

    // A module whose only content is one unlabeled short subsection
    // collapses onto a single tappable category node instead of a
    // category box with one redundant child box beneath it.
    const collapsesToSingleNode = soleSubsection && !(soleSubsection.bullets && soleSubsection.bullets.length > 0)

    nodes.push({
      id: catId,
      label: CATEGORY_LABEL[mod.id],
      kind: 'category',
      detail: collapsesToSingleNode ? soleSubsection?.body : undefined,
      sourceRefs: mod.sourceRefs
    })
    edges.push({ id: `e:root->${catId}`, from: 'root', to: catId })

    if (collapsesToSingleNode) continue

    if (namedSubsections.length > 0) {
      namedSubsections.forEach((sub, i) => addSubsectionNodes(nodes, edges, catId, mod.id, sub, i, mod.sourceRefs))
    } else if (soleSubsection) {
      addSubsectionNodes(nodes, edges, catId, mod.id, soleSubsection, 0, mod.sourceRefs)
    }
  }

  return { nodes, edges, rootId: 'root', shape: 'conceptual' }
}

/**
 * Entry point. Returns `undefined` when no module has any verified
 * content yet (only `available` modules — see detailedStudy.ts — are
 * considered) — the caller must show an honest empty state, never an
 * empty/placeholder diagram.
 */
export function buildStudyMap(concept: Pick<Concept, 'name'>, modules: DetailedStudyModule[]): StudyMap | undefined {
  const available = modules.filter((m) => m.available)
  if (available.length === 0) return undefined

  const detected = detectProcedureSteps(available)
  if (detected && detected.steps.length >= 3) {
    return buildProcedureMap(concept, detected.steps, detected.sourceRefs)
  }
  return buildConceptualMap(concept, available)
}
