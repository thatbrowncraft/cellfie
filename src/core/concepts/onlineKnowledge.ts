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

export function cleanOcrText(text: string): string {
  if (!text) return ''
  return text
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    .replace(/(\b[a-zA-Z]{2,})\s+(ing|tion|tions|ment|ments|ed|able|ible|al|ical|ic|ous|ive|ly|er|ers|es|ness|ria|teria|ique|gy|logy)\b/gi, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchOnlineSummary(conceptName: string): Promise<OnlineSummary | undefined> {
  if (!isLikelyOnline() || !conceptName.trim()) return undefined

  try {
    const query = encodeURIComponent(`"${conceptName.trim()}"`)
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}%20AND%20(OPEN_ACCESS:Y)&format=json&pageSize=3`

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) return undefined

    const data = await response.json()
    const results = data?.resultList?.result

    if (!results || !Array.isArray(results) || results.length === 0) {
      return undefined
    }

    const match = results.find((r: any) => r.abstractText && r.abstractText.length > 50) || results[0]
    if (!match || !match.abstractText) return undefined

    const rawAbstract = match.abstractText.replace(/<[^>]+>/g, '')
    const cleanAbstract = cleanOcrText(rawAbstract)

    const sentences = cleanAbstract.split(/(?<=[.!?])\s+/).filter(Boolean)
    const definition = sentences.slice(0, 2).join(' ')
    const remaining = sentences.slice(2).join(' ')

    const pmcId = match.pmcid || match.pmid
    const articleUrl = pmcId
      ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/`
      : `https://europepmc.org/article/MED/${match.id}`

    const journal = match.journalTitle || 'NCBI / National Institutes of Health (NIH)'

    return {
      conceptName,
      extract: cleanAbstract,
      definition,
      sections: remaining ? [{ title: 'Key Summary', type: 'paragraph', text: remaining }] : [],
      sourceName: `${journal} (NCBI/NIH Resource)`,
      sourceUrl: articleUrl,
      isAuthoritative: true
    }
  } catch {
    return undefined
  }
}
