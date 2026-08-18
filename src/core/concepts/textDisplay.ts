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
  /**
   * Structural Assembly Correction — the book's own section number
   * ("5.2" from a heading line like "5.2 The Light-Dependent Reactions"),
   * present only when the heading came through the NUMBERED_HEADING_RE
   * path. This is the book's own outline, not anything this app infers —
   * it lets a caller recognize that "5.2 The Light-Dependent Reactions"
   * and "5.3 The Calvin Cycle" are siblings of "5.1 Overview of
   * Photosynthesis" under the same chapter, even though neither repeats
   * the chapter's own name. `undefined` for headings that didn't come
   * from a numbered line (known-vocabulary or bare-title headings).
   */
  sectionNumber?: string
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

// ---------------------------------------------------------------------
// Retrieval Correction §1 — generic textbook heading detection.
//
// KNOWN_HEADINGS above recognizes a small, fixed vocabulary of lab-
// manual/exam-style labels (Definition, Procedure, ...). That's useful
// for that style of source, but it can never recognize a real textbook's
// own section titles ("3.4 Photosynthesis", "Structure of DNA") because
// those titles are different in every single book — no fixed list could
// ever cover them, and hardcoding subject-specific titles ("Photosynthesis",
// "DNA", "Probability") would be exactly the kind of one-subject special
// case the architecture must not have.
//
// This detects the SHAPE a heading takes instead of what it says:
//   - a numbered heading ("3.4 Photosynthesis", "12.1 Probability")
//   - a short, standalone title-shaped line (no closing sentence
//     punctuation, not too long) immediately followed by a real
//     paragraph of prose
// Deliberately conservative — a short capitalized line on its own is NOT
// enough; it also has to be followed by something that reads like an
// actual explanation, not another short line, so a run of captions/labels
// doesn't get mistaken for a run of headings.
// ---------------------------------------------------------------------
const NUMBERED_HEADING_RE = /^(\d{1,2}(?:\.\d{1,2}){0,3})[.)]?\s+([A-Z][^.!?]{1,78})$/
const TITLE_LIKE_LINE_RE = /^[A-Z][A-Za-z0-9()'’-]*(?:\s+[A-Za-z0-9()'’-]+){0,7}$/
const SENTENCE_END_RE = /[.!?]$/

// Retrieval Correction §B — a figure/table/plate caption is title-shaped
// (short, no closing punctuation, followed by real explanatory prose
// underneath it in the page's reading order) and would otherwise pass
// `looksLikeStructuralHeading` exactly like a genuine section title
// does. That's exactly how "FIGURE 3.15" / "PATHWAYS OF PHOTOSYNTHESIS
// AND CELLULAR METABOLISM"-style captions were becoming Core Concept
// section headings — and, worse, ranking as the concept's OWN heading
// whenever the caption text happened to contain the concept's name.
// A caption is never the actual explanatory section for a concept, so
// this line-shape is excluded from heading detection entirely, both for
// the numbered and the plain title-shaped forms.
const CAPTION_LABEL_RE = /^(fig(?:ure)?|table|box|plate|chart|diagram|photo|image)\b/i

// Content Quality Correction (DNA test) — a table-of-contents, list-of-
// figures, or index entry keeps the exact short/title-shaped line a
// genuine heading takes, but once its dot-leader is stripped by
// extraction it becomes indistinguishable from a heading by vocabulary
// alone: "THE POLYMERIZATION OF NUCLEOTIDES INTO DNA 130", "The
// antiparallel structure of the DNA double helix 131". The shape that
// actually distinguishes it is the same across every book: the line
// carries no sentence-ending punctuation, yet its very last token is a
// bare 1-4 digit page number — real running prose essentially never ends
// an unpunctuated line on a bare number, but a TOC/index row always does.
// A genuine numbered heading ("5.2 The Light-Dependent Reactions") has
// its number at the START, never the end, so this never touches that
// shape. A single extracted line can also splice several end-of-book
// entries together once page breaks collapse ("... Microorganisms 673
// Further Reading 674 Index 675") — the tell there is more than one bare
// number appearing mid-line, each immediately followed by the start of
// another capitalized entry, which running prose does not do.
const TRAILING_PAGE_NUMBER_RE = /\s\d{1,4}$/
const MULTI_TOC_ENTRY_RE = /\d{1,4}\s+[A-Z][a-z]/

export function looksLikeTocOrIndexLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // A genuine numbered heading ("5.2 The Light-Dependent Reactions") has
  // its own dotted section number at the START — that's the reliable,
  // already-trusted heading shape, and its digits (e.g. "5" and "1" from
  // "5.1") must never be mistaken for TOC/index page-number contamination.
  if (NUMBERED_HEADING_RE.test(trimmed)) return false
  const numberHits = trimmed.match(/\d{1,4}/g)?.length ?? 0
  if (!SENTENCE_END_RE.test(trimmed) && TRAILING_PAGE_NUMBER_RE.test(trimmed) && trimmed.split(/\s+/).length <= 14) {
    return true
  }
  return numberHits >= 2 && MULTI_TOC_ENTRY_RE.test(trimmed)
}

// Retrieval Diagnostic Correction — `joinPageTextPreservingParagraphs`
// emits one `\n` per ORIGINAL PDF visual line, not one per true
// paragraph (see pdf-engine's own doc comment: every line/column jump
// becomes a break). That means the line immediately after a genuine
// section heading is often just the first hard-wrapped fragment of the
// paragraph's first sentence ("Photosynthesis is the process by") —
// which can easily fall under 6 words purely because of where the PDF
// happened to wrap, not because what follows isn't real prose. Checking
// only `lines[i+1]` in isolation was rejecting real textbook headings
// (exactly the "3.4 Photosynthesis" / "The Calvin Cycle" style headings
// a book itself uses) for a layout reason, not a content reason. Looking
// ahead across a small run of following lines — stopping at the next
// blank line or another heading-shaped line — and judging the combined
// word count fixes this without loosening what still counts as "real
// prose": a genuinely short/caption-like follow-on (an actual figure
// label, a lone stray heading) still fails this test.
const PARAGRAPH_LOOKAHEAD_MAX_LINES = 4

function looksLikeParagraphStart(lines: string[], startIndex: number, minWords = 6): boolean {
  let words = 0
  for (let i = startIndex; i < Math.min(lines.length, startIndex + PARAGRAPH_LOOKAHEAD_MAX_LINES); i += 1) {
    const trimmed = lines[i]?.trim()
    if (!trimmed) {
      if (words > 0) break // blank line after some content = end of the lookahead window
      continue
    }
    // Another heading-shaped line right away means there's no real
    // paragraph here (e.g. two stacked labels) — don't keep scanning
    // past it hoping for a later paragraph to satisfy the count.
    if (HEADING_ALONE_RE.test(trimmed) || NUMBERED_HEADING_RE.test(trimmed)) break
    words += trimmed.split(/\s+/).length
    if (words >= minWords) return true
  }
  return words >= minWords
}

// Content Quality Correction (DNA test) — a diagram/enzyme label like
// "DNA PRIMASE" or "DNA POLYMERASE I" is exactly as title-shaped as a
// genuine unnumbered section title, and the short caption fragment that
// often follows it on the page ("(not shown) eventually removes primer
// and fills gap") can clear the same lightweight 6-word lookahead a real
// paragraph needs — that's how a diagram label ends up mistaken for the
// book's own explanatory heading. A NUMBERED heading ("5.2 The Light-
// Dependent Reactions") is a much stronger signal — a book only numbers
// its own actual section titles, never a diagram label — so it keeps the
// original, lighter bar. A bare, unnumbered title-shaped line needs
// substantially more following prose before it's trusted as a real
// section rather than a label.
const BARE_TITLE_PARAGRAPH_MIN_WORDS = 16

/**
 * True when `line` is structurally shaped like a textbook heading. Never
 * inspects what the heading actually says — only its shape and what
 * follows it. `prevLine` lets a caller rule out a caption's own title
 * line (e.g. "PATHWAYS OF PHOTOSYNTHESIS AND CELLULAR METABOLISM"
 * immediately under "FIGURE 3.15") — that second line is title-shaped on
 * its own, but it's a continuation of the caption above it, not a new
 * section heading. `followingLines`/`followingIndex` let the paragraph-
 * start check look ahead past a single short PDF-wrapped line instead of
 * judging real prose by an arbitrary line-wrap position (see
 * `looksLikeParagraphStart`'s own comment).
 */
export function looksLikeStructuralHeading(
  line: string,
  followingLines: string[],
  followingIndex: number,
  prevLine?: string
): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 90) return false
  if (CAPTION_LABEL_RE.test(trimmed)) return false
  if (prevLine && CAPTION_LABEL_RE.test(prevLine.trim())) return false
  if (looksLikeTocOrIndexLine(trimmed)) return false

  const numbered = NUMBERED_HEADING_RE.exec(trimmed)
  if (numbered) {
    const title = numbered[2].trim()
    return title.split(/\s+/).length <= 10 && !!title
  }

  if (SENTENCE_END_RE.test(trimmed)) return false
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount < 1 || wordCount > 8) return false
  if (!TITLE_LIKE_LINE_RE.test(trimmed)) return false
  // Unnumbered/bare title lines are the less reliable heading shape (see
  // BARE_TITLE_PARAGRAPH_MIN_WORDS above) — held to a stricter following-
  // prose bar than the numbered-heading path above.
  return looksLikeParagraphStart(followingLines, followingIndex, BARE_TITLE_PARAGRAPH_MIN_WORDS)
}

/** The heading text itself, with any leading section number stripped. */
export function structuralHeadingText(line: string): string {
  const numbered = NUMBERED_HEADING_RE.exec(line.trim())
  return numbered ? numbered[2].trim() : line.trim()
}

/** The book's own leading section number ("5.2" from "5.2 The Light-
 *  Dependent Reactions"), or `undefined` when the line isn't numbered. */
export function structuralHeadingNumber(line: string): string | undefined {
  const numbered = NUMBERED_HEADING_RE.exec(line.trim())
  return numbered ? numbered[1].trim() : undefined
}

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

  const rawSections: Array<{ heading: string; body: string; sectionNumber?: string }> = []
  let currentHeading = ''
  let currentNumber: string | undefined
  let currentLines: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const aloneMatch = HEADING_ALONE_RE.exec(line)
    const inlineMatch = !aloneMatch ? HEADING_INLINE_RE.exec(line) : null
    // Only checked once neither known-vocabulary form matches, so this
    // never changes behavior for lab-manual-style content — it only adds
    // recognition for the textbook-heading shape those two never covered.
    const structuralMatch = !aloneMatch && !inlineMatch ? looksLikeStructuralHeading(line, lines, i + 1, lines[i - 1]) : false

    if (aloneMatch) {
      if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim(), sectionNumber: currentNumber })
      currentHeading = aloneMatch[1].trim()
      currentNumber = undefined
      currentLines = []
    } else if (inlineMatch) {
      if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim(), sectionNumber: currentNumber })
      currentHeading = inlineMatch[1].trim()
      currentNumber = undefined
      currentLines = inlineMatch[2].trim() ? [inlineMatch[2].trim()] : []
    } else if (structuralMatch) {
      if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim(), sectionNumber: currentNumber })
      currentHeading = structuralHeadingText(line)
      currentNumber = structuralHeadingNumber(line)
      currentLines = []
    } else {
      // Content Quality Correction (DNA test) — a TOC/index/end-matter
      // line that wasn't structurally heading-shaped enough to open its
      // own block (e.g. spliced mid-paragraph, or too many words for the
      // heading check above) is still contamination, not real body prose
      // — drop it rather than let it get appended into whatever section
      // happens to be open, which is how "Further Reading 674 Index 675"
      // ends up glued onto the end of a real explanatory section.
      if (looksLikeTocOrIndexLine(line)) continue
      currentLines.push(line)
    }
  }
  if (currentLines.some((l) => l)) rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim(), sectionNumber: currentNumber })

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
