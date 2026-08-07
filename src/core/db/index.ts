/**
 * core/db — Dexie schema over IndexedDB.
 *
 * Per the Software Design Document (v3, §10) and the Knowledge Engine Spec
 * (§3), structured records live here; raw binary blobs (PDFs, thumbnails)
 * live in OPFS via `core/file-storage` and are referenced by path only.
 *
 * This task (Personal Library Module) implements `LibraryItem` and
 * `Collection` for real. `Chunk`, `Citation`, `Topic`, and everything else
 * the Knowledge Engine Spec describes are intentionally NOT added yet —
 * search/AI/content generation are out of scope here. `LibraryItem`'s
 * indexing fields (`indexingStatus`, `chunkCount`, `ocrProcessed`) exist so
 * a future indexing engine has a clean, additive on-ramp (spec §3, §18.3)
 * rather than a schema migration.
 *
 * PDF Reader milestone (still Personal Library Module scope) adds two
 * things, both additive: `LibraryItem.lastPageRead` (reading progress /
 * "remember last opened page") is a plain, non-indexed field, so it needs
 * no schema bump — existing rows simply don't have it until first read.
 * `ReaderBookmark` is a genuinely new table (one row per saved page per
 * item), so it's introduced in a `version(2)` migration that repeats the
 * v1 store definitions unchanged per Dexie's upgrade model — existing
 * libraries upgrade in place with no data loss.
 */

import Dexie, { type Table } from 'dexie'

/** Matches the Knowledge Engine Spec §4 Parser Registry's documentType values. */
export type DocumentType = 'textbook' | 'manual' | 'paper' | 'lecture-notes' | 'other'

/** Matches Knowledge Engine Spec §3's `LibraryItem.indexingStatus` values. */
export type IndexingStatus = 'queued' | 'indexing' | 'indexed' | 'failed'

export type CollectionAccent = 'olive' | 'sage' | 'terracotta'

export interface LibraryItem {
  id: string
  title: string
  author?: string
  fileName: string
  fileSize: number
  /** SHA-256 of the file contents — exact-duplicate detection (Spec §4 step 2). */
  fileHash: string
  pageCount?: number
  documentType: DocumentType
  language: string
  indexingStatus: IndexingStatus
  chunkCount: number
  ocrProcessed: boolean
  tags: string[]
  collectionIds: string[]
  /** OPFS path to a rendered first-page thumbnail, if generation succeeded. */
  thumbnailPath?: string
  /** OPFS path to the raw PDF blob. */
  filePath: string
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
  /** Reader milestone: last page viewed in the PDF reader — "remember last opened page". */
  lastPageRead?: number
}

export interface Collection {
  id: string
  name: string
  accent: CollectionAccent
  createdAt: number
}

/** Reader milestone: a saved page within a LibraryItem's PDF, shown in the reader sidebar. */
export interface ReaderBookmark {
  id: string
  itemId: string
  page: number
  createdAt: number
}

export interface AppSettingsRecord {
  key: string
  value: unknown
}

class CellfieDB extends Dexie {
  libraryItems!: Table<LibraryItem, string>
  collections!: Table<Collection, string>
  appSettings!: Table<AppSettingsRecord, string>
  readerBookmarks!: Table<ReaderBookmark, string>

  constructor() {
    super('cellfie')
    this.version(1).stores({
      // Multi-entry indexes (*collectionIds, *tags) let us query "items in
      // collection X" / "items tagged Y" directly instead of filtering
      // client-side over the whole table as the library grows.
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key'
    })
    // v2 — PDF Reader milestone: adds the bookmarks table only. v1 stores
    // are repeated unchanged, per Dexie's per-version-snapshot schema
    // model; existing rows in libraryItems/collections/appSettings are
    // untouched by this upgrade.
    this.version(2).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt'
    })
  }
}

export const db = new CellfieDB()

export function isPersistenceAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

export const documentTypeLabels: Record<DocumentType, string> = {
  textbook: 'Textbook',
  manual: 'Manual',
  paper: 'Paper',
  'lecture-notes': 'Lecture Notes',
  other: 'Other'
}

export const indexingStatusLabels: Record<IndexingStatus, string> = {
  queued: 'Ready to index',
  indexing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Indexing failed'
}
