/**
 * core/knowledge/text — tiny, deliberately narrow text-cleanup helpers
 * shared by the online-source adapters. Not a general HTML/XML parser —
 * these only ever run on plain scientific text (abstracts, JATS
 * fragments) that adapters fetch themselves, never on anything this app
 * renders as markup.
 */

/** Decodes the small set of HTML entities that genuinely show up in raw Europe PMC / Crossref text. Mirrors core/concepts/onlineKnowledge.ts's own helper so both modules treat provider text identically — intentionally duplicated rather than imported, so this module has zero dependency on the Concept Hub's retrieval file (see README "why a separate module"). */
export function decodeEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Strips tags (e.g. Crossref's JATS-flavored `<jats:p>` abstracts) without pulling in an XML parser dependency. */
export function stripTags(text: string): string {
  if (!text) return ''
  return decodeEntities(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
