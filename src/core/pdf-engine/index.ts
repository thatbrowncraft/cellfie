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

/** Re-exports PDF.js's small matrix-transform helper so the text layer doesn't need its own copy. */
export function transformPoint(m: number[], p: number[]): number[] {
  return pdfjsLib.Util.transform(m, p)
}

/**
 * Renders one page onto a caller-supplied canvas at the given scale and
 * returns the underlying PDF.js `RenderTask`. Callers should hold onto it
 * and call `.cancel()` on cleanup/re-render so rapid page/zoom changes
 * don't pile up concurrent renders onto the same canvas — PDF.js throws
 * a `RenderingCancelledException` in that case, which is expected and
 * safe to ignore.
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
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  return page.render({ canvasContext: ctx, viewport })
}
