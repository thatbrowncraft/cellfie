/**
 * core/pdf-engine — thin wrapper over PDF.js (SDD v3 §4's chosen PDF
 * library). Originally used only for import-time metadata extraction
 * (title/author/page count) and a first-page cover thumbnail — the
 * `PdfParser` role described in Knowledge Engine Spec §4's Parser
 * Registry, minus chunking/indexing (still out of scope; see §4 steps
 * 4/7/8, intentionally not implemented by this module).
 *
 * Also now backs the Library reader (Personal Library Module, PDF Reader
 * milestone): opening a document from an in-memory blob, rendering a
 * given page onto a caller-supplied canvas at an arbitrary scale (used
 * for both the main page view and sidebar thumbnails), and reading a
 * page's natural (scale-1) size for fit-width/fit-page math.
 *
 * Sprint 2 (Study Companion milestone) adds one more thin wrapper,
 * `getPageTextContent`, exposing PDF.js's per-page text items so the
 * reader can lay down an invisible, selectable text layer over the
 * rendered canvas — the basis for Text Highlighting (§1).
 */

import * as pdfjsLib from 'pdfjs-dist'
// Vite-specific asset import: bundles the PDF.js worker as its own chunk
// and gives us a URL to point the main thread at, per pdfjs-dist's
// documented Vite integration.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

/**
 * The subset of PDF.js's `TextItem` shape the text layer actually reads.
 * Defined locally instead of imported from pdfjs-dist's internal type
 * path, which isn't part of its stable public export surface.
 */
export interface PdfTextItem {
  str: string
  dir: string
  /** 2D transform matrix [a, b, c, d, e, f], PDF (bottom-up) coordinate space. */
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

export interface ParsedPdfMetadata {
  title?: string
  author?: string
  pageCount: number
  /** Rendered first page, downscaled — best-effort, may be omitted. */
  thumbnailBlob?: Blob
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/** Parses a PDF File: extracts metadata and renders a first-page thumbnail. */
export async function parsePdf(file: File): Promise<ParsedPdfMetadata> {
  const data = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data }).promise

  let title: string | undefined
  let author: string | undefined
  try {
    const meta = await doc.getMetadata()
    const info = meta.info as Record<string, unknown>
    title = cleanString(info.Title)
    author = cleanString(info.Author)
  } catch {
    // Some PDFs carry no/corrupt metadata streams — fall back to the
    // filename-derived title the import pipeline supplies instead.
  }

  const thumbnailBlob = await renderThumbnail(doc).catch(() => undefined)

  return { title, author, pageCount: doc.numPages, thumbnailBlob }
}

async function renderThumbnail(doc: pdfjsLib.PDFDocumentProxy): Promise<Blob | undefined> {
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 0.6 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  await page.render({ canvasContext: ctx, viewport }).promise

  return new Promise<Blob | undefined>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png')
  })
}

/** Opens a PDF.js document from an in-memory blob (e.g. read back from OPFS). */
export async function loadPdfDocument(blob: Blob): Promise<pdfjsLib.PDFDocumentProxy> {
  const data = await blob.arrayBuffer()
  return pdfjsLib.getDocument({ data }).promise
}

/** A page's natural size at scale 1 — the basis for fit-width/fit-page calculations. */
export async function getPageSize(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  return { width: viewport.width, height: viewport.height }
}

/** A page's text items plus the viewport transform needed to place them (scale-1, i.e. natural page space). */
export async function getPageTextContent(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<{ items: PdfTextItem[]; viewportTransform: number[] }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const items = textContent.items.filter((item): item is PdfTextItem => 'str' in item) as unknown as PdfTextItem[]
  return { items, viewportTransform: viewport.transform }
}

/**
 * Joins a page's text items into one readable string using each item's
 * own position, instead of blindly inserting a space between every item.
 *
 * PDF.js reports one `TextItem` per run of glyphs the PDF's content
 * stream groups together — on a justified/kerned page a single word can
 * be split across two or more runs with almost no gap between them.
 * `items.map(i => i.str).join(' ')` (the previous approach, used in five
 * places across concept extraction/search) inserted a literal space at
 * *every* item boundary regardless of the real gap, which is exactly
 * what produced "tech nique" / "prepar ation" style mangled words in
 * concept overviews, source excerpts, and note previews built from PDF
 * text. This instead measures the horizontal gap between the end of one
 * item and the start of the next (in the same units as `width`/
 * `transform`) and only inserts a space when that gap is wide enough to
 * plausibly be a real word boundary; a large vertical jump (line/column
 * break) always inserts a break so words never get glued together
 * across lines.
 *
 * Study Overview Correction: also repairs the OTHER shape of PDF word
 * breakage — a line-wrap hyphen ("fun-\ndamental", "accomplish-\nment")
 * — right here, once, instead of leaving every downstream reader (this
 * function's callers) to guess at it from already-flattened text. When
 * a run ends in a hyphen immediately followed by a line/column break,
 * AND the next run starts with a lowercase letter (the shape of a word
 * continuing mid-word, not a new sentence or a genuine hyphenated
 * compound like "Gram-positive" starting a fresh capitalized term), the
 * hyphen is dropped and the two runs are joined directly with no break.
 * This is a heuristic, not a dictionary lookup — a real compound word
 * that happens to break exactly at a line's hyphen with a lowercase
 * continuation (rare) could get merged without its hyphen, but a
 * genuine 3+ letter mid-word split is far more common at line wraps
 * than a coincidental compound-word break, and joining a merged
 * compound word incorrectly is a much smaller readability cost than the
 * "fun-damental" artifact this exists to fix.
 */
export function joinPageText(items: PdfTextItem[]): string {
  return buildPageText(items, { preserveParagraphs: false })
}

/**
 * Same word-joining and hyphen-repair as `joinPageText`, but preserves
 * real line/paragraph breaks as `\n` instead of collapsing them to a
 * single space. Study Overview Correction: structural section parsing
 * (`splitIntoKnownSections`, which looks for a heading "alone on its
 * own line") needs this — `joinPageText`'s flattened, single-line
 * output made every page look like one giant paragraph with no
 * detectable structure, which is a root cause of the Study Overview
 * starting mid-sentence (there was no paragraph boundary left to stop
 * at). Only used where paragraph/heading structure is actually read;
 * every other caller (search indexing, relevance scoring, keyword
 * matching) is whitespace-agnostic and keeps using the flattened
 * `joinPageText` unchanged, so this doesn't touch their behavior.
 */
export function joinPageTextPreservingParagraphs(items: PdfTextItem[]): string {
  return buildPageText(items, { preserveParagraphs: true })
}

function buildPageText(items: PdfTextItem[], opts: { preserveParagraphs: boolean }): string {
  let out = ''
  let prevEndX: number | undefined
  let prevY: number | undefined
  let prevFontSize = 0

  for (const item of items) {
    const str = item.str
    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0
    // transform[3] is the vertical scale component, a reasonable proxy
    // for this run's font size regardless of rotation.
    const fontSize = Math.abs(item.transform?.[3] ?? item.height ?? 10) || 10

    if (str === '') {
      // PDF.js emits an empty-string item purely to signal a line break
      // (`hasEOL`) in some documents — treat it as whitespace, not a
      // zero-width word boundary.
      if (item.hasEOL && out && !out.endsWith('\n') && !out.endsWith(' ')) out += '\n'
      continue
    }

    if (out) {
      const sameLine = prevY !== undefined && Math.abs(y - prevY) < Math.max(prevFontSize, fontSize) * 0.4
      if (!sameLine) {
        // Line-wrap hyphen repair: a run ending in "<letter>-" right
        // before a line break, continuing into a lowercase-starting
        // next run, is almost always one word split across the wrap —
        // drop the hyphen and join with no break at all.
        const hyphenMatch = /([A-Za-z])-$/.exec(out)
        const nextStartsLower = /^[a-z]/.test(str)
        if (hyphenMatch && nextStartsLower) {
          out = out.slice(0, -1)
        } else if (!out.endsWith('\n')) {
          out += '\n'
        }
      } else if (prevEndX !== undefined) {
        const gap = x - prevEndX
        // Threshold scales with font size: ~18% of an average character
        // width reliably separates "real" word gaps from the sub-pixel
        // kerning gaps inside a single justified word, without needing a
        // full glyph-metrics table.
        const threshold = fontSize * 0.18
        if (gap > threshold && !out.endsWith(' ') && !out.endsWith('\n')) out += ' '
      }
    }

    out += str
    prevEndX = x + (item.width ?? 0)
    prevY = y
    prevFontSize = fontSize
  }

  out = out.replace(/[ \t]+/g, ' ')
  if (opts.preserveParagraphs) {
    return out.replace(/\n{3,}/g, '\n\n').replace(/ *\n */g, '\n').trim()
  }
  return out.replace(/\n+/g, ' ').trim()
}

/** Re-exports PDF.js's small matrix-transform helper so the text layer doesn't need its own copy. */
export function transformPoint(m: number[], p: number[]): number[] {
  return pdfjsLib.Util.transform(m, p)
}

// Sprint 2.1 §1 bugfix: caps for the HiDPI backing-store boost below, so a
// big zoomed-in page on a high-devicePixelRatio phone can't blow past a
// sane canvas size and stall/crash the tab. One page is ever rendered at
// a time in this architecture, so these are per-canvas ceilings, not a
// budget shared across pages.
const MAX_CANVAS_DIMENSION = 4096
const MAX_CANVAS_PIXELS = 16_000_000

/**
 * Renders one page onto a caller-supplied canvas at the given scale and
 * returns the underlying PDF.js `RenderTask`. Callers should hold onto it
 * and call `.cancel()` on cleanup/re-render so rapid page/zoom changes
 * don't pile up concurrent renders onto the same canvas — PDF.js throws
 * a `RenderingCancelledException` in that case, which is expected and
 * safe to ignore.
 *
 * Sprint 2.1 §1 bugfix: the canvas's backing store (its `width`/`height`
 * attributes, i.e. actual pixel count) used to always equal the CSS
 * viewport size at `scale` — correct on a standard-density screen, but
 * on any devicePixelRatio > 1 display (basically every modern phone) the
 * browser then had to upscale that 1x bitmap to cover 2-3x as many
 * physical pixels, so the page was permanently soft at *any* zoom level
 * (the mismatch is the same regardless of which scale is chosen — matches
 * the report that changing the zoom % didn't reliably sharpen anything).
 * Rendering into a backing store sized for the device's real pixel
 * density fixes this at the source. The canvas's CSS/display size is left
 * untouched here — it's still driven by the caller's own layout (which
 * sizes it to `viewport.width`/`height` in CSS px) — so this only changes
 * how many physical pixels PDF.js draws into, never the CSS box that
 * zoom/fit-width/fit-page math and the surrounding page frame are built
 * from. The extra resolution comes from PDF.js's own `render({ transform })`
 * option (a canvas-space matrix PDF.js applies while drawing), not a CSS
 * transform, per the "don't use CSS transform as the zoom mechanism"
 * requirement.
 */
export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<pdfjsLib.RenderTask> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const rawPixelRatio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
  const area = Math.max(viewport.width * viewport.height, 1)
  const longestSide = Math.max(viewport.width, viewport.height, 1)
  // Never let the DPR boost push the backing store past either ceiling —
  // falls back toward 1x (still correct, just not extra-sharp) rather
  // than an oversized canvas, on a huge/zoomed-in page.
  const budgetRatio = Math.sqrt(MAX_CANVAS_PIXELS / area)
  const dimensionRatio = MAX_CANVAS_DIMENSION / longestSide
  const pixelRatio = Math.max(1, Math.min(rawPixelRatio, budgetRatio, dimensionRatio))

  canvas.width = Math.max(1, Math.round(viewport.width * pixelRatio))
  canvas.height = Math.max(1, Math.round(viewport.height * pixelRatio))

  const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined

  return page.render({ canvasContext: ctx, viewport, transform })
}
