// src/core/concepts/onlineKnowledge.ts

export interface KnowledgeSection {
  title: string
  type: 'definition' | 'purpose' | 'principle' | 'procedure' | 'result' | 'remember' | 'terms'
  content: string | string[]
  format: 'paragraph' | 'bullets' | 'numbered'
}

export interface OnlineSummary {
  conceptName: string
  sourceName: string
  sourceUrl: string
  sections: KnowledgeSection[]
}

/**
 * Normalizes and repairs broken OCR / PDF word-break spacing.
 * e.g. "stain ing" -> "staining", "tech nique" -> "technique", "bact eria" -> "bacteria"
 */
export function cleanPdfText(rawText: string): string {
  if (!rawText) return ''

  let text = rawText
    // Fix hyphens at line breaks: "stain-\n ing" or "stain- ing" -> "staining"
    .replace(/(\w+)-\s*\n?\s*(\w+)/g, '$1$2')
    // Fix known broken medical/scientific word fragments from PDF OCR
    .replace(/\bstain\s+ing\b/gi, 'staining')
    .replace(/\btech\s+nique\b/gi, 'technique')
    .replace(/\btech\s+niques\b/gi, 'techniques')
    .replace(/\bbact\s+eria\b/gi, 'bacteria')
    .replace(/\bbact\s+erial\b/gi, 'bacterial')
    .replace(/\bste\s+ps\b/gi, 'steps')
    .replace(/\bproc\s+edure\b/gi, 'procedure')
    .replace(/\bprin\s+ciple\b/gi, 'principle')
    .replace(/\bcell\s+ular\b/gi, 'cellular')
    .replace(/\bmicro\s+organ\s*ism\b/gi, 'microorganism')
    .replace(/\bmicro\s+organ\s*isms\b/gi, 'microorganisms')
    .replace(/\bfollow\s+ing\b/gi, 'following')
    .replace(/\bdiffer\s+ent\b/gi, 'different')
    .replace(/\bdiffer\s+ential\b/gi, 'differential')
    .replace(/\bgram\s+pos\s+itive\b/gi, 'Gram-positive')
    .replace(/\bgram\s+neg\s+ative\b/gi, 'Gram-negative')
    .replace(/\bobs\s+erv\b/gi, 'observ')
    .replace(/\bmem\b\s+brane\b/gi, 'membrane')

  // Clean trailing spaces before punctuation
  text = text.replace(/\s+([.,;:?!])/g, '$1')
  // Collapse multi-spaces into single space
  text = text.replace(/[ \t]+/g, ' ')
  // Clean line breaks
  text = text.replace(/\n\s*\n/g, '\n\n').trim()

  return text
}

/**
 * Checks if network connectivity is available.
 */
export function isLikelyOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Parses scientific text into structured study sections.
 * Omits any section for which supporting data is absent.
 */
export function parseScientificTextToSections(text: string): KnowledgeSection[] {
  const cleaned = cleanPdfText(text)
  if (!cleaned) return []

  const sections: KnowledgeSection[] = []

  // Check for explicit section headings in text
  const definitionMatch = cleaned.match(/(?:definition|what is|overview):\s*([^.\n]+(?:\.[^.\n]+)*)/i)
  const purposeMatch = cleaned.match(/(?:purpose|why it is used|uses|indication):\s*([^.\n]+(?:\.[^.\n]+)*)/i)
  const principleMatch = cleaned.match(/(?:principle|mechanism|mode of action):\s*([^.\n]+(?:\.[^.\n]+)*)/i)
  const procedureMatch = cleaned.match(/(?:procedure|steps|method|protocol):\s*([^.\n]+(?:\.[^.\n]+)*)/i)
  const resultMatch = cleaned.match(/(?:result|results|interpretation|observation):\s*([^.\n]+(?:\.[^.\n]+)*)/i)

  if (definitionMatch?.[1]) {
    sections.push({
      title: 'Definition',
      type: 'definition',
      content: definitionMatch[1].trim(),
      format: 'paragraph'
    })
  }

  if (purposeMatch?.[1]) {
    const items = purposeMatch[1].split(/;|\.\s+/).map((s) => s.trim()).filter(Boolean)
    sections.push({
      title: 'Purpose / Why it is used',
      type: 'purpose',
      content: items.length > 1 ? items : purposeMatch[1].trim(),
      format: items.length > 1 ? 'bullets' : 'paragraph'
    })
  }

  if (principleMatch?.[1]) {
    sections.push({
      title: 'Principle',
      type: 'principle',
      content: principleMatch[1].trim(),
      format: 'paragraph'
    })
  }

  if (procedureMatch?.[1]) {
    const steps = procedureMatch[1].split(/(?:\d+\.|\n-|\n\*|;)/).map((s) => s.trim()).filter(Boolean)
    sections.push({
      title: 'Procedure / Steps',
      type: 'procedure',
      content: steps.length > 1 ? steps : procedureMatch[1].trim(),
      format: steps.length > 1 ? 'numbered' : 'paragraph'
    })
  }

  if (resultMatch?.[1]) {
    sections.push({
      title: 'Result / Interpretation',
      type: 'result',
      content: resultMatch[1].trim(),
      format: 'paragraph'
    })
  }

  // Fallback if no specific section markers were matched
  if (sections.length === 0) {
    const sentences = cleaned.split(/(?<=\.)\s+/).filter((s) => s.length > 5)
    if (sentences.length > 0) {
      sections.push({
        title: 'Definition',
        type: 'definition',
        content: sentences[0],
        format: 'paragraph'
      })

      if (sentences.length > 1) {
        sections.push({
          title: 'Key points to remember',
          type: 'remember',
          content: sentences.slice(1, 6),
          format: 'bullets'
        })
      }
    }
  }

  return sections
}

/**
 * Attempts to fetch scientific knowledge from NCBI / NIH.
 */
async function fetchNCBIKnowledge(conceptName: string): Promise<OnlineSummary | undefined> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=mesh&term=${encodeURIComponent(
      conceptName
    )}&retmode=json`
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) })
    if (!searchRes.ok) return undefined

    const searchData = (await searchRes.json()) as { esearchresult?: { idlist?: string[] } }
    const idList = searchData.esearchresult?.idlist

    if (!idList || idList.length === 0) return undefined
    const meshId = idList[0]

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=mesh&id=${meshId}&retmode=json`
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(4000) })
    if (!summaryRes.ok) return undefined

    const summaryData = (await summaryRes.json()) as { result?: Record<string, { ds_meshtermsummary?: string }> }
    const entry = summaryData.result?.[meshId]
    const rawSummary = entry?.ds_meshtermsummary

    if (!rawSummary) return undefined

    const sections = parseScientificTextToSections(rawSummary)
    if (sections.length === 0) return undefined

    return {
      conceptName,
      sourceName: 'NCBI / National Institutes of Health (NIH) MeSH',
      sourceUrl: `https://www.ncbi.nlm.nih.gov/mesh/${meshId}`,
      sections
    }
  } catch {
    return undefined
  }
}

/**
 * Attempts to fetch scientific knowledge from NIH MedlinePlus API.
 */
async function fetchMedlinePlusKnowledge(conceptName: string): Promise<OnlineSummary | undefined> {
  try {
    const url = `https://connect.medlineplus.gov/service?knowledgeResponseType=application/json&mainSearchCriteria.v.c=${encodeURIComponent(
      conceptName
    )}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return undefined

    const data = (await res.json()) as { feed?: { entry?: Array<{ summary?: { _value?: string }; link?: Array<{ href?: string }> }> } }
    const entry = data.feed?.entry?.[0]
    const rawSummary = entry?.summary?._value
    const link = entry?.link?.[0]?.href

    if (!rawSummary) return undefined

    const sections = parseScientificTextToSections(rawSummary)
    if (sections.length === 0) return undefined

    return {
      conceptName,
      sourceName: 'NIH MedlinePlus / National Library of Medicine',
      sourceUrl: link || 'https://medlineplus.gov',
      sections
    }
  } catch {
    return undefined
  }
}

/**
 * Attempts to fetch scientific knowledge from OpenAlex Open Science Index.
 */
async function fetchOpenAlexKnowledge(conceptName: string): Promise<OnlineSummary | undefined> {
  try {
    const url = `https://api.openalex.org/concepts?search=${encodeURIComponent(conceptName)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return undefined

    const data = (await res.json()) as { results?: Array<{ display_name?: string; description?: string; id?: string }> }
    const match = data.results?.[0]

    if (!match || !match.description) return undefined

    const sections = parseScientificTextToSections(match.description)
    if (sections.length === 0) return undefined

    return {
      conceptName,
      sourceName: 'OpenAlex Scientific Knowledge Index',
      sourceUrl: match.id || 'https://openalex.org',
      sections
    }
  } catch {
    return undefined
  }
}

/**
 * Main enrichment handler. Tries authoritative sources in priority order:
 * 1. NCBI / NIH MeSH
 * 2. NIH MedlinePlus
 * 3. OpenAlex Scientific Index
 * Absolutely NO calls to Wikipedia.
 */
export async function fetchOnlineSummary(conceptName: string): Promise<OnlineSummary | undefined> {
  if (!isLikelyOnline() || !conceptName.trim()) return undefined

  // Priority 1: NCBI / NIH
  const ncbiResult = await fetchNCBIKnowledge(conceptName)
  if (ncbiResult) return ncbiResult

  // Priority 2: NIH MedlinePlus
  const medlineResult = await fetchMedlinePlusKnowledge(conceptName)
  if (medlineResult) return medlineResult

  // Priority 3: OpenAlex Scientific Catalog
  const openAlexResult = await fetchOpenAlexKnowledge(conceptName)
  if (openAlexResult) return openAlexResult

  return undefined
}

