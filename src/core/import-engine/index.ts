/**
 * core/import-engine — Knowledge Engine Spec §4's Import Pipeline,
 * implemented through step 6 + persistence (9–10). Steps 7 (indexing:
 * full-text/embedding) and 8 (near-duplicate clustering across the
 * library) are explicitly out of scope for this task — no search, AI, or
 * content generation yet — so every imported item lands with
 * `indexingStatus: 'queued'`, ready for a future indexing engine to pick
 * up without a schema migration.
 *
 *   1. Type detection & routing   → detectFormat() below, by magic
 *                                    bytes/content, not just file
 *                                    extension. PDF (core/pdf-engine),
 *                                    EPUB, and standalone XHTML/HTML
 *                                    (both core/epub-engine) — Book
 *                                    Import Formats §17-19. Each format
 *                                    gets its own small parser/adapter
 *                                    (§18), never forced through the PDF
 *                                    pipeline.
 *   2. Duplicate check             → fileHash lookup, warns rather than
 *                                    silently skipping (spec §4 step 2)
 *   3. Parse & extract text/meta   → core/pdf-engine or core/epub-engine
 *   4. (chunking)                  → not implemented — out of scope
 *   5. Extract document metadata   → title/author/pageCount, documentType
 *                                    defaults to 'other', user-editable after
 *   6. Citation anchors            → not applicable without chunking
 *   7-8. (indexing, dedup cluster) → not implemented — out of scope
 *   9. Persist                     → Dexie (metadata) + OPFS (file/thumbnail)
 *  10. indexingStatus = 'queued'   → (not 'indexed' — nothing indexed it)
 */

import { db, type DocumentType, type LibraryItem } from '../db'
import { writeFile } from '../file-storage'
import { parsePdf } from '../pdf-engine'
import { isZipFile, parseEpub, parseHtmlDocument } from '../epub-engine'
import { runDeterministicExtractionForItem } from '../concepts'

export type ImportStage =
  | 'hashing'
  | 'checking-duplicate'
  | 'parsing'
  | 'saving'
  | 'done'
  | 'duplicate'
  | 'unsupported'
  | 'error'

export interface ImportProgressEvent {
  fileName: string
  stage: ImportStage
}

export type ImportResult =
  | { fileName: string; status: 'imported'; libraryItem: LibraryItem }
  | { fileName: string; status: 'duplicate'; duplicateOf: LibraryItem }
  | { fileName: string; status: 'unsupported'; reason: string }
  | { fileName: string; status: 'error'; message: string }

type DetectedFormat = 'pdf' | 'epub' | 'html' | 'unsupported'

/**
 * §17: type detection by content, not filename — a mislabeled extension
 * shouldn't sink an otherwise-readable file, and this only trusts the
 * extension as a last resort for plain text formats that have no magic
 * bytes of their own.
 */
async function detectFormat(file: File): Promise<DetectedFormat> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const asAscii = String.fromCharCode(...header.slice(0, 4))
  if (asAscii === '%PDF') return 'pdf'
  if (await isZipFile(file)) return 'epub' // EPUB is the only zip-packaged format this pass supports
  const name = file.name.toLowerCase()
  if (name.endsWith('.html') || name.endsWith('.htm') || name.endsWith('.xhtml')) return 'html'
  return 'unsupported'
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.(pdf|epub|x?html?)$/i, '').replace(/[-_]+/g, ' ').trim() || fileName
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Imports a single file. Reports progress via `onProgress` as it moves through the pipeline. */
export async function importFile(
  file: File,
  onProgress?: (event: ImportProgressEvent) => void
): Promise<ImportResult> {
  const report = (stage: ImportStage) => onProgress?.({ fileName: file.name, stage })

  const format = await detectFormat(file)
  if (format === 'unsupported') {
    report('unsupported')
    return { fileName: file.name, status: 'unsupported', reason: 'This file format isn\u2019t supported yet. Try PDF, EPUB, or HTML/XHTML.' }
  }

  try {
    report('hashing')
    const fileHash = await hashFile(file)

    report('checking-duplicate')
    const existing = await db.libraryItems.where('fileHash').equals(fileHash).first()
    if (existing) {
      report('duplicate')
      return { fileName: file.name, status: 'duplicate', duplicateOf: existing }
    }

    report('parsing')
    const id = crypto.randomUUID()
    let title: string | undefined
    let author: string | undefined
    let pageCount: number | undefined
    let thumbnailBlob: Blob | undefined

    if (format === 'pdf') {
      const parsed = await parsePdf(file)
      title = parsed.title
      author = parsed.author
      pageCount = parsed.pageCount
      thumbnailBlob = parsed.thumbnailBlob
    } else if (format === 'epub') {
      const parsed = await parseEpub(file)
      title = parsed.title
      author = parsed.author
      pageCount = parsed.pageTexts.length
      // No cover thumbnail extraction this pass (§26 — smallest safe set);
      // the Library falls back to its existing no-thumbnail placeholder.
    } else {
      const html = await file.text()
      const parsed = parseHtmlDocument(html)
      title = parsed.title
      pageCount = 1
    }

    report('saving')
    const extension = format === 'pdf' ? 'pdf' : format === 'epub' ? 'epub' : 'html'
    const filePath = await writeFile('library-files', `${id}.${extension}`, file)
    const thumbnailPath = thumbnailBlob ? await writeFile('library-thumbnails', `${id}.png`, thumbnailBlob) : undefined

    const now = Date.now()
    const libraryItem: LibraryItem = {
      id,
      title: title ?? titleFromFileName(file.name),
      author,
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      pageCount,
      documentType: 'other' satisfies DocumentType,
      language: 'en',
      indexingStatus: 'queued',
      chunkCount: 0,
      ocrProcessed: false,
      tags: [],
      collectionIds: [],
      thumbnailPath,
      filePath,
      format,
      createdAt: now,
      updatedAt: now
    }

    await db.libraryItems.add(libraryItem)
    report('done')
    // Sprint 3 Correction §1/§17: "Book imported → local text available →
    // deterministic extraction". Fire-and-forget so the Import dialog's
    // progress UI isn't held up by a full-book text pass — the Concepts
    // page picks the results up via its own liveQuery once they land.
    // Format-agnostic since Retrieval Correction §3/documentText.ts —
    // works the same for a freshly-imported EPUB or HTML file too.
    void runDeterministicExtractionForItem(libraryItem)
    return { fileName: file.name, status: 'imported', libraryItem }
  } catch (err) {
    report('error')
    return { fileName: file.name, status: 'error', message: err instanceof Error ? err.message : 'Import failed.' }
  }
}

/** Imports files sequentially (keeps memory bounded for large multi-file drops). */
export async function importFiles(
  files: File[],
  onProgress?: (event: ImportProgressEvent) => void
): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  for (const file of files) {
    results.push(await importFile(file, onProgress))
  }
  return results
}
