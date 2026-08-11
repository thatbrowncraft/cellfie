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
 *
 * Sprint 2 (Study Companion milestone) adds two more genuinely new
 * tables, `highlights` and `notes`, in a `version(3)` migration — same
 * additive pattern as v2. Nothing about LibraryItem/Collection/
 * ReaderBookmark changes shape; existing rows are untouched.
 *
 * Sprint 3 (Offline Knowledge Layer) adds three more genuinely new
 * tables — `concepts`, `conceptSources`, `conceptRelations` — in a
 * `version(4)` migration. Same additive pattern as v2/v3: every prior
 * version's store definitions are repeated unchanged, so upgrading an
 * existing local database only ever adds stores/indexes, never touches
 * existing rows in libraryItems/collections/appSettings/readerBookmarks/
 * highlights/notes.
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

/** The four marker colors from the Sprint 2 brief. Order drives swatch display order everywhere. */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export const highlightColors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink']

export const highlightColorLabels: Record<HighlightColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink'
}

/**
 * One selected-text rectangle, in a page's *unscaled* (PDF.js `scale: 1`)
 * coordinate space — i.e. the same space `getPageSize` reports. Storing
 * unscaled coordinates (rather than rendered-pixel coordinates) means a
 * highlight redraws correctly at any zoom level / fit mode: the reader
 * just multiplies by whatever `effectiveScale` it's currently rendering
 * at. A highlighted span can wrap onto multiple lines, hence an array.
 */
export interface HighlightRect {
  x: number
  y: number
  width: number
  height: number
}

/** A highlighted span of text inside one page of a LibraryItem's PDF. */
export interface Highlight {
  id: string
  itemId: string
  page: number
  color: HighlightColor
  rects: HighlightRect[]
  /** The highlighted text itself, captured at creation time. */
  text: string
  /** Optional sticky note attached to this highlight (Sprint 2 §2). */
  note?: string
  createdAt: number
  updatedAt: number
}

/** A standalone or highlight-linked note (Sprint 2 §3/§5). */
export interface Note {
  id: string
  title: string
  /** Raw Markdown source. Rendered with the lightweight in-house renderer, not a library. */
  contentMarkdown: string
  tags: string[]
  favorite: boolean
  pinned: boolean
  /** Linked book context, if this note was created from/about a LibraryItem (§5 "Linked Notes"). */
  itemId?: string
  page?: number
  highlightId?: string
  createdAt: number
  updatedAt: number
}

/** Sprint 3 §2: where a ConceptSource's evidence actually came from. */
export type ConceptSourceType = 'pdf' | 'highlight' | 'note' | 'bookmark' | 'metadata' | 'manual'

/** Sprint 3 §1: a locally-tracked scientific concept. Never AI-generated — see core/concepts/extraction.ts. */
export interface Concept {
  id: string
  name: string
  /** Lowercased/trimmed/whitespace-collapsed form of `name`, used for deterministic dedupe/matching (§4). */
  normalizedName: string
  aliases: string[]
  /** User- or source-provided only. Never auto-generated (§1, §14). Absent → UI shows "No description saved yet." */
  description?: string
  tags: string[]
  /** True for concepts the user typed in via "+ New Concept" (§5); false for deterministically extracted ones (§3). */
  manuallyCreated: boolean
  firstSeenAt: number
  lastSeenAt: number
  createdAt: number
  updatedAt: number
}

/**
 * Sprint 3 §2: a traceable link from a Concept to one real piece of local
 * evidence — a highlight, a note, a bookmark, a book's own metadata/tags,
 * a manually-typed relation, or an on-demand PDF text-scan hit. Every row
 * must point at something that actually exists; see
 * core/concepts/extraction.ts for the only code paths allowed to create
 * these.
 */
export interface ConceptSource {
  id: string
  conceptId: string
  sourceType: ConceptSourceType
  libraryItemId?: string
  pageNumber?: number
  /** The Highlight/Note/ReaderBookmark id this source is traceable to, when sourceType needs one. */
  sourceId?: string
  /** Snippet of the actual matched/linked text, captured at link time — never invented. */
  sourceText?: string
  /**
   * Relevance Correction — how strongly this page actually discusses the
   * concept, per core/concepts/relevance.ts. Only set for `pdf` sources;
   * absent on other source types (a highlight/note/bookmark is inherently
   * meaningful — the person chose it). Undefined on legacy rows written
   * before this field existed; see `backfillSourceRelevance` in
   * core/concepts/extraction.ts for the one-time, per-concept pass that
   * scores those retroactively. A page that scored `reject` (TOC/index/
   * bibliography, or an isolated one-word hit) is never linked at all, so
   * this field only ever holds 'high' | 'relevant' | 'weak'.
   */
  relevanceTier?: 'high' | 'relevant' | 'weak'
  createdAt: number
}

/** Sprint 3 §10: an explicit, user-asserted relationship between two concepts. Undirected — see core/concepts/service.ts. */
export interface ConceptRelation {
  id: string
  conceptAId: string
  conceptBId: string
  createdAt: number
}

class CellfieDB extends Dexie {
  libraryItems!: Table<LibraryItem, string>
  collections!: Table<Collection, string>
  appSettings!: Table<AppSettingsRecord, string>
  readerBookmarks!: Table<ReaderBookmark, string>
  highlights!: Table<Highlight, string>
  notes!: Table<Note, string>
  concepts!: Table<Concept, string>
  conceptSources!: Table<ConceptSource, string>
  conceptRelations!: Table<ConceptRelation, string>

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
    // v3 — Study Companion milestone: adds `highlights` and `notes`. Again,
    // v1/v2 stores repeated unchanged; only additive tables/indexes here.
    this.version(3).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt',
      highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
      notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags'
    })
    // v4 — Sprint 3, Offline Knowledge Layer: adds `concepts`,
    // `conceptSources`, and `conceptRelations` only. v1/v2/v3 stores are
    // repeated unchanged, per Dexie's per-version-snapshot schema model;
    // no existing table's shape or data changes in this upgrade.
    this.version(4).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt',
      highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
      notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags',
      // normalizedName is unique-ish by convention (enforced in
      // core/concepts/service.ts, not by Dexie) so extraction can look up
      // "does a concept with this normalized name already exist" in O(1).
      concepts: 'id, normalizedName, manuallyCreated, lastSeenAt, createdAt, *tags, *aliases',
      // [conceptId+sourceType] and [conceptId+libraryItemId] back the two
      // queries the detail page actually runs: "this concept's sources,
      // grouped by type" and "does this concept already have a source in
      // this book" (used to avoid duplicate PDF-scan hits).
      conceptSources:
        'id, conceptId, libraryItemId, sourceType, sourceId, createdAt, [conceptId+sourceType], [conceptId+libraryItemId]',
      conceptRelations: 'id, conceptAId, conceptBId, createdAt, [conceptAId+conceptBId]'
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
