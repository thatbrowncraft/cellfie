/**
 * core/import-engine — Knowledge Engine Spec §4's Import Pipeline,
 * implemented through step 6 + persistence (9–10). Steps 7 (indexing:
 * full-text/embedding) and 8 (near-duplicate clustering across the
 * library) are explicitly out of scope for this task — no search, AI, or
 * content generation yet — so every imported item lands with
 * `indexingStatus: 'queued'`, ready for a future indexing engine to pick
 * up without a schema migration.
 *
 *   1. Type detection & routing   → isPdf() below; PDF only for now,
 *                                    matching the Parser Registry's only
 *                                    currently-built parser (core/pdf-engine)
 *   2. Duplicate check             → fileHash lookup, warns rather than
 *                                    silently skipping (spec §4 step 2)
 *   3. Parse & extract text/meta   → core/pdf-engine
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

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim() || fileName
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

  if (!isPdf(file)) {
    report('unsupported')
    return { fileName: file.name, status: 'unsupported', reason: 'Only PDF files are supported right now.' }
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
    const parsed = await parsePdf(file)

    report('saving')
    const id = crypto.randomUUID()
    const filePath = await writeFile('library-files', `${id}.pdf`, file)
    const thumbnailPath = parsed.thumbnailBlob
      ? await writeFile('library-thumbnails', `${id}.png`, parsed.thumbnailBlob)
      : undefined

    const now = Date.now()
    const libraryItem: LibraryItem = {
      id,
      title: parsed.title ?? titleFromFileName(file.name),
      author: parsed.author,
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      pageCount: parsed.pageCount,
      documentType: 'other' satisfies DocumentType,
      language: 'en',
      indexingStatus: 'queued',
      chunkCount: 0,
      ocrProcessed: false,
      tags: [],
      collectionIds: [],
      thumbnailPath,
      filePath,
      createdAt: now,
      updatedAt: now
    }

    await db.libraryItems.add(libraryItem)
    report('done')
    // Sprint 3 Correction §1/§17: "Book imported → local text available →
    // deterministic extraction". Fire-and-forget so the Import dialog's
    // progress UI isn't held up by a full-book PDF text pass — the
    // Concepts page picks the results up via its own liveQuery once
    // they land.
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
