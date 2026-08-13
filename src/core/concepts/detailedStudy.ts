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
 */

import type { Concept, ConceptRelation } from '../db'
import type { OnlineKnowledgeSection } from './onlineKnowledge'
import type { EuropePmcArticle, MeshClassification } from './onlineKnowledge'

const UNAVAILABLE_TEXT = 'Verified scientific detail is not available for this section yet.'

export interface DetailedStudyModule {
  id: 'definition' | 'classification' | 'structure' | 'mechanism' | 'relationships'
  heading: string
  /** UNAVAILABLE_TEXT when nothing genuinely distinct was found for this module — never invented, never a duplicate of another module. */
  content: string
  keyFacts: string[]
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

/**
 * Module 1 — Definition & Biological Scope. Priority: MeSH's own scope
 * note (an authoritative, curated definition) first, since that's
 * exactly what MeSH scope notes are for; otherwise the strongest
 * `onlineSections` entry (PubChem description or PubMed abstract).
 */
function buildDefinitionModule(
  concept: Concept,
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
    content: content || UNAVAILABLE_TEXT,
    keyFacts: content ? [`Primary definition for ${concept.name}.`] : [],
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
 * show unavailable here rather than reusing the definition text.
 */
function buildClassificationModule(concept: Concept, mesh: MeshClassification | undefined): DetailedStudyModule {
  if (!mesh || (!mesh.parentName && mesh.childNames.length === 0 && !mesh.meshUI)) {
    return {
      id: 'classification',
      heading: 'Classification & Taxonomic Hierarchy',
      content: UNAVAILABLE_TEXT,
      keyFacts: [],
      sourceRefs: [],
      available: false
    }
  }

  const parts: string[] = []
  if (mesh.parentName) {
    parts.push(
      `${concept.name} is classified under the parent descriptor "${mesh.parentName}" in the NCBI Medical Subject Headings (MeSH) hierarchy.`
    )
  }
  if (mesh.childNames.length > 0) {
    parts.push(`Identified sub-categories include: ${mesh.childNames.join(', ')}.`)
  }
  if (mesh.meshUI || mesh.yearIntroduced) {
    parts.push(
      `MeSH descriptor code: ${mesh.meshUI ?? 'N/A'}${mesh.yearIntroduced ? ` (introduced ${mesh.yearIntroduced}).` : '.'}`
    )
  }
  if (mesh.subheadings.length > 0) {
    parts.push(`Indexing subheadings: ${mesh.subheadings.slice(0, 6).join(', ')}.`)
  }

  return {
    id: 'classification',
    heading: 'Classification & Taxonomic Hierarchy',
    content: parts.join(' '),
    keyFacts: mesh.parentName ? [`Parent category: ${mesh.parentName}`] : [],
    sourceRefs: [{ sourceName: mesh.sourceName, sourceUrl: mesh.sourceUrl }],
    available: true
  }
}

/**
 * Module 3 — Structure & Molecular Composition / Principle. Prefers a
 * distinct (not already used in Module 1) Europe PMC/PubMed excerpt
 * whose text reads as structural/compositional; otherwise a PubChem
 * section not already used. Heading adapts to "Chemical & Molecular
 * Structure" when the concept resolved to a PubChem compound, since
 * that's a more accurate label than the generic default.
 */
const STRUCTURE_KEYWORDS = ['structure', 'composition', 'polymer', 'helix', 'backbone', 'wall', 'membrane', 'molecular']

function buildStructureModule(
  sections: OnlineKnowledgeSection[],
  europePmc: EuropePmcArticle[],
  usedExcerpts: Set<string>
): DetailedStudyModule {
  const isPubChemHit = sections.some((s) => s.sourceName.toLowerCase().includes('pubchem'))
  const heading = isPubChemHit ? 'Chemical & Molecular Structure' : 'Structure & Molecular Composition / Principle'

  // Prefer an unused PubChem section first (it's the most structurally precise source available).
  const pubChemCandidate = sections.find(
    (s) => s.sourceName.toLowerCase().includes('pubchem') && !isUsed(usedExcerpts, s.text)
  )

  let content: string | undefined = pubChemCandidate?.text
  let sourceRefs: { sourceName: string; sourceUrl: string }[] = pubChemCandidate
    ? [{ sourceName: pubChemCandidate.sourceName, sourceUrl: pubChemCandidate.sourceUrl }]
    : []

  if (!content) {
    const structuralArticle = europePmc.find((a) => {
      const lower = a.abstractText.toLowerCase()
      return STRUCTURE_KEYWORDS.some((k) => lower.includes(k)) && !isUsed(usedExcerpts, a.abstractText)
    })
    if (structuralArticle) {
      content = structuralArticle.abstractText
      sourceRefs = [{ sourceName: structuralArticle.sourceName, sourceUrl: structuralArticle.sourceUrl }]
    }
  }

  markUsed(usedExcerpts, content)

  return {
    id: 'structure',
    heading,
    content: content || UNAVAILABLE_TEXT,
    keyFacts: [],
    sourceRefs,
    available: Boolean(content)
  }
}

/**
 * Module 4 — Biological Mechanism & Function. The first Europe PMC/
 * PubMed excerpt not already used by Module 1 or Module 3 — this is
 * where the shared `usedExcerpts` set matters most, since without it
 * this module would trivially repeat whichever article Module 3 didn't
 * pick.
 */
function buildMechanismModule(europePmc: EuropePmcArticle[], usedExcerpts: Set<string>): DetailedStudyModule {
  const article = europePmc.find((a) => !isUsed(usedExcerpts, a.abstractText))
  markUsed(usedExcerpts, article?.abstractText)

  return {
    id: 'mechanism',
    heading: 'Biological Mechanism & Function',
    content: article?.abstractText || UNAVAILABLE_TEXT,
    keyFacts: article?.journal ? [`Published study from ${article.journal}`] : [],
    sourceRefs: article ? [{ sourceName: article.sourceName, sourceUrl: article.sourceUrl }] : [],
    available: Boolean(article)
  }
}

/**
 * Module 5 — Important Functional Relationships. Combines MeSH's
 * typed relationships (is_a / contains_subtype / associated_with /
 * related_to) with this concept's own stored scientific
 * ConceptRelations (the same table Connections/Mind Map read) — never
 * a duplicate of the definition/structure/mechanism text above, since
 * this module only ever renders relationship labels, not excerpt text.
 */
function buildRelationshipsModule(
  concept: Concept,
  mesh: MeshClassification | undefined,
  relatedEntries: { concept: Concept; relation: ConceptRelation }[]
): DetailedStudyModule {
  const lines: string[] = []
  const sourceRefs: { sourceName: string; sourceUrl: string }[] = []
  const seenSourceUrls = new Set<string>()

  for (const rel of (mesh?.relationships ?? []).slice(0, 5)) {
    lines.push(`${rel.targetName} (${rel.relationshipType.replace(/_/g, ' ')})`)
    if (!seenSourceUrls.has(rel.sourceUrl)) {
      seenSourceUrls.add(rel.sourceUrl)
      sourceRefs.push({ sourceName: rel.sourceName, sourceUrl: rel.sourceUrl })
    }
  }

  for (const { concept: other, relation } of relatedEntries.filter((e) => e.relation.origin === 'scientific').slice(0, 5)) {
    const label = relation.relationType ?? 'related_to'
    lines.push(`${other.name} (${label})`)
    if (relation.sourceUrl && !seenSourceUrls.has(relation.sourceUrl)) {
      seenSourceUrls.add(relation.sourceUrl)
      sourceRefs.push({ sourceName: relation.sourceName ?? 'Scientific source', sourceUrl: relation.sourceUrl })
    }
  }

  const content =
    lines.length > 0
      ? `${concept.name} has the following verified scientific relationships:\n${lines.map((l) => `• ${l}`).join('\n')}`
      : undefined

  return {
    id: 'relationships',
    heading: 'Important Functional Relationships',
    content: content || UNAVAILABLE_TEXT,
    keyFacts: lines[0] ? [`Primary connection: ${lines[0]}`] : [],
    sourceRefs: sourceRefs.slice(0, 3),
    available: Boolean(content)
  }
}

/**
 * Single entry point for the Learn tab's Detailed Study mode. Every
 * argument is data the Learn tab has already fetched for its other
 * content (Quick Revision's `sections`, the new MeSH/Europe PMC tiers,
 * and the existing scientific `relatedEntries`) — no new network calls.
 * Always returns exactly 5 modules, in the fixed order given in this
 * file's header; any module without genuinely distinct source-backed
 * content honestly reports `available: false` rather than duplicating
 * a neighbor.
 */
export function buildDetailedStudyModules(
  concept: Concept,
  sections: OnlineKnowledgeSection[],
  mesh: MeshClassification | undefined,
  europePmc: EuropePmcArticle[],
  relatedEntries: { concept: Concept; relation: ConceptRelation }[]
): DetailedStudyModule[] {
  const usedExcerpts = new Set<string>()

  const definition = buildDefinitionModule(concept, sections, mesh, usedExcerpts)
  const classification = buildClassificationModule(concept, mesh)
  const structure = buildStructureModule(sections, europePmc, usedExcerpts)
  const mechanism = buildMechanismModule(europePmc, usedExcerpts)
  const relationships = buildRelationshipsModule(concept, mesh, relatedEntries)

  return [definition, classification, structure, mechanism, relationships]
}
