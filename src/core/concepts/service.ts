import { db, type Concept, type ConceptSource, type LibraryItem } from '@/core/db'
import { cleanOcrText } from './onlineKnowledge'

export { cleanOcrText }

export interface ConceptStats {
  bookCount: number
  pageCount: number
  highlightCount: number
  noteCount: number
}

export interface CoOccurrenceMatch {
  concept: Concept
  sharedPageCount: number
}

export interface FirstAndLastEncounter {
  first?: { libraryItemId: string; bookTitle: string; pageNumber: number }
  last?: { libraryItemId: string; bookTitle: string; pageNumber: number }
}

export interface SourceExcerpt {
  text: string
  pageNumber: number
  bookTitle: string
}

export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
}

export interface ParsedStudyCard {
  definition?: string
  purpose?: string[]
  principle?: string[]
  procedure?: string[]
  results?: string
  remember?: string[]
  importantTerms?: string[]
}

export function parseStudySections(rawText: string): ParsedStudyCard {
  const text = cleanOcrText(rawText)
  if (!text) return {}

  const result: ParsedStudyCard = {}

  const sectionRegex = /(?:^|\n)(definition|purpose|why it is used|principle|procedure|steps|result|interpretation|results|key points|remember|important terms|components):\s*/gi
  const matches = Array.from(text.matchAll(sectionRegex))

  if (matches.length === 0) {
    const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    if (paragraphs.length > 0) {
      result.definition = paragraphs[0]
      if (paragraphs.length > 1) {
        result.remember = paragraphs.slice(1)
      }
    }
    return result
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const header = match[1].toLowerCase()
    const startIndex = match.index! + match[0].length
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : text.length
    const blockText = text.slice(startIndex, endIndex).trim()

    const items = blockText
      .split(/\n|•|;/)
      .map((item) => item.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((item) => item.length > 0)

    if (header.includes('definition')) {
      result.definition = blockText
    } else if (header.includes('purpose') || header.includes('why')) {
      result.purpose = items
    } else if (header.includes('principle')) {
      result.principle = items
    } else if (header.includes('procedure') || header.includes('steps')) {
      result.procedure = items
    } else if (header.includes('result') || header.includes('interpretation')) {
      result.results = blockText
    } else if (header.includes('remember') || header.includes('key points')) {
      result.remember = items
    } else if (header.includes('terms') || header.includes('components')) {
      result.importantTerms = items
    }
  }

  return result
}

export function computeConceptStats(concept: Concept, sources: ConceptSource[]): ConceptStats {
  const bookIds = new Set<string>()
  const pages = new Set<string>()
  let highlightCount = 0
  let noteCount = 0

  for (const s of sources) {
    if (s.libraryItemId) {
      bookIds.add(s.libraryItemId)
      if (s.pageNumber != null) {
        pages.add(`${s.libraryItemId}-${s.pageNumber}`)
      }
    }
    if (s.sourceType === 'highlight') highlightCount++
    if (s.sourceType === 'note') noteCount++
  }

  return {
    bookCount: bookIds.size,
    pageCount: pages.size,
    highlightCount,
    noteCount
  }
}

export async function deleteConcept(id: string): Promise<void> {
  await db.transaction('rw', [db.concepts, db.conceptSources, db.conceptRelations], async () => {
    await db.concepts.delete(id)
    await db.conceptSources.where('conceptId').equals(id).delete()
    await db.conceptRelations.where('conceptAId').equals(id).delete()
    await db.conceptRelations.where('conceptBId').equals(id).delete()
  })
}

export function getFirstAndLastEncountered(
  sources: ConceptSource[],
  itemsById: Map<string, LibraryItem>
): FirstAndLastEncounter {
  const pdfSources = sources.filter((s) => s.sourceType === 'pdf' && s.libraryItemId && s.pageNumber != null)
  if (pdfSources.length === 0) return {}

  const sorted = [...pdfSources].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const firstItem = first?.libraryItemId ? itemsById.get(first.libraryItemId) : undefined
  const lastItem = last?.libraryItemId ? itemsById.get(last.libraryItemId) : undefined

  return {
    first: first && firstItem ? { libraryItemId: first.libraryItemId!, bookTitle: firstItem.title, pageNumber: first.pageNumber! } : undefined,
    last: last && lastItem ? { libraryItemId: last.libraryItemId!, bookTitle: lastItem.title, pageNumber: last.pageNumber! } : undefined
  }
}

export async function getSourceExcerpt(
  item: LibraryItem,
  pageNumber: number,
  conceptName: string
): Promise<SourceExcerpt> {
  const itemWithDesc = item as unknown as { description?: string; title: string }
  const rawText = itemWithDesc.description || `Excerpt from page ${pageNumber} referencing ${conceptName}.`
  return {
    text: cleanOcrText(rawText),
    pageNumber,
    bookTitle: item.title
  }
}

export async function runDeterministicExtractionForItem(_item: LibraryItem): Promise<{ conceptsFound: number }> {
  return { conceptsFound: 0 }
}

export async function buildConceptMindMap(conceptId: string): Promise<MindMapNode> {
  const c = await db.concepts.get(conceptId)
  return {
    id: conceptId,
    label: c?.name || 'Concept',
    children: []
  }
}
