/**
 * core/concepts/textDisplay — Sprint 3.1 correction, Concept Overview only.
 *
 * Everything here is a pure, read-only DISPLAY transform. It never writes
 * to the database and never touches the stored `concept.description` or
 * `ConceptSource.sourceText` — those stay exactly as the person typed
 * them / as the PDF extraction produced them. Callers pass raw text in
 * and get back text to *render*, nothing more.
 *
 * Why this exists even though `core/concepts/extraction.ts`'s
 * `getSourceExcerpt` was already fixed (in an earlier pass) to join PDF
 * text-run positions correctly instead of forcing a space at every run
 * boundary: that fix only helps *newly* extracted excerpts. It can't
 * repair (a) `concept.description` values a person typed or pasted
 * before that fix existed, (b) text pasted in from elsewhere that
 * happens to carry the same kind of artifact, or (c) any other
 * already-mangled string this component is handed. This is the safety
 * net for all of those, applied only at render time.
 */

// Word-final fragments that are essentially never valid standalone
// English words on their own — so if the token immediately AFTER a
// space exactly equals one of these, the space is almost certainly a
// PDF extraction artifact splitting one word in two, not a real word
// boundary. Deliberately does NOT include short real words ("ing" is
// close to "in"/"in g" but never appears as its own word; genuine
// two-word scientific terms like "Gram positive" or "cell wall" never
// match this list, so they're never touched).
const SUFFIX_FRAGMENTS = new Set([
  'ing', 'ion', 'ions', 'tion', 'tions', 'sion', 'ation', 'ications', 'ication',
  'ique', 'iques', 'ology', 'ologies', 'osis', 'itis', 'ase', 'ular', 'ules', 'ule',
  'ture', 'tures', 'ent', 'ents', 'ive', 'ives', 'ies', 'ity', 'ities',
  'ic', 'ics', 'ous', 'ary', 'ory', 'graphy', 'scopy', 'philic', 'phobic', 'ism', 'ist'
])

// The mirror case: a fragment that's a common scientific PREFIX, split
// off from the rest of the word ("co unterstain" -> "counterstain").
// Kept short and specific — only prefixes that are never themselves a
// standalone English word, so "a cid" is not attempted (that would be
// "a" + "cid", and "a" is a real word — too risky to auto-merge).
const PREFIX_FRAGMENTS = new Set([
  'co', 'de', 're', 'un', 'dis', 'pre', 'non', 'sub', 'inter', 'intra', 'extra',
  'micro', 'macro', 'poly', 'mono', 'anti', 'auto', 'semi', 'super', 'ultra', 'infra',
  'counter', 'over', 'under', 'multi'
])

/**
 * Repairs the specific PDF/OCR word-break artifact — a real word split
 * into two tokens by an extraction gap — without touching genuine
 * two-word terms. Conservative by design: when in doubt, it leaves the
 * text alone. Also collapses stray repeated whitespace, but preserves
 * paragraph breaks, numbered lists ("1.", "2)"), and bullet markers.
 */
export function cleanDisplayText(raw: string): string {
  if (!raw) return raw

  // Normalize whitespace within a line, but keep paragraph/list
  // structure: collapse runs of spaces/tabs, keep newlines as-is.
  let text = raw.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')

  // Repair word-break artifacts token by token. Runs a couple of passes
  // since a single word can occasionally be split more than once
  // ("de colori zation").
  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/([A-Za-z]{3,})[ \u00A0]([A-Za-z]{1,7})(?=[\s.,;:)\]]|$)/g, (match, word: string, frag: string) => {
      const fragLower = frag.toLowerCase()
      if (SUFFIX_FRAGMENTS.has(fragLower)) return word + frag
      const wordLower = word.toLowerCase()
      if (PREFIX_FRAGMENTS.has(wordLower) && frag.length >= 3) return word + frag
      return match
    })
  }

  return text.trim()
}

export interface SectionBlock {
  heading: string
  body: string
  /** Character offsets of this block within the CLEANED text
   *  (`cleanDisplayText(raw)`, not `raw` itself) — Study Overview
   *  Correction: lets a caller locate which block actually contains a
   *  given occurrence (e.g. the concept's own strongest mention),
   *  instead of always assuming the page's first block is the relevant
   *  one. `end` is exclusive. */
  start: number
  end: number
}

// Headings this app knows how to recognize when they appear verbatim in
// a person's own book. This is NOT inventing structure — it's detecting
// structure the source material already has and preserving it, instead
// of flattening it into one paragraph. Deliberately domain-general
// (Sprint: "Overview for any academic topic, not just microbiology") —
// covers lab-technique books (Principle/Procedure/Precautions),
// biology/biochem texts (Mechanism/Functions/Significance), and
// quantitative/aptitude material (Formula/Shortcuts/Common mistakes)
// with the same mechanism: a heading is only recognized if it's the
// book's own word, never invented by this app.
const KNOWN_HEADINGS = [
  'definition', 'purpose', 'principle', 'principle / core idea', 'core idea',
  'how it works', 'mechanism', 'procedure', 'requirements', 'reagents', 'method',
  'basic method', 'steps',
  'types', 'classification', 'functions', 'function',
  'result', 'results', 'interpretation', 'result / interpretation', 'results and interpretation',
  'precautions', 'precaution', 'applications', 'application',
  'advantages', 'limitations', 'advantages and limitations', 'advantages / limitations',
  'significance', 'clinical significance', 'biological significance',
  'formula', 'formulas', 'examples', 'example', 'shortcuts', 'shortcut',
  'common mistakes', 'common mistake',
  'things to remember', 'key points', 'important points', 'remember'
]

const HEADING_WORDS_RE = `(${KNOWN_HEADINGS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`

// Two accepted shapes, both requiring an unambiguous delimiter so an
// ordinary sentence that happens to start with one of these words
// ("Results may vary depending on...") is never mistaken for a heading:
//   1. The heading ALONE on its own line, optionally with a trailing
//      figure reference — "Principle" / "Procedure (Fig. 27.2)".
//   2. The heading followed by a COLON, with its content on the same
//      line — "Formula: Percentage = (Part/Whole) × 100". The colon is
//      the unambiguous signal; without it, the line is left as body text.
const HEADING_ALONE_RE = new RegExp(`^${HEADING_WORDS_RE}\\s*[:\\-]?\\s*(\\(.*?\\))?$`, 'i')
const HEADING_INLINE_RE = new RegExp(`^${HEADING_WORDS_RE}\\s*:\\s*(.+)$`, 'i')

/**
 * Splits a block of source text into sections ONLY where the text
 * itself already labels them with a recognized heading. If no
 * recognized headings are found, returns a single section with an empty
 * heading (caller shows it as plain body text — never invents a
 * "Definition" label for text that isn't actually a definition).
 */
export function splitIntoKnownSections(raw: string): SectionBlock[] {
  const cleaned = cleanDisplayText(raw)
  const lines = cleaned.split('\n').map((l) => l.trim())

  const rawSections: Array<{ heading: string; body: string }> = []
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const aloneMatch = HEADING_ALONE_RE.exec(line)
    const inlineMatch = !aloneMatch ? HEADING_INLINE_RE.exec(line) : null
    if (aloneMatch) {
      if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
      currentHeading = aloneMatch[1].trim()
      currentLines = []
    } else if (inlineMatch) {
      if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
      currentHeading = inlineMatch[1].trim()
      currentLines = inlineMatch[2].trim() ? [inlineMatch[2].trim()] : []
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })

  // Second pass: locate each block's real position in `cleaned` so a
  // caller can ground a decision (e.g. "which block actually discusses
  // this concept") in an actual character offset instead of block
  // order. Sequential, non-overlapping search from a rolling cursor,
  // since blocks always appear in `cleaned` in the same order they were
  // built. A body that can't be found (shouldn't normally happen, since
  // every body is built from `cleaned`'s own lines) degrades to a
  // zero-length range at the cursor rather than throwing.
  let cursor = 0
  const sections: SectionBlock[] = rawSections
    .filter((s) => s.body)
    .map((s) => {
      const idx = cleaned.indexOf(s.body, cursor)
      const start = idx === -1 ? cursor : idx
      const end = start + s.body.length
      cursor = end
      return { ...s, start, end }
    })

  return sections
}
