/**
 * core/concepts/detailedStudy — Learn tab, "Detailed Study" mode.
 *
 * Reference: the five-module structure below (Definition & Biological
 * Scope / Classification & Taxonomic Hierarchy / Structure & Molecular
 * Composition / Biological Mechanism & Function / Important Functional
 * Relationships) is the experience an earlier Google AI Studio
 * prototype of the Concept Hub used. This file reimplements that
 * MODULE STRUCTURE natively against this app's own scientific data
 * layer (core/concepts/onlineKnowledge.ts's PubChem/PubMed/Europe
 * PMC/MeSH tiers) — no code, dependencies, or UI from that prototype
 * are reused here.
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
import type { EuropePmcArticle, MeshClassification, OnlineKnowledgeSection } from './onlineKnowledge'

const UNAVAILABLE_TEXT = 'Verified scientific detail is not available for this section yet.'

export interface DetailedStudySubsection {
  id: string
  /** Omitted for a module with only one, unlabeled subsection (a short source doesn't need a heading repeating the module's own title). */
  heading?: string
  /** A paragraph. A subsection has `body`, `bullets`, or both. */
  body?: string
  bullets?: string[]
}

export interface DetailedStudyModule {
  id: 'definition' | 'classification' | 'structure' | 'mechanism' | 'relationships'
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
  if (mesh.childNames.length > 0) {
    subsections.push({ id: 'classification-children', heading: 'Sub-categories', bullets: mesh.childNames })
  }
  if (mesh.meshUI || mesh.yearIntroduced) {
    subsections.push({
      id: 'classification-code',
      heading: 'MeSH descriptor',
      body: `Code: ${mesh.meshUI ?? 'N/A'}${mesh.yearIntroduced ? `, introduced ${mesh.yearIntroduced}.` : '.'}`
    })
  }
  if (mesh.subheadings.length > 0) {
    subsections.push({
      id: 'classification-subheadings',
      heading: 'Indexing subheadings',
      bullets: mesh.subheadings.slice(0, 6)
    })
  }

  return {
    id: 'classification',
    heading: 'Classification & Taxonomic Hierarchy',
    subsections,
    sourceRefs: [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }],
    available: true
  }
}

/**
 * Module 3 — Structure & Molecular Composition / Principle. Prefers a
 * distinct (not already used in Module 1) PubChem section; otherwise
 * an unused Europe PMC/PubMed excerpt whose text reads as structural/
 * compositional. Heading adapts to "Chemical & Molecular Structure"
 * when the concept resolved to a PubChem compound. Article-sourced
 * content is run through `splitStructuredAbstract` so a labeled source
 * abstract renders as real subsections; PubChem's own description text
 * is never structured (it's already a short, single description).
 */
const STRUCTURE_KEYWORDS = ['structure', 'composition', 'polymer', 'helix', 'backbone', 'wall', 'membrane', 'molecular']

function buildStructureModule(
  sections: OnlineKnowledgeSection[],
  europePmc: EuropePmcArticle[],
  usedExcerpts: Set<string>
): DetailedStudyModule {
  const isPubChemHit = sections.some((s) => s.sourceName.toLowerCase().includes('pubchem'))
  const heading = isPubChemHit ? 'Chemical & Molecular Structure' : 'Structure & Molecular Composition / Principle'

  const pubChemCandidate = sections.find(
    (s) => s.sourceName.toLowerCase().includes('pubchem') && !isUsed(usedExcerpts, s.text)
  )

  let content: string | undefined = pubChemCandidate?.text
  let sourceRefs: { sourceName: string; sourceUrl: string }[] = pubChemCandidate
    ? [{ sourceName: pubChemCandidate.sourceName, sourceUrl: pubChemCandidate.sourceUrl }]
    : []
  let fromArticle = false

  if (!content) {
    const structuralArticle = europePmc.find((a) => {
      const lower = a.abstractText.toLowerCase()
      return STRUCTURE_KEYWORDS.some((k) => lower.includes(k)) && !isUsed(usedExcerpts, a.abstractText)
    })
    if (structuralArticle) {
      content = structuralArticle.abstractText
      sourceRefs = [{ sourceName: structuralArticle.sourceName, sourceUrl: structuralArticle.sourceUrl }]
      fromArticle = true
    }
  }

  markUsed(usedExcerpts, content)

  return {
    id: 'structure',
    heading,
    subsections: content
      ? fromArticle
        ? splitStructuredAbstract(content, 'structure')
        : [{ id: 'structure-0', heading: 'Core principle', body: content }]
      : [{ id: 'structure-0', body: UNAVAILABLE_TEXT }],
    sourceRefs,
    available: Boolean(content)
  }
}

/**
 * Module 4 — Biological Mechanism & Function. The first Europe PMC/
 * PubMed excerpt not already used by Module 1 or Module 3 — this is
 * where the shared `usedExcerpts` set matters most, since without it
 * this module would trivially repeat whichever article Module 3 didn't
 * pick. Split into real subsections when the source abstract itself is
 * structured (§ splitStructuredAbstract); a plain abstract stays one
 * subsection.
 */
function buildMechanismModule(europePmc: EuropePmcArticle[], usedExcerpts: Set<string>): DetailedStudyModule {
  const article = europePmc.find((a) => !isUsed(usedExcerpts, a.abstractText))
  markUsed(usedExcerpts, article?.abstractText)

  return {
    id: 'mechanism',
    heading: 'Biological Mechanism & Function',
    subsections: article ? splitStructuredAbstract(article.abstractText, 'mechanism') : [{ id: 'mechanism-0', body: UNAVAILABLE_TEXT }],
    sourceRefs: article ? [{ sourceName: article.sourceName, sourceUrl: article.sourceUrl }] : [],
    available: Boolean(article)
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
 * Single entry point for the Learn tab's Detailed Study mode. Every
 * argument is data the Learn tab has already fetched for its other
 * content (Quick Revision's `sections`, the MeSH/Europe PMC tiers) —
 * no new network calls, and no read of ConceptRelation (see Module 5's
 * own doc comment for why). Always returns exactly 5 modules, in the
 * fixed order given in this file's header; any module without
 * genuinely distinct source-backed content honestly reports
 * `available: false` rather than duplicating a neighbor.
 */
export function buildDetailedStudyModules(
  concept: Concept,
  sections: OnlineKnowledgeSection[],
  mesh: MeshClassification | undefined,
  europePmc: EuropePmcArticle[]
): DetailedStudyModule[] {
  const usedExcerpts = new Set<string>()

  const definition = buildDefinitionModule(sections, mesh, usedExcerpts)
  const classification = buildClassificationModule(concept, mesh)
  const structure = buildStructureModule(sections, europePmc, usedExcerpts)
  const mechanism = buildMechanismModule(europePmc, usedExcerpts)
  const relationships = buildRelationshipsModule(concept, mesh)

  return [definition, classification, structure, mechanism, relationships]
}
