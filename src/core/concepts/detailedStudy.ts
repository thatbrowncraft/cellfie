/**
 * core/concepts/detailedStudy — Learn tab, core teaching content.
 *
 * Concept 2.0 architecture change §3–§9 — this file used to build five
 * modules including "Structure & Molecular Composition" and
 * "Biological Mechanism & Function" from Europe PMC/PubMed research
 * abstracts, keyword-matched to the concept. That treated research
 * abstracts as textbook chapters, which is exactly what this change
 * removes: research literature is real, valuable content, but it is
 * not a beginner lesson, and a keyword match is not proof of
 * relevance. This file now builds four modules — Definition &
 * Biological Scope / Classification & Taxonomic Hierarchy /
 * Chemical & Molecular Structure / Important Functional Relationships
 * — from sources that are either curated (MeSH) or a real compound
 * description (PubChem). It never falls back to an article excerpt to
 * fill a module. Research articles surface separately, at the bottom
 * of Learn, via researchReadings.ts — title, why it's relevant, and a
 * source link, never the full abstract dressed up as the lesson body.
 *
 * Pure, offline-derivable, no network calls of its own — mirrors
 * examTools.ts's contract exactly: everything passed in has already
 * been fetched by the caller (ConceptDetailPage.tsx) for the Learn
 * tab's other content, so building these five modules costs nothing
 * extra and never blocks the page.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: no module may render text
 * another module already rendered. A shared `usedExcerpts` set is
 * threaded through every module builder below; a module that has
 * nothing left to say that isn't a duplicate falls back to an honest
 * "not available" state instead of repeating a neighbor. Every module
 * that finds no genuinely distinct source-backed content honestly
 * says so — never invented, never padded, never a copy of another
 * module's content.
 *
 * Concept Hub Refinement §2 — each module is now a list of
 * `subsections` rather than one flat paragraph. Subsections are only
 * ever created from data that is ALREADY structured at the source:
 *  - Classification's parent/children/code/subheadings are genuinely
 *    separate MeSH fields, not a paragraph split apart.
 *  - Structure/Mechanism split on real structured-abstract labels
 *    (BACKGROUND/METHODS/RESULTS/CONCLUSION/IMPORTANCE/etc.) ONLY when
 *    the source text itself already contains that structure — see
 *    `splitStructuredAbstract`. A plain, unlabeled abstract stays as
 *    ONE subsection; this file never chops a paragraph at arbitrary
 *    sentence boundaries to manufacture the appearance of structure.
 *  - Relationships splits its bullets into "Type hierarchy" vs.
 *    "Associated concepts" because MeSH itself returns those as
 *    distinct relationship-type categories, not because two lists
 *    look busier than one.
 *
 * Concept Hub Refinement §4/§15 — Module 5 ("Important Functional
 * Relationships") is now sourced from MeSH data ONLY, never from a
 * stored ConceptRelation row. Scientific relationship data may inform
 * Detailed Study; it must never be read back out of the same table
 * that powers Connections/Mind Map, or the separation those features
 * depend on stops being real.
 */

import type { Concept } from '../db'
import type { MeshClassification, OnlineKnowledgeSection } from './onlineKnowledge'

const UNAVAILABLE_TEXT = 'Verified scientific detail is not available for this section yet.'

// ---------------------------------------------------------------------
// MeSH indexing subheadings are a FIXED, standardized vocabulary
// (~80 terms defined by NLM) — ranking them by general educational
// relevance is therefore a generic, concept-agnostic operation, not a
// per-concept special case. Subheadings like "genetics" or "chemistry"
// describe a facet of biology worth knowing about any concept;
// subheadings like "economics" or "legislation and jurisprudence"
// describe database/administrative facets that read as noise in a
// foundational lesson. Anything not listed here (an uncommon
// subheading Cellfie hasn't seen before) gets a neutral middle rank
// rather than being silently dropped.
// ---------------------------------------------------------------------
const MESH_SUBHEADING_EDUCATIONAL_RANK: Record<string, number> = {
  genetics: 3,
  physiology: 3,
  chemistry: 3,
  metabolism: 3,
  biosynthesis: 3,
  classification: 3,
  ultrastructure: 3,
  'growth and development': 3,
  cytology: 3,
  'growth & development': 3,
  immunology: 2,
  microbiology: 2,
  pathology: 2,
  analysis: 2,
  isolation: 2,
  'isolation and purification': 2,
  enzymology: 2,
  virology: 2,
  anatomy: 2,
  'drug effects': 1,
  'radiation effects': 1,
  diagnosis: 1,
  therapy: 1,
  prevention: 1,
  'prevention and control': 1,
  epidemiology: 1,
  administration: -2,
  'administration and dosage': -2,
  'adverse effects': -2,
  poisoning: -2,
  'therapeutic use': -2,
  economics: -3,
  'legislation and jurisprudence': -3,
  'supply and distribution': -3,
  standards: -1,
  trends: -1,
  statistics: -1,
  'statistics and numerical data': -1,
  history: -1,
  ethics: -2,
  legislation: -3
}

function meshSubheadingRank(subheading: string): number {
  return MESH_SUBHEADING_EDUCATIONAL_RANK[subheading.trim().toLowerCase()] ?? 0
}

/** Sorts subheadings by general educational relevance (highest first) and drops the clearly administrative/regulatory ones entirely rather than presenting them as if they were part of the concept's biology. */
function selectEducationalSubheadings(subheadings: string[], max: number): string[] {
  return [...subheadings]
    .filter((s) => meshSubheadingRank(s) > -2)
    .sort((a, b) => meshSubheadingRank(b) - meshSubheadingRank(a))
    .slice(0, max)
}

export interface DetailedStudySubsection {
  id: string
  /** Omitted for a module with only one, unlabeled subsection (a short source doesn't need a heading repeating the module's own title). */
  heading?: string
  /** A paragraph. A subsection has `body`, `bullets`, or both. */
  body?: string
  bullets?: string[]
}

export interface DetailedStudyModule {
  id: 'definition' | 'classification' | 'structure' | 'relationships'
  heading: string
  subsections: DetailedStudySubsection[]
  sourceRefs: { sourceName: string; sourceUrl: string }[]
  available: boolean
}

/** Normalizes text for the cross-module duplicate check — case/whitespace-insensitive so near-identical excerpts (a trailing space, a re-fetched copy) are still caught. */
function dedupeKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function markUsed(usedExcerpts: Set<string>, text: string | undefined): void {
  if (text) usedExcerpts.add(dedupeKey(text))
}

function isUsed(usedExcerpts: Set<string>, text: string | undefined): boolean {
  return Boolean(text) && usedExcerpts.has(dedupeKey(text as string))
}

// Real structured-abstract section labels, as biomedical journals and
// Europe PMC/PubMed actually write them (see e.g. a JAMA-style
// abstract's own "IMPORTANCE" / "OBJECTIVE" / "METHODS" / "RESULTS" /
// "CONCLUSION" labels). Matched case-sensitively, ALL CAPS, as whole
// words — the exact pattern a real structured abstract uses and an
// ordinary sentence essentially never does by chance.
const ABSTRACT_LABELS = [
  'IMPORTANCE',
  'BACKGROUND',
  'OBJECTIVES',
  'OBJECTIVE',
  'AIMS',
  'AIM',
  'PURPOSE',
  'MATERIALS AND METHODS',
  'METHODS',
  'DESIGN',
  'SETTING',
  'PARTICIPANTS',
  'PATIENTS',
  'INTERVENTIONS',
  'INTERVENTION',
  'MAIN OUTCOME MEASURES',
  'MAIN OUTCOME MEASURE',
  'RESULTS',
  'FINDINGS',
  'DISCUSSION',
  'INTERPRETATION',
  'SIGNIFICANCE',
  'CONCLUSIONS',
  'CONCLUSION'
]
// Longest-first so "MATERIALS AND METHODS" matches before "METHODS" does.
const LABEL_PATTERN = new RegExp(
  `(?:^|[\\s.])(${[...ABSTRACT_LABELS].sort((a, b) => b.length - a.length).join('|')}):?\\s*`,
  'g'
)

/**
 * Splits real structured-abstract text into labeled subsections ONLY
 * when the text itself already contains at least two recognized labels
 * (a single incidental match — e.g. a sentence that happens to start
 * "Results show..." — isn't treated as structure). Label text is
 * title-cased for display ("Importance", not "IMPORTANCE"); body text
 * is exactly the source's own words between labels, never reworded.
 * Text with fewer than two labels comes back as one unlabeled
 * subsection — the honest "this source is just a paragraph" case.
 */
function splitStructuredAbstract(text: string, idPrefix: string): DetailedStudySubsection[] {
  const matches = [...text.matchAll(LABEL_PATTERN)]
  if (matches.length < 2) {
    return [{ id: `${idPrefix}-0`, body: text }]
  }

  const subsections: DetailedStudySubsection[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const label = match[1]
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const body = text.slice(start, end).trim()
    if (!body) continue
    const heading = label
      .toLowerCase()
      .split(' ')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
    subsections.push({ id: `${idPrefix}-${i}`, heading, body })
  }
  return subsections.length > 0 ? subsections : [{ id: `${idPrefix}-0`, body: text }]
}

/**
 * Module 1 — Definition & Biological Scope. Priority: MeSH's own scope
 * note (an authoritative, curated definition) first, since that's
 * exactly what MeSH scope notes are for; otherwise the strongest
 * `onlineSections` entry (PubChem description or PubMed abstract). A
 * short source stays a single short subsection — no forced splitting.
 */
function buildDefinitionModule(
  sections: OnlineKnowledgeSection[],
  mesh: MeshClassification | undefined,
  usedExcerpts: Set<string>
): DetailedStudyModule {
  const meshText = mesh?.scopeNote?.trim()
  const fallbackSection = sections[0]

  const content = meshText || fallbackSection?.text
  const sourceRefs = meshText
    ? [{ sourceName: mesh!.sourceName, sourceUrl: mesh!.sourceUrl }]
    : fallbackSection
      ? [{ sourceName: fallbackSection.sourceName, sourceUrl: fallbackSection.sourceUrl }]
      : []

  markUsed(usedExcerpts, content)

  return {
    id: 'definition',
    heading: 'Definition & Biological Scope',
    subsections: content ? splitStructuredAbstract(content, 'definition') : [{ id: 'definition-0', body: UNAVAILABLE_TEXT }],
    sourceRefs,
    available: Boolean(content)
  }
}

/**
 * Module 2 — Classification & Taxonomic Hierarchy. Built ONLY from
 * MeSH data (parent descriptor, sub-descriptors, MeSH UI code/year,
 * indexing subheadings) — this is the one module with no fallback to
 * the general online-knowledge sections, because a definition excerpt
 * repurposed as "classification" would be exactly the duplication this
 * file exists to prevent. Concepts with no MeSH descriptor honestly
 * show unavailable here rather than reusing the definition text. Each
 * MeSH field below is a genuinely separate piece of data, not a
 * paragraph split apart — a natural fit for real subsections.
 */
function buildClassificationModule(concept: Concept, mesh: MeshClassification | undefined): DetailedStudyModule {
  if (!mesh || (!mesh.parentName && mesh.childNames.length === 0 && !mesh.meshUI)) {
    return {
      id: 'classification',
      heading: 'Classification & Taxonomic Hierarchy',
      subsections: [{ id: 'classification-0', body: UNAVAILABLE_TEXT }],
      sourceRefs: [],
      available: false
    }
  }

  const subsections: DetailedStudySubsection[] = []
  if (mesh.parentName) {
    subsections.push({
      id: 'classification-parent',
      heading: 'Parent category',
      body: `${concept.name} is classified under the parent descriptor "${mesh.parentName}" in the NCBI Medical Subject Headings (MeSH) hierarchy.`
    })
  }
  // §MeSH's role — child descriptors are the standardized vocabulary's
  // own sub-entries, not automatically the biological classification a
  // student needs to memorize (a term like "DNA, A-Form" is a real
  // MeSH descriptor but not foundational teaching content). Capped
  // tighter than before and framed as terminology, not as the lesson.
  if (mesh.childNames.length > 0) {
    subsections.push({
      id: 'classification-children',
      heading: 'Related MeSH terms',
      body: 'Standardized terminology related to this concept in the MeSH vocabulary — useful for recognizing terms, not a list to memorize as biology.',
      bullets: mesh.childNames.slice(0, 4)
    })
  }
  if (mesh.meshUI || mesh.yearIntroduced) {
    subsections.push({
      id: 'classification-code',
      heading: 'MeSH descriptor',
      body: `Code: ${mesh.meshUI ?? 'N/A'}${mesh.yearIntroduced ? `, introduced ${mesh.yearIntroduced}.` : '.'} Provided for terminology/provenance, not as educational content in itself.`
    })
  }
  const educationalSubheadings = selectEducationalSubheadings(mesh.subheadings, 4)
  if (educationalSubheadings.length > 0) {
    subsections.push({
      id: 'classification-subheadings',
      heading: 'Facets commonly studied',
      body: 'Aspects of this concept indexed in the biomedical literature (e.g. genetics, physiology, chemistry) — a map of what to study next, not a definition.',
      bullets: educationalSubheadings
    })
  }

  return {
    id: 'classification',
    heading: 'Classification & Taxonomic Hierarchy',
    subsections,
    sourceRefs: [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }],
    available: subsections.length > 0
  }
}

/**
 * Module 3 — Structure & Molecular Composition / Principle. Concept 2.0
 * architecture change §3/§9 — this module used to fall back to a
 * keyword-matched Europe PMC/PubMed excerpt when there was no PubChem
 * hit, which is exactly the bug that let an unrelated research
 * abstract stand in as a concept's foundational "structure" lesson
 * (relevance was keyword-level, not concept-level). It no longer has
 * that fallback: Structure is built ONLY from a real PubChem
 * compound description. A concept with no PubChem hit (most
 * non-molecule concepts — techniques, processes, organisms) honestly
 * reports unavailable here rather than repurposing a research
 * abstract. Research literature still surfaces for every concept, but
 * only in "Research & Further Reading" (see researchReadings.ts),
 * clearly labeled as literature rather than disguised as a lesson.
 */
function buildStructureModule(sections: OnlineKnowledgeSection[], usedExcerpts: Set<string>): DetailedStudyModule {
  const pubChemCandidate = sections.find(
    (s) => s.sourceName.toLowerCase().includes('pubchem') && !isUsed(usedExcerpts, s.text)
  )

  const content = pubChemCandidate?.text
  const sourceRefs = pubChemCandidate ? [{ sourceName: pubChemCandidate.sourceName, sourceUrl: pubChemCandidate.sourceUrl }] : []

  markUsed(usedExcerpts, content)

  return {
    id: 'structure',
    heading: 'Chemical & Molecular Structure',
    subsections: content ? [{ id: 'structure-0', heading: 'Core principle', body: content }] : [{ id: 'structure-0', body: UNAVAILABLE_TEXT }],
    sourceRefs,
    available: Boolean(content)
  }
}

/**
 * Module 5 — Important Functional Relationships. Sourced from MeSH
 * relationship data ONLY (Concept Hub Refinement §4/§15) — never from
 * a stored ConceptRelation row, since that table belongs exclusively
 * to Connections/Mind Map now. Split into "Type hierarchy" (is_a/
 * contains_subtype — MeSH's own taxonomic relations) vs. "Associated
 * concepts" (associated_with/related_to — MeSH's own non-taxonomic
 * relations) because MeSH itself returns those as distinct categories.
 */
function buildRelationshipsModule(concept: Concept, mesh: MeshClassification | undefined): DetailedStudyModule {
  const relationships = mesh?.relationships ?? []
  if (relationships.length === 0) {
    return {
      id: 'relationships',
      heading: 'Important Functional Relationships',
      subsections: [{ id: 'relationships-0', body: UNAVAILABLE_TEXT }],
      sourceRefs: [],
      available: false
    }
  }

  const hierarchy = relationships.filter((r) => r.relationshipType === 'is_a' || r.relationshipType === 'contains_subtype')
  const associated = relationships.filter((r) => r.relationshipType === 'associated_with' || r.relationshipType === 'related_to')

  const subsections: DetailedStudySubsection[] = []
  if (hierarchy.length > 0) {
    subsections.push({
      id: 'relationships-hierarchy',
      heading: 'Type hierarchy',
      bullets: hierarchy.slice(0, 5).map((r) => `${r.targetName} (${r.relationshipType.replace(/_/g, ' ')})`)
    })
  }
  if (associated.length > 0) {
    subsections.push({
      id: 'relationships-associated',
      heading: 'Associated concepts',
      bullets: associated.slice(0, 5).map((r) => `${r.targetName} (${r.relationshipType.replace(/_/g, ' ')})`)
    })
  }

  const sourceRefs: { sourceName: string; sourceUrl: string }[] = []
  const seenUrls = new Set<string>()
  for (const r of relationships) {
    if (seenUrls.has(r.sourceUrl)) continue
    seenUrls.add(r.sourceUrl)
    sourceRefs.push({ sourceName: r.sourceName, sourceUrl: r.sourceUrl })
    if (sourceRefs.length >= 3) break
  }

  return {
    id: 'relationships',
    heading: 'Important Functional Relationships',
    subsections: subsections.length > 0 ? subsections : [{ id: 'relationships-0', body: `No verified relationships found for ${concept.name} yet.` }],
    sourceRefs,
    available: subsections.length > 0
  }
}

/**
 * Single entry point for the Learn tab's Core Concept content. Every
 * argument is data the Learn tab has already fetched for its other
 * content (Quick Revision's `sections`, the MeSH tier) — no new
 * network calls, and no read of ConceptRelation (see Module 4's own
 * doc comment for why). Always returns exactly 4 modules, in the fixed
 * order given in this file's header; any module without genuinely
 * distinct source-backed content honestly reports `available: false`
 * rather than duplicating a neighbor or borrowing an unrelated
 * research abstract. `classification` and `relationships` are MeSH-only
 * and are rendered by the Learn tab as secondary/collapsible
 * "Scientific metadata" — see ConceptDetailPage.tsx.
 */
export function buildDetailedStudyModules(
  concept: Concept,
  sections: OnlineKnowledgeSection[],
  mesh: MeshClassification | undefined
): DetailedStudyModule[] {
  const usedExcerpts = new Set<string>()

  const definition = buildDefinitionModule(sections, mesh, usedExcerpts)
  const classification = buildClassificationModule(concept, mesh)
  const structure = buildStructureModule(sections, usedExcerpts)
  const relationships = buildRelationshipsModule(concept, mesh)

  return [definition, classification, structure, relationships]
}
