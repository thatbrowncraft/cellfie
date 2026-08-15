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
 *   2. Otherwise builds a CONCEPTUAL map — Concept Hub knowledge-flow
 *      correction: this is now a genuine RELATIONSHIP graph, not a
 *      re-skin of Detailed Study's module list. MeSH's own typed
 *      parent/child/associated-concept data becomes the map's
 *      skeleton (each edge carrying MeSH's real relation name — "is
 *      a", "associated with", ...), with a small number of short key
 *      facts from Structure/Mechanism attached under generic relation
 *      labels. Definition and Classification's rendered prose are
 *      deliberately NOT turned into branches here — see
 *      `buildConceptualMap`'s own header comment for why.
 *   3. Every non-root node carries the REAL text it came from
 *      (`detail`) and its source (`sourceRefs`), so the renderer can
 *      show "what this node actually says" on tap — and that detail
 *      is a short 1-2 sentence excerpt (`shortDetail`), never the full
 *      Detailed Study paragraph, so tapping a node never just reopens
 *      the same content Detailed Study already showed.
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
import type { DetailedStudyModule } from './detailedStudy'
import type { MeshClassification, MeshRelationship } from './onlineKnowledge'

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
  /** A short relationship label ("is a", "structural feature", "associated with"...) drawn at the edge's midpoint — this is what makes the map show RELATIONSHIPS between ideas rather than an unlabeled tree that just happens to have the same shape as Detailed Study's module list. Omitted for procedure-flow edges, which are already self-explanatory as a sequence. */
  label?: string
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

function truncateLabel(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
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

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface DetectedStep {
  detail: string
}

/** Exported so generatedVisual.ts's 'process' visual type can reuse the SAME procedure detection Mind Map uses — a concept is or isn't a procedure independent of which feature is asking, so the detection logic lives in one place. */
export function detectProcedureSteps(modules: DetailedStudyModule[]): { steps: DetectedStep[]; sourceRefs: StudyMapSourceRef[] } | undefined {
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

// A step's own sentence often already states WHY it's there ("...acts
// as a mordant", "...serves as the primary stain", "...is the
// differentiation step"). Surfacing that phrase as the edge label is
// what turns a bare step sequence into "procedure + why", per the
// Mind Map spec — generic pattern matching, not anything specific to
// any one procedure.
const ROLE_PHRASE_RE =
  /\b(?:acts?|serves?|functions?)\s+as\s+(?:an?|the)?\s*([a-z][a-z\s-]{2,40}?)(?=[.,;]|$)/i

export function extractRole(text: string): string | undefined {
  const match = ROLE_PHRASE_RE.exec(text)
  if (!match) return undefined
  const phrase = match[1].trim()
  if (!phrase) return undefined
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
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
    edges.push({ id: `e:${previousId}->${id}`, from: previousId, to: id, label: extractRole(step.detail) })
    previousId = id
  })

  return { nodes, edges, rootId: 'root', shape: 'procedure' }
}

// ---------------------------------------------------------------------
// Conceptual map — a genuine RELATIONSHIP graph, not a re-skin of
// Detailed Study's module list.
//
// Two different kinds of edges feed this map, and both carry a real
// relationship label:
//
//   1. MeSH's own typed relationships (parent → "is a", children →
//      "type of", associated/related → their own MeSH-given relation
//      name). This is structured relational data at the source — MeSH
//      already says two terms ARE related and HOW — so it becomes the
//      map's skeleton rather than raw Detailed Study paragraphs.
//   2. A small number of short KEY FACTS pulled from Structure's and
//      Mechanism's own subsections/bullets, each attached to the root
//      with a generic relation label ("has structural feature" /
//      "function"). These are intentionally SHORT — the map shows what
//      the fact IS, not the paragraph explaining it; the full
//      explanation lives in Detailed Study, and only a concise 1-2
//      sentence version becomes this node's tap-to-reveal `detail` (see
//      `shortDetail`), so tapping a Mind Map node never just reopens
//      the Detailed Study paragraph verbatim.
//
// Definition and Classification's own rendered text are deliberately
// NOT turned into map branches — a definition is prose to read, not a
// relationship to diagram, and Classification's MeSH data is exactly
// what feeds MeSH-relationship branch (1) above in cleaner, typed
// form. This is also why the map's shape no longer matches Detailed
// Study's five-module list: the two features now consume the same
// underlying verified knowledge through genuinely different lenses.
// ---------------------------------------------------------------------

const RELATIONSHIP_EDGE_LABEL: Record<MeshRelationship['relationshipType'], string> = {
  is_a: 'is a',
  contains_subtype: 'type of',
  associated_with: 'associated with',
  related_to: 'related to'
}

const MAX_FACTS_PER_BRANCH = 4

/** Trims a source excerpt down to its first 1-2 sentences (~220 chars) for a node's tap-to-reveal detail — concise on purpose, so a Mind Map node never just reproduces the full Detailed Study paragraph it was drawn from. */
function shortDetail(text: string): string {
  const sentences = splitIntoSentences(text)
  let out = sentences[0] ?? text
  if (sentences.length > 1 && out.length < 90) out = `${out} ${sentences[1]}`
  return out.length > 240 ? `${out.slice(0, 239).trimEnd()}…` : out
}

/**
 * Pulls a handful of short, distinct facts out of a module's
 * subsections for use as Mind Map satellite nodes. Prefers real
 * bullets (already short, already structured) and only falls back to
 * splitting a body paragraph's comma-separated list shape (e.g. "a
 * sugar, a phosphate group, and a nitrogenous base") when no bullets
 * exist — never a generic fixed character-window truncation of an
 * arbitrary sentence, which would just be "Detailed Study, shortened".
 */
function extractKeyFacts(mod: DetailedStudyModule): { label: string; detail: string }[] {
  const facts: { label: string; detail: string }[] = []
  const seen = new Set<string>()

  const pushFact = (label: string, detail: string) => {
    const key = label.trim().toLowerCase()
    if (!key || seen.has(key) || facts.length >= MAX_FACTS_PER_BRANCH) return
    seen.add(key)
    facts.push({ label: truncateLabel(label, MAX_LABEL_DETAIL), detail })
  }

  for (const sub of mod.subsections) {
    for (const b of sub.bullets ?? []) pushFact(b, b)
    if (facts.length >= MAX_FACTS_PER_BRANCH) break
  }

  if (facts.length === 0) {
    for (const sub of mod.subsections) {
      if (!sub.body) continue
      const firstSentence = splitIntoSentences(sub.body)[0] ?? sub.body
      // A comma-joined list inside one sentence ("a sugar, a phosphate
      // group, and a nitrogenous base") is real enumerated structure
      // hiding in prose — split it into separate facts instead of one
      // long node.
      const parts = firstSentence
        .split(/,\s*(?:and\s+)?|\s+and\s+/)
        .map((p) => p.trim())
        .filter((p) => p.split(/\s+/).length >= 2 && p.split(/\s+/).length <= 7)
      if (parts.length >= 2) {
        for (const p of parts) pushFact(p, shortDetail(sub.body))
      } else {
        pushFact(firstSentence, shortDetail(sub.body))
      }
      if (facts.length >= MAX_FACTS_PER_BRANCH) break
    }
  }

  return facts
}

function addFactBranch(
  nodes: StudyMapNode[],
  edges: StudyMapEdge[],
  branchLabel: string,
  edgeLabel: string,
  mod: DetailedStudyModule,
  facts: { label: string; detail: string }[]
): void {
  if (facts.length === 0) return
  const branchId = `cat:${mod.id}`
  nodes.push({ id: branchId, label: branchLabel, kind: 'category', sourceRefs: mod.sourceRefs })
  edges.push({ id: `e:root->${branchId}`, from: 'root', to: branchId, label: edgeLabel })
  facts.forEach((fact, i) => {
    const id = `${branchId}:f${i}`
    nodes.push({ id, label: fact.label, kind: 'detail', detail: fact.detail, sourceRefs: mod.sourceRefs })
    edges.push({ id: `e:${branchId}->${id}`, from: branchId, to: id })
  })
}

function buildConceptualMap(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[],
  mesh: MeshClassification | undefined
): StudyMap {
  const nodes: StudyMapNode[] = [{ id: 'root', label: concept.name, kind: 'root', sourceRefs: [] }]
  const edges: StudyMapEdge[] = []
  const byId = new Map(modules.map((m) => [m.id, m]))
  const meshSourceRefs: StudyMapSourceRef[] = mesh ? [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }] : []

  // Branch 1 — MeSH's own typed hierarchy (parent + children), each
  // edge carrying MeSH's actual relation name.
  if (mesh?.parentName) {
    const id = 'mesh:parent'
    nodes.push({ id, label: truncateLabel(mesh.parentName, MAX_LABEL_CATEGORY), kind: 'category', sourceRefs: meshSourceRefs })
    edges.push({ id: `e:root->${id}`, from: 'root', to: id, label: RELATIONSHIP_EDGE_LABEL.is_a })
  }
  if (mesh && mesh.childNames.length > 0) {
    const branchId = 'mesh:children'
    nodes.push({ id: branchId, label: 'Related terms', kind: 'category', sourceRefs: meshSourceRefs })
    edges.push({ id: `e:root->${branchId}`, from: 'root', to: branchId, label: RELATIONSHIP_EDGE_LABEL.contains_subtype })
    mesh.childNames.slice(0, MAX_FACTS_PER_BRANCH).forEach((name, i) => {
      const id = `${branchId}:${i}`
      nodes.push({ id, label: truncateLabel(name, MAX_LABEL_DETAIL), kind: 'detail', sourceRefs: meshSourceRefs })
      edges.push({ id: `e:${branchId}->${id}`, from: branchId, to: id })
    })
  }

  // Branch 2 — MeSH's own associated/related-concept links, each kept
  // under its OWN real relation type rather than merged into one
  // generic "Relationships" bucket.
  if (mesh) {
    const byType = new Map<string, typeof mesh.relationships>()
    for (const r of mesh.relationships) {
      if (r.relationshipType !== 'associated_with' && r.relationshipType !== 'related_to') continue
      const list = byType.get(r.relationshipType) ?? []
      list.push(r)
      byType.set(r.relationshipType, list)
    }
    for (const [type, rels] of byType) {
      const branchId = `mesh:${type}`
      const label = type === 'associated_with' ? 'Associated concepts' : 'Related concepts'
      nodes.push({ id: branchId, label, kind: 'category', sourceRefs: meshSourceRefs })
      edges.push({
        id: `e:root->${branchId}`,
        from: 'root',
        to: branchId,
        label: RELATIONSHIP_EDGE_LABEL[type as 'associated_with' | 'related_to']
      })
      rels.slice(0, MAX_FACTS_PER_BRANCH).forEach((r, i) => {
        const id = `${branchId}:${i}`
        nodes.push({ id, label: truncateLabel(r.targetName, MAX_LABEL_DETAIL), kind: 'detail', sourceRefs: [{ sourceName: r.sourceName, sourceUrl: r.sourceUrl }] })
        edges.push({ id: `e:${branchId}->${id}`, from: branchId, to: id })
      })
    }
  }

  // Branch 3 — Structure's key facts ("has structural feature").
  const structureMod = byId.get('structure')
  if (structureMod?.available) {
    addFactBranch(nodes, edges, 'Structure', 'has structural feature', structureMod, extractKeyFacts(structureMod))
  }

  // Branch 4 — Mechanism's key facts ("function").
  const mechanismMod = byId.get('mechanism')
  if (mechanismMod?.available) {
    addFactBranch(nodes, edges, 'Function', 'function', mechanismMod, extractKeyFacts(mechanismMod))
  }

  // Fallback — no MeSH data at all and neither Structure nor Mechanism
  // had extractable facts (a concept Cellfie only knows a Definition
  // for): fall back to the Relationships module's own bullets so the
  // map isn't empty, still with a real relation label per branch.
  if (nodes.length === 1) {
    const relationshipsMod = byId.get('relationships')
    if (relationshipsMod?.available) {
      for (const sub of relationshipsMod.subsections) {
        if (!sub.heading || !sub.bullets) continue
        const branchId = `rel:${sub.id}`
        nodes.push({ id: branchId, label: sub.heading, kind: 'category', sourceRefs: relationshipsMod.sourceRefs })
        edges.push({ id: `e:root->${branchId}`, from: 'root', to: branchId, label: sub.heading.toLowerCase() })
        sub.bullets.slice(0, MAX_FACTS_PER_BRANCH).forEach((b, i) => {
          const id = `${branchId}:${i}`
          nodes.push({ id, label: truncateLabel(b, MAX_LABEL_DETAIL), kind: 'detail', sourceRefs: relationshipsMod.sourceRefs })
          edges.push({ id: `e:${branchId}->${id}`, from: branchId, to: id })
        })
      }
    }
  }

  return { nodes, edges, rootId: 'root', shape: 'conceptual' }
}

/**
 * Entry point. `mesh` is the same already-fetched MeshClassification
 * the Learn tab used for Detailed Study's Classification module —
 * reused, never re-fetched — and is what lets the conceptual map be
 * built from real typed relationships instead of Detailed Study's
 * rendered text. Returns `undefined` when no module has any verified
 * content yet (only `available` modules — see detailedStudy.ts — are
 * considered) — the caller must show an honest empty state, never an
 * empty/placeholder diagram.
 */
export function buildStudyMap(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[],
  mesh?: MeshClassification
): StudyMap | undefined {
  const available = modules.filter((m) => m.available)
  if (available.length === 0) return undefined

  const detected = detectProcedureSteps(available)
  if (detected && detected.steps.length >= 3) {
    return buildProcedureMap(concept, detected.steps, detected.sourceRefs)
  }
  const map = buildConceptualMap(concept, available, mesh)
  return map.nodes.length > 1 ? map : undefined
}
