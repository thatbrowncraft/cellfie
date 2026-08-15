/**
 * core/concepts/generatedVisual — Visuals tab, native-illustration
 * generator.
 *
 * NOT the Study Map (studyMap.ts). Mind Map shows RELATIONSHIPS between
 * ideas (concept ↔ concept, edge-labeled). Visuals answers a different
 * question: "what would help a student SEE this concept?" — a process
 * flow, a labeled structure, a side-by-side comparison, or a
 * cause→process→outcome mechanism, depending on what kind of thing the
 * concept actually is. The two features never render the same shape
 * for the same concept, and a visual is never a flowchart re-rendered
 * in a smaller box.
 *
 * VISUAL TYPE is chosen from the concept's own verified data — never
 * hardcoded per concept name. Priority (first match wins, since a
 * concept can technically qualify for more than one):
 *
 *   1. PROCESS      — the concept IS a procedure (same detection Mind
 *                      Map's procedure flow uses, studyMap.ts). Steps
 *                      are additionally tagged with a short ROLE where
 *                      the source text states one ("acts as a primary
 *                      stain"), so the diagram answers "what does this
 *                      step DO", not just "what comes next".
 *   2. STRUCTURE     — the concept has real compositional/categorical
 *                      parts (Structure, then Classification) — a
 *                      labeled hub-and-parts figure. Checked before
 *                      Comparison/Mechanism so a concept that's
 *                      fundamentally a structure (DNA, a cell wall...)
 *                      doesn't get diverted into a mechanism figure
 *                      just because its source abstract happens to use
 *                      structured Background/Methods/Results headings.
 *   3. COMPARISON    — the concept's own verified data names two
 *                      genuinely contrasting categories (a generic
 *                      antonym-pair vocabulary — positive/negative,
 *                      aerobic/anaerobic, etc. — not anything specific
 *                      to one concept), each with its own supporting
 *                      points drawn from the source text.
 *   4. MECHANISM     — the Mechanism module's own source text is a
 *                      REAL structured abstract (Background/Methods/
 *                      Results style labels the source itself used —
 *                      see detailedStudy.ts's splitStructuredAbstract)
 *                      with at least two of cause/process/outcome
 *                      genuinely present.
 *   5. HIERARCHY     — MeSH's own parent/child data, nothing else
 *                      qualified — a simple parent → concept → children
 *                      tree.
 *   6. CONCEPT-MAP   — last resort: MeSH's associated/related concepts
 *                      as a flat radial figure (distinct from Mind
 *                      Map's branching tree — flat, no hierarchy).
 *
 * No AI, no invented parts: every label/detail below is a direct
 * excerpt (or a short truncation of one) already present in a
 * `DetailedStudyModule` or `MeshClassification` built from real MeSH/
 * PubChem/PubMed/Europe PMC data. A concept with nothing usable
 * anywhere returns `undefined` — the caller shows the "Import custom
 * visual / PDF" empty state, never a fabricated figure.
 */

import type { Concept } from '../db'
import type { DetailedStudyModule } from './detailedStudy'
import type { MeshClassification } from './onlineKnowledge'
import { detectProcedureSteps, extractRole, splitIntoSentences } from './studyMap'

export type GeneratedVisualKind = 'process' | 'structure' | 'comparison' | 'mechanism' | 'hierarchy' | 'concept-map'

export interface VisualSourceRef {
  sourceName: string
  sourceUrl: string
}

export interface GeneratedVisualPart {
  id: string
  label: string
  detail: string
  /** Only set for 'process' parts where the source text states what the step's purpose/role is (e.g. "Primary stain"). */
  role?: string
  sourceRefs: VisualSourceRef[]
}

export interface ComparisonPoint {
  label: string
  detail: string
}

export interface GeneratedVisualComparison {
  leftTitle: string
  rightTitle: string
  leftPoints: ComparisonPoint[]
  rightPoints: ComparisonPoint[]
}

export interface GeneratedVisualMechanism {
  cause?: GeneratedVisualPart
  process?: GeneratedVisualPart
  outcome?: GeneratedVisualPart
}

export interface GeneratedVisualHierarchy {
  parentLabel?: string
  children: GeneratedVisualPart[]
}

export interface GeneratedVisual {
  kind: GeneratedVisualKind
  title: string
  /** A short label describing what kind of diagram this is, shown in the UI (e.g. "Procedural flow", "Structural overview"). */
  subtitle: string
  /** Populated for 'process', 'structure', and 'concept-map' kinds — an ordered (process) or unordered (structure/concept-map) list of parts. */
  parts?: GeneratedVisualPart[]
  comparison?: GeneratedVisualComparison
  mechanism?: GeneratedVisualMechanism
  hierarchy?: GeneratedVisualHierarchy
  sourceRefs: VisualSourceRef[]
}

const MAX_PARTS = 8
const MAX_LABEL = 44

function truncateLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= MAX_LABEL) return trimmed
  return `${trimmed.slice(0, MAX_LABEL - 1).trimEnd()}…`
}

function shortDetail(text: string): string {
  const sentences = splitIntoSentences(text)
  let out = sentences[0] ?? text
  if (sentences.length > 1 && out.length < 90) out = `${out} ${sentences[1]}`
  return out.length > 220 ? `${out.slice(0, 219).trimEnd()}…` : out
}

// ---------------------------------------------------------------------
// 1. PROCESS
// ---------------------------------------------------------------------

function buildProcessVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[]
): GeneratedVisual | undefined {
  const detected = detectProcedureSteps(modules)
  if (!detected || detected.steps.length < 3) return undefined

  const sourceRefs = detected.sourceRefs
  const parts: GeneratedVisualPart[] = detected.steps.slice(0, MAX_PARTS).map((step, i) => ({
    id: `step:${i}`,
    label: truncateLabel(step.detail),
    detail: shortDetail(step.detail),
    role: extractRole(step.detail),
    sourceRefs
  }))

  return {
    kind: 'process',
    title: concept.name,
    subtitle: 'Procedural flow',
    parts,
    sourceRefs
  }
}

// ---------------------------------------------------------------------
// 2. COMPARISON
//
// A generic (not concept-specific) vocabulary of contrastive modifier
// pairs — the same kind of word-pair that shows up across many
// microbiology/biology topics, not anything unique to one concept.
// ---------------------------------------------------------------------

const CONTRAST_PAIRS: [string, string][] = [
  ['gram-positive', 'gram-negative'],
  ['positive', 'negative'],
  ['aerobic', 'anaerobic'],
  ['prokaryotic', 'eukaryotic'],
  ['acidic', 'basic'],
  ['acid-fast', 'non-acid-fast'],
  ['motile', 'non-motile'],
  ['pathogenic', 'non-pathogenic'],
  ['soluble', 'insoluble'],
  ['hydrophilic', 'hydrophobic'],
  ['sense', 'antisense'],
  ['coding', 'non-coding']
]

function collectCandidateStrings(modules: DetailedStudyModule[], mesh: MeshClassification | undefined): string[] {
  const out: string[] = []
  if (mesh) {
    out.push(...mesh.childNames)
    for (const r of mesh.relationships) out.push(r.targetName)
  }
  for (const mod of modules) {
    for (const sub of mod.subsections) {
      if (sub.heading) out.push(sub.heading)
      if (sub.body) out.push(...splitIntoSentences(sub.body))
      if (sub.bullets) out.push(...sub.bullets)
    }
  }
  return out
}

function buildComparisonVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[],
  mesh: MeshClassification | undefined
): GeneratedVisual | undefined {
  const candidates = collectCandidateStrings(modules, mesh)
  if (candidates.length === 0) return undefined

  for (const [a, b] of CONTRAST_PAIRS) {
    const termA = candidates.find((c) => c.toLowerCase().includes(a))
    const termB = candidates.find((c) => c.toLowerCase().includes(b))
    if (!termA || !termB) continue

    const leftPoints = candidates
      .filter((c) => c.toLowerCase().includes(a) && c !== termA && c.length <= 160)
      .slice(0, 4)
      .map((c) => ({ label: truncateLabel(c), detail: c }))
    const rightPoints = candidates
      .filter((c) => c.toLowerCase().includes(b) && c !== termB && c.length <= 160)
      .slice(0, 4)
      .map((c) => ({ label: truncateLabel(c), detail: c }))

    // Need at least the two headline terms plus one supporting point on
    // either side combined, or this isn't a real comparison — just a
    // single incidental mention of both words somewhere in the text.
    if (leftPoints.length === 0 && rightPoints.length === 0) continue

    const sourceRefs: VisualSourceRef[] = mesh ? [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }] : []
    for (const mod of modules) for (const ref of mod.sourceRefs) sourceRefs.push(ref)

    return {
      kind: 'comparison',
      title: concept.name,
      subtitle: 'Comparison',
      comparison: {
        leftTitle: truncateLabel(termA),
        rightTitle: truncateLabel(termB),
        leftPoints: leftPoints.length > 0 ? leftPoints : [{ label: truncateLabel(termA), detail: termA }],
        rightPoints: rightPoints.length > 0 ? rightPoints : [{ label: truncateLabel(termB), detail: termB }]
      },
      sourceRefs: dedupeSourceRefs(sourceRefs)
    }
  }
  return undefined
}

// ---------------------------------------------------------------------
// 3. MECHANISM — cause → process → outcome, built ONLY when the
// Mechanism module's own source text is a real structured abstract
// (see detailedStudy.ts's splitStructuredAbstract) — never inferred
// from a plain paragraph, which would be inventing structure the
// source doesn't have.
// ---------------------------------------------------------------------

const CAUSE_HEADINGS = /^(background|importance|objective|objectives|aim|aims|purpose)$/i
const PROCESS_HEADINGS = /^(methods|materials and methods|design|intervention|interventions)$/i
const OUTCOME_HEADINGS = /^(results|findings|discussion|interpretation|conclusion|conclusions|significance)$/i

function buildMechanismVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[]
): GeneratedVisual | undefined {
  const mechanismMod = modules.find((m) => m.id === 'mechanism')
  if (!mechanismMod?.available) return undefined
  const labeled = mechanismMod.subsections.filter((s) => s.heading)
  if (labeled.length < 2) return undefined

  const toPart = (id: string, text: string | undefined): GeneratedVisualPart | undefined =>
    text ? { id, label: truncateLabel(text), detail: shortDetail(text), sourceRefs: mechanismMod.sourceRefs } : undefined

  const cause = labeled.find((s) => s.heading && CAUSE_HEADINGS.test(s.heading))
  const process = labeled.find((s) => s.heading && PROCESS_HEADINGS.test(s.heading))
  const outcome = labeled.find((s) => s.heading && OUTCOME_HEADINGS.test(s.heading))

  const mechanism: GeneratedVisualMechanism = {
    cause: toPart('cause', cause?.body),
    process: toPart('process', process?.body),
    outcome: toPart('outcome', outcome?.body)
  }
  const stagesPresent = [mechanism.cause, mechanism.process, mechanism.outcome].filter(Boolean).length
  if (stagesPresent < 2) return undefined

  return {
    kind: 'mechanism',
    title: concept.name,
    subtitle: 'Mechanism',
    mechanism,
    sourceRefs: mechanismMod.sourceRefs
  }
}

// ---------------------------------------------------------------------
// 4. STRUCTURE — a labeled hub-and-parts figure. Prefers Structure,
// then Classification, mirroring which modules actually name discrete
// "parts" worth drawing.
// ---------------------------------------------------------------------

const PART_MODULE_PRIORITY: DetailedStudyModule['id'][] = ['structure', 'classification', 'mechanism']

function buildStructureVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[]
): GeneratedVisual | undefined {
  const byId = new Map(modules.map((m) => [m.id, m]))
  const parts: GeneratedVisualPart[] = []
  const usedTexts = new Set<string>()
  const sourceRefs: VisualSourceRef[] = []

  for (const modId of PART_MODULE_PRIORITY) {
    const mod = byId.get(modId)
    if (!mod?.available) continue

    for (const sub of mod.subsections) {
      if (parts.length >= MAX_PARTS) break
      for (const bullet of sub.bullets ?? []) {
        if (parts.length >= MAX_PARTS) break
        const key = bullet.trim().toLowerCase()
        if (usedTexts.has(key)) continue
        usedTexts.add(key)
        parts.push({ id: `part:${parts.length}`, label: truncateLabel(bullet), detail: bullet, sourceRefs: mod.sourceRefs })
      }
      if (parts.length < MAX_PARTS && sub.heading && sub.body) {
        const key = sub.body.trim().toLowerCase()
        if (!usedTexts.has(key)) {
          usedTexts.add(key)
          parts.push({ id: `part:${parts.length}`, label: truncateLabel(sub.heading), detail: shortDetail(sub.body), sourceRefs: mod.sourceRefs })
        }
      }
    }
    for (const ref of mod.sourceRefs) sourceRefs.push(ref)
    if (parts.length >= 2 && modId === 'structure') break
  }

  if (parts.length < 2) return undefined

  return {
    kind: 'structure',
    title: concept.name,
    subtitle: 'Structural overview',
    parts,
    sourceRefs: dedupeSourceRefs(sourceRefs)
  }
}

// ---------------------------------------------------------------------
// 5. HIERARCHY — MeSH's own parent/child data as a simple tree.
// ---------------------------------------------------------------------

function buildHierarchyVisual(
  concept: Pick<Concept, 'name'>,
  mesh: MeshClassification | undefined
): GeneratedVisual | undefined {
  if (!mesh || (!mesh.parentName && mesh.childNames.length === 0)) return undefined
  const sourceRefs: VisualSourceRef[] = [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }]
  const children: GeneratedVisualPart[] = mesh.childNames.slice(0, MAX_PARTS).map((name, i) => ({
    id: `child:${i}`,
    label: truncateLabel(name),
    detail: name,
    sourceRefs
  }))
  if (children.length === 0 && !mesh.parentName) return undefined

  return {
    kind: 'hierarchy',
    title: concept.name,
    subtitle: 'Classification hierarchy',
    hierarchy: { parentLabel: mesh.parentName, children },
    sourceRefs
  }
}

// ---------------------------------------------------------------------
// 6. CONCEPT-MAP — last resort, MeSH's associated/related concepts as
// a flat radial figure. Deliberately flat (no hierarchy, no edge
// labels) so it still reads as visually distinct from Mind Map's
// branching, labeled-edge relationship graph.
// ---------------------------------------------------------------------

function buildFallbackConceptMapVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[]
): GeneratedVisual | undefined {
  const relationshipsMod = modules.find((m) => m.id === 'relationships')
  if (!relationshipsMod?.available) return undefined

  const parts: GeneratedVisualPart[] = []
  for (const sub of relationshipsMod.subsections) {
    for (const b of sub.bullets ?? []) {
      if (parts.length >= MAX_PARTS) break
      parts.push({ id: `rel:${parts.length}`, label: truncateLabel(b), detail: b, sourceRefs: relationshipsMod.sourceRefs })
    }
    if (parts.length >= MAX_PARTS) break
  }
  if (parts.length < 2) return undefined

  return {
    kind: 'concept-map',
    title: concept.name,
    subtitle: 'Associated concepts',
    parts,
    sourceRefs: relationshipsMod.sourceRefs
  }
}

function dedupeSourceRefs(refs: VisualSourceRef[]): VisualSourceRef[] {
  const seen = new Set<string>()
  const out: VisualSourceRef[] = []
  for (const r of refs) {
    if (seen.has(r.sourceUrl)) continue
    seen.add(r.sourceUrl)
    out.push(r)
  }
  return out
}

/**
 * Entry point. Tries each visual type in priority order (see this
 * file's header) and returns the first that finds genuinely usable
 * data — never forces a type the data doesn't support, and never
 * falls back to inventing content. `mesh` is the same already-fetched
 * MeshClassification Detailed Study's Classification module used —
 * reused, never re-fetched.
 */
export function buildGeneratedVisual(
  concept: Pick<Concept, 'name'>,
  modules: DetailedStudyModule[],
  mesh?: MeshClassification
): GeneratedVisual | undefined {
  return (
    buildProcessVisual(concept, modules) ??
    buildStructureVisual(concept, modules) ??
    buildComparisonVisual(concept, modules, mesh) ??
    buildMechanismVisual(concept, modules) ??
    buildHierarchyVisual(concept, mesh) ??
    buildFallbackConceptMapVisual(concept, modules)
  )
}
