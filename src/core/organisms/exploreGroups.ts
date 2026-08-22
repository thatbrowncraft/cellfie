/**
 * core/organisms/exploreGroups — Organism Explorer landing page redesign.
 *
 * Everything in this module is a pure function over whatever organisms
 * are passed in (always the live registry + saved organisms merge that
 * OrganismExplorerPage already builds) — nothing here hardcodes a
 * count, a family/genus membership, or a category total. Add organism
 * #80 tomorrow and every summary, group, shortcut, and tree node below
 * recomputes from that organism's own classification/morphology/exam
 * fields the next time these functions run. No caller needs to change.
 *
 * This deliberately does NOT replace `registry.ts`'s per-category
 * filter state (`BacteriaFilterState` etc.) or `CategoryFilters.tsx`'s
 * dropdowns — those already give fine-grained, combinable filtering.
 * What's added here is a coarser, landing-page-friendly layer on top:
 * a handful of one-tap "groups" (Enterobacterales, Staphylococci, a
 * genus, a taxonomy branch) that a student recognizes by name, so the
 * Explorer doesn't force choosing from seven separate dropdowns before
 * narrowing anything down.
 */
import type { OrganismCategory, OrganismClassification, OrganismProfile } from './types'

// ---------------------------------------------------------------------------
// Category summaries — the four big cards on the landing page
// ---------------------------------------------------------------------------

export interface CategorySummary {
  category: OrganismCategory
  label: string
  description: string
  /** Gen Z Learning Layer §"category card microcopy" — one short, subtle memory line shown under the scientific description, never replacing it. */
  memoryLine?: string
  count: number
}

const CATEGORY_HUB_DESCRIPTIONS: Record<OrganismCategory, string> = {
  bacteria: 'Gram-positive, Gram-negative, acid-fast and other medically important bacteria.',
  fungi: 'Yeasts, moulds and medically important fungal organisms.',
  protozoa: 'Amoebae, flagellates, apicomplexans and other protozoan organisms.',
  virus: 'DNA and RNA viruses, with useful structural and clinical distinctions.',
  algae: 'Algal organisms of laboratory or clinical relevance.',
  other: 'Organisms that don\u2019t fit the main groups above.'
}

const CATEGORY_MEMORY_LINES: Partial<Record<OrganismCategory, string>> = {
  bacteria: 'Small cells. Huge syllabus.',
  fungi: 'Hyphae, yeast, and morphology doing the most.',
  protozoa: 'One cell. Multiple life-cycle complications.',
  virus: 'Not cells, still somehow on every exam.'
}

const CATEGORY_ORDER: OrganismCategory[] = ['bacteria', 'fungi', 'protozoa', 'virus', 'algae', 'other']

/** The category cards for the Explorer hub — always the four primary groups (even at 0, so the page reads as a stable structure), plus Algae/Other only once they actually hold an organism. Counts always computed live (never hardcoded). */
export function getCategorySummaries(
  organisms: OrganismProfile[],
  categoryLabels: Record<OrganismCategory, string>
): CategorySummary[] {
  const counts = new Map<OrganismCategory, number>()
  for (const o of organisms) counts.set(o.category, (counts.get(o.category) ?? 0) + 1)

  return CATEGORY_ORDER.filter((category) => ['bacteria', 'fungi', 'protozoa', 'virus'].includes(category) || (counts.get(category) ?? 0) > 0).map(
    (category) => ({
      category,
      label: categoryLabels[category],
      description: CATEGORY_HUB_DESCRIPTIONS[category],
      memoryLine: CATEGORY_MEMORY_LINES[category],
      count: counts.get(category) ?? 0
    })
  )
}

// ---------------------------------------------------------------------------
// Clinical/taxonomic quick groups — bacteria (§5 "useful taxonomic/
// clinical groups"). Group *membership rules* below are ordinary
// microbiology (which genus is in which clinically-recognized group) —
// domain knowledge, not a per-organism hardcoded count. Every count and
// every organism list is still derived live from whatever's actually in
// the registry; a group that ends up with zero matches is filtered out
// by the caller rather than ever being invented.
// ---------------------------------------------------------------------------

export interface OrganismGroup {
  id: string
  label: string
  description?: string
  organisms: OrganismProfile[]
}

const NON_FERMENTER_GENERA = new Set(['Pseudomonas', 'Acinetobacter', 'Moraxella', 'Burkholderia', 'Stenotrophomonas'])
const CLOSTRIDIAL_GENERA = new Set(['Clostridium', 'Clostridioides'])

interface BacteriaGroupRule {
  id: string
  label: string
  description: string
  matches: (o: OrganismProfile) => boolean
}

const BACTERIA_GROUP_RULES: BacteriaGroupRule[] = [
  {
    id: 'enterobacterales',
    label: 'Enterobacterales',
    description: 'Gram-negative rods in the order Enterobacterales \u2014 gut flora and gut pathogens alike.',
    matches: (o) => o.classification.order === 'Enterobacterales'
  },
  {
    id: 'staphylococci',
    label: 'Staphylococci',
    description: 'Catalase-positive cocci in clusters, genus Staphylococcus.',
    matches: (o) => o.classification.genus === 'Staphylococcus'
  },
  {
    id: 'streptococci',
    label: 'Streptococci',
    description: 'Catalase-negative cocci in chains, genus Streptococcus.',
    matches: (o) => o.classification.genus === 'Streptococcus'
  },
  {
    id: 'bacillus-genus',
    label: 'Bacillus genus',
    description: 'Gram-positive, spore-forming rods in the genus Bacillus.',
    matches: (o) => o.classification.genus === 'Bacillus'
  },
  {
    id: 'clostridia',
    label: 'Clostridia',
    description: 'Anaerobic, spore-forming Gram-positive rods (Clostridium and Clostridioides).',
    matches: (o) => Boolean(o.classification.genus) && CLOSTRIDIAL_GENERA.has(o.classification.genus as string)
  },
  {
    id: 'neisseria',
    label: 'Neisseria',
    description: 'Gram-negative diplococci, genus Neisseria.',
    matches: (o) => o.classification.genus === 'Neisseria'
  },
  {
    id: 'mycobacteria',
    label: 'Mycobacteria',
    description: 'Acid-fast rods, genus Mycobacterium.',
    matches: (o) => o.classification.genus === 'Mycobacterium'
  },
  {
    id: 'non-fermenters',
    label: 'Non-fermenters',
    description: 'Gram-negative rods that don\u2019t ferment lactose \u2014 Pseudomonas, Acinetobacter and relatives.',
    matches: (o) => Boolean(o.classification.genus) && NON_FERMENTER_GENERA.has(o.classification.genus as string)
  }
]

/** Bacteria-only clinical/taxonomic groups (§5/§6), each with only the organisms that actually match, computed live. Only groups with at least one organism are returned — an empty group is never shown (§5 "only show grouping options that actually have organisms"). A final "Other" bucket catches any bacterium that matched none of the named groups, so the set of groups always accounts for every bacterium without inventing a taxonomic relationship for it. */
export function getBacteriaGroups(bacteria: OrganismProfile[]): OrganismGroup[] {
  const claimed = new Set<string>()
  const groups: OrganismGroup[] = []

  for (const rule of BACTERIA_GROUP_RULES) {
    const matched = bacteria.filter((o) => rule.matches(o))
    if (matched.length === 0) continue
    matched.forEach((o) => claimed.add(o.id))
    groups.push({ id: rule.id, label: rule.label, description: rule.description, organisms: matched })
  }

  const other = bacteria.filter((o) => !claimed.has(o.id))
  if (other.length > 0) {
    groups.push({
      id: 'other-bacteria',
      label: 'Other important groups',
      description: 'Medically important bacteria outside the named groups above.',
      organisms: other
    })
  }

  return groups
}

// ---------------------------------------------------------------------------
// Quick Explore (§19) — cross-cutting shortcuts that don't fit any one
// category's normal filter dimensions.
// ---------------------------------------------------------------------------

export interface QuickExploreShortcut {
  id: string
  label: string
  count: number
}

/** True once an organism actually carries clinical-significance content — mirrors the same check OrganismDetailPage uses to decide whether to render its Clinical Importance section, so "clinically important" here means the same thing it means there. */
export function hasClinicalImportance(o: OrganismProfile): boolean {
  const c = o.clinicalImportance
  return Boolean(
    c &&
      (c.diseases?.length || c.virulenceFactors?.length || c.toxins?.length || c.transmission || c.epidemiology || c.labSignificance)
  )
}

/** True once an organism's exam-facts block actually has content — the same "high-yield" fields OrganismDetailPage's Exam Facts section checks before rendering. */
export function hasExamFacts(o: OrganismProfile): boolean {
  return Object.values(o.examFacts).some(Boolean)
}

/** Every shortcut is only returned once it has at least one match (§19 "only show shortcuts that actually return results") — counts always computed from the current organism set. */
export function getQuickExploreShortcuts(organisms: OrganismProfile[]): QuickExploreShortcut[] {
  const shortcuts: QuickExploreShortcut[] = [
    { id: 'gram-positive', label: 'Gram-positive bacteria', count: organisms.filter((o) => o.category === 'bacteria' && o.morphology.gramReaction === 'positive').length },
    { id: 'gram-negative', label: 'Gram-negative bacteria', count: organisms.filter((o) => o.category === 'bacteria' && o.morphology.gramReaction === 'negative').length },
    { id: 'acid-fast', label: 'Acid-fast organisms', count: organisms.filter((o) => o.morphology.acidFast).length },
    { id: 'yeasts-moulds', label: 'Yeasts & moulds', count: organisms.filter((o) => o.category === 'fungi').length },
    { id: 'clinically-important', label: 'Clinically important organisms', count: organisms.filter(hasClinicalImportance).length },
    { id: 'exam-favorites', label: 'High-yield exam organisms', count: organisms.filter(hasExamFacts).length }
  ]
  return shortcuts.filter((s) => s.count > 0)
}

/** Applies a Quick Explore shortcut's own logic — kept in one place so the id used for routing/state and the predicate that actually filters can never drift apart. */
export function applyQuickExploreShortcut(organisms: OrganismProfile[], id: string): OrganismProfile[] {
  switch (id) {
    case 'gram-positive':
      return organisms.filter((o) => o.category === 'bacteria' && o.morphology.gramReaction === 'positive')
    case 'gram-negative':
      return organisms.filter((o) => o.category === 'bacteria' && o.morphology.gramReaction === 'negative')
    case 'acid-fast':
      return organisms.filter((o) => o.morphology.acidFast)
    case 'yeasts-moulds':
      return organisms.filter((o) => o.category === 'fungi')
    case 'clinically-important':
      return organisms.filter(hasClinicalImportance)
    case 'exam-favorites':
      return organisms.filter(hasExamFacts)
    default:
      return organisms
  }
}

// ---------------------------------------------------------------------------
// Taxonomy browsing (§10) — a generic Domain→…→Genus tree built
// straight from each organism's own `classification` block. A rank is
// skipped for a given branch whenever the organisms in it don't have a
// value for it (§10 "do not show unnecessary levels when data is
// unavailable") rather than ever being padded with an invented value.
// ---------------------------------------------------------------------------

const TAXONOMY_RANKS: (keyof OrganismClassification)[] = ['domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus']

export interface TaxonomyNode {
  /** The classification field this node groups by, or 'organism' for a leaf. */
  rank: string
  /** The value at that rank (a family/genus/order name), or the organism's scientific name for a leaf. */
  value: string
  count: number
  children: TaxonomyNode[]
  /** Populated only on a leaf node (rank === 'organism'). */
  organism?: OrganismProfile
}

function buildTaxonomyLevel(organisms: OrganismProfile[], rankIndex: number): TaxonomyNode[] {
  if (rankIndex >= TAXONOMY_RANKS.length) {
    return organisms
      .slice()
      .sort((a, b) => a.scientificName.localeCompare(b.scientificName))
      .map((o) => ({ rank: 'organism', value: o.scientificName, count: 1, children: [], organism: o }))
  }

  const rank = TAXONOMY_RANKS[rankIndex]
  const grouped = new Map<string, OrganismProfile[]>()
  const unclassified: OrganismProfile[] = []

  for (const o of organisms) {
    const value = o.classification[rank]
    if (value) {
      const bucket = grouped.get(value) ?? []
      bucket.push(o)
      grouped.set(value, bucket)
    } else {
      unclassified.push(o)
    }
  }

  const nodes: TaxonomyNode[] = Array.from(grouped.entries())
    .map(([value, group]): TaxonomyNode => ({ rank, value, count: group.length, children: buildTaxonomyLevel(group, rankIndex + 1) }))
    .sort((a, b) => a.value.localeCompare(b.value))

  // Organisms with no value at this rank skip straight to the next one;
  // their resulting nodes are merged in at this same level rather than
  // being nested under an invented "Unclassified" placeholder.
  const skipped = unclassified.length > 0 ? buildTaxonomyLevel(unclassified, rankIndex + 1) : []

  return [...nodes, ...skipped]
}

/** Builds the full Domain→…→Genus→Organism tree for one category's organisms (or any organism list), generated fresh from the registry every call — never hardcoded (§22). */
export function buildOrganismTaxonomyTree(organisms: OrganismProfile[]): TaxonomyNode[] {
  return buildTaxonomyLevel(organisms, 0)
}

/** Every organism reachable from a taxonomy node, in scientific-name order. */
export function collectTaxonomyNodeOrganisms(node: TaxonomyNode): OrganismProfile[] {
  if (node.rank === 'organism' && node.organism) return [node.organism]
  return node.children.flatMap(collectTaxonomyNodeOrganisms).sort((a, b) => a.scientificName.localeCompare(b.scientificName))
}

// ---------------------------------------------------------------------------
// Structured search (§11) — recognizing when a query is itself a
// genus or family name so results can lead with that instead of just an
// unstructured card grid.
// ---------------------------------------------------------------------------

export interface LocalTaxonMatch {
  rank: 'genus' | 'family'
  value: string
  organisms: OrganismProfile[]
  /** The family name shared by the matched organisms, when the match itself was a genus — shown as extra context per §11. */
  family?: string
}

/** Only ever an exact (case-insensitive) match against a genus or family value that actually exists in the given organisms — never a fuzzy/partial match, and never invents a taxonomic relationship the data doesn't already state. */
export function resolveLocalTaxonMatch(query: string, organisms: OrganismProfile[]): LocalTaxonMatch | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined

  const genusMatches = organisms.filter((o) => o.classification.genus?.toLowerCase() === q)
  if (genusMatches.length > 0) {
    const family = genusMatches.find((o) => o.classification.family)?.classification.family
    return { rank: 'genus', value: genusMatches[0].classification.genus as string, organisms: genusMatches, family }
  }

  const familyMatches = organisms.filter((o) => o.classification.family?.toLowerCase() === q)
  if (familyMatches.length > 0) {
    return { rank: 'family', value: familyMatches[0].classification.family as string, organisms: familyMatches }
  }

  return undefined
}
