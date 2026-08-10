export interface StructuredSection {
  title: string
  type: 'paragraph' | 'bullets' | 'steps'
  items?: string[]
  text?: string
}

export interface OnlineSummary {
  conceptName: string
  extract?: string
  definition?: string
  sections: StructuredSection[]
  sourceName: string
  sourceUrl: string
  isAuthoritative: boolean
}

export function isLikelyOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

/**
 * Cleans common PDF/OCR artefacts without trying to rewrite scientific text.
 *
 * Examples:
 *   stain ing     -> staining
 *   bact eria     -> bacteria
 *   techn ique    -> technique
 *   decoloriz ation -> decolorization
 */
export function cleanOcrText(text: string): string {
  if (!text) return ''

  return text
    // Join words broken by a hyphen at a line ending.
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')

    // Join common OCR/PDF word breaks.
    .replace(
      /\b([a-zA-Z]{2,})\s+(ing|tion|tions|ment|ments|ed|able|ible|al|ical|ic|ous|ive|ly|er|ers|es|ness|ria|teria|ique|gy|logy)\b/gi,
      '$1$2'
    )

    // Remove spaces before punctuation.
    .replace(/\s+([,.;:!?])/g, '$1')

    // Collapse horizontal whitespace.
    .replace(/[ \t]+/g, ' ')

    // Keep sensible paragraph breaks.
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

    .trim()
}

function cleanSentence(text: string): string {
  return cleanOcrText(text)
    .replace(/^\s*[-•*]\s*/, '')
    .replace(/^\s*\d+[\].)]\s*/, '')
    .trim()
}

function splitSentences(text: string): string[] {
  return cleanOcrText(text)
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter((sentence) => sentence.length >= 25)
}

function classifyAbstract(sentences: string[]): {
  definition?: string
  sections: StructuredSection[]
} {
  if (sentences.length === 0) {
    return { sections: [] }
  }

  const definitionSentences: string[] = []
  const purpose: string[] = []
  const principle: string[] = []
  const procedure: string[] = []
  const results: string[] = []
  const remember: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()

    if (
      lower.includes('is a ') ||
      lower.includes('is an ') ||
      lower.includes('is the ') ||
      lower.includes('refers to ') ||
      lower.includes('defined as ')
    ) {
      definitionSentences.push(sentence)
      continue
    }

    if (
      lower.includes('used to ') ||
      lower.includes('used for ') ||
      lower.includes('helps to ') ||
      lower.includes('allows ') ||
      lower.includes('enables ') ||
      lower.includes('important for ')
    ) {
      purpose.push(sentence)
      continue
    }

    if (
      lower.includes('principle') ||
      lower.includes('mechanism') ||
      lower.includes('based on ') ||
      lower.includes('depends on ') ||
      lower.includes('because ') ||
      lower.includes('retains ') ||
      lower.includes('differentiates ')
    ) {
      principle.push(sentence)
      continue
    }

    if (
      lower.includes('procedure') ||
      lower.includes('method') ||
      lower.includes('step') ||
      lower.includes('stain ') ||
      lower.includes('incubat') ||
      lower.includes('wash ') ||
      lower.includes('rinse ') ||
      lower.includes('decolor')
    ) {
      procedure.push(sentence)
      continue
    }

    if (
      lower.includes('result') ||
      lower.includes('appears ') ||
      lower.includes('indicates ') ||
      lower.includes('positive') ||
      lower.includes('negative')
    ) {
      results.push(sentence)
      continue
    }

    remember.push(sentence)
  }

  const sections: StructuredSection[] = []

  if (purpose.length > 0) {
    sections.push({
      title: 'Purpose',
      type: 'bullets',
      items: purpose.slice(0, 5)
    })
  }

  if (principle.length > 0) {
    sections.push({
      title: 'Principle',
      type: 'bullets',
      items: principle.slice(0, 6)
    })
  }

  if (procedure.length > 0) {
    sections.push({
      title: 'Procedure / Key steps',
      type: 'steps',
      items: procedure.slice(0, 8)
    })
  }

  if (results.length > 0) {
    sections.push({
      title: 'Result / Interpretation',
      type: 'bullets',
      items: results.slice(0, 6)
    })
  }

  if (remember.length > 0) {
    sections.push({
      title: 'Key points',
      type: 'bullets',
      items: remember.slice(0, 6)
    })
  }

  return {
    definition:
      definitionSentences.length > 0
        ? definitionSentences.slice(0, 2).join(' ')
        : sentences.slice(0, 1).join(' '),
    sections
  }
}

/**
 * Online scientific enrichment.
 *
 * IMPORTANT:
 * Wikipedia is deliberately NOT used anywhere in this function.
 *
 * Europe PMC is operated by EMBL-EBI and provides access to biomedical
 * literature. We use it only when the device is online.
 */
export async function fetchOnlineSummary(
  conceptName: string
): Promise<OnlineSummary | undefined> {
  if (!isLikelyOnline() || !conceptName.trim()) {
    return undefined
  }

  try {
    const query = encodeURIComponent(`"${conceptName.trim()}"`)

    const url =
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search` +
      `?query=${query}%20AND%20(OPEN_ACCESS:Y)` +
      `&format=json&pageSize=5`

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      return undefined
    }

    const data = await response.json()
    const results = data?.resultList?.result

    if (!Array.isArray(results) || results.length === 0) {
      return undefined
    }

    const match =
      results.find(
        (result: any) =>
          typeof result?.abstractText === 'string' &&
          result.abstractText.length > 80
      ) ?? results[0]

    if (!match?.abstractText) {
      return undefined
    }

    const rawAbstract = String(match.abstractText).replace(
      /<[^>]+>/g,
      ' '
    )

    const cleanAbstract = cleanOcrText(rawAbstract)

    const sentences = splitSentences(cleanAbstract)

    if (sentences.length === 0) {
      return undefined
    }

    const classified = classifyAbstract(sentences)

    const pmcId = match.pmcid
    const pmid = match.pmid

    const sourceUrl = pmcId
      ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/`
      : pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : `https://europepmc.org/article/MED/${match.id}`

    const sourceName = pmcId || pmid
      ? 'NCBI / PubMed / PMC'
      : 'Europe PMC (EMBL-EBI)'

    return {
      conceptName,
      extract: cleanAbstract,
      definition: classified.definition,
      sections: classified.sections,
      sourceName,
      sourceUrl,
      isAuthoritative: true
    }
  } catch {
    return undefined
  }
}
