/**
 * core/pdf-engine — thin wrapper over PDF.js (SDD v3 §4's chosen PDF
 * library). This task uses it only for import-time metadata extraction
 * (title/author/page count) and a first-page cover thumbnail — the
 * `PdfParser` role described in Knowledge Engine Spec §4's Parser
 * Registry, minus chunking/indexing (out of scope here; see §4 steps
 * 4/7/8, intentionally not implemented by this module).
 */

import * as pdfjsLib from 'pdfjs-dist'
// Vite-specific asset import: bundles the PDF.js worker as its own chunk
// and gives us a URL to point the main thread at, per pdfjs-dist's
// documented Vite integration.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
