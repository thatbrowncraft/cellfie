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
 *
 * Concept 2.0 Phase 2 adds a `version(5)` migration: `ConceptRelation`
 * gains `origin` ('manual' | 'scientific') plus, for scientific
 * relations only, `relationType`/`evidence`/`sourceName`/`sourceUrl` —
 * additive fields only, no existing table shape removed. Every prior
 * version's stores are repeated unchanged (Dexie's per-version-snapshot
 * model), and an `.upgrade()` step backfills every pre-existing
 * `conceptRelations` row with `origin: 'manual'` — every row that
 * existed before this migration was written by an explicit user action
 * (the "Add related concept" flow or promoting a suggested/candidate
 * concept), so `'manual'` is the accurate, non-invented label for all
 * of them; no scientific evidence is fabricated for old rows.
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
  /** Concept 2.0 Phase 5 (Exam Tools "Memory aid") — a mnemonic/memory aid the user writes themselves. Never auto-generated or suggested; absent by default. Not an indexed field, so no schema/version bump was needed to add it — existing rows simply have it undefined until the person writes one. */
  memoryAid?: string
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

/** Concept 2.0 Phase 2 — where a ConceptRelation actually came from. 'manual' = the person explicitly connected these two; 'scientific' = discovered by checking a real online scientific source, never invented. */
export type ConceptRelationOrigin = 'manual' | 'scientific'

/** Sprint 3 §10: an explicit relationship between two concepts. Undirected — see core/concepts/service.ts. Concept 2.0 Phase 2: now distinguishes a user-asserted ('manual') connection from an evidence-backed ('scientific') one; the latter always carries `relationType`/`evidence`/`sourceName`/`sourceUrl` so the UI can show exactly why the connection exists and where it came from, never just an unexplained edge. */
export interface ConceptRelation {
  id: string
  conceptAId: string
  conceptBId: string
  origin: ConceptRelationOrigin
  /** Only for origin: 'scientific' — a short, source-derived description of the relationship type (e.g. "Discussed together in peer-reviewed literature"); never a specific biological claim this app authored itself. */
  relationType?: string
  /** Only for origin: 'scientific' — the actual source text (e.g. a paper's own title) this relation is grounded in. Never invented. */
  evidence?: string
  sourceName?: string
  sourceUrl?: string
  createdAt: number
}

/**
 * Concept Hub Refinement — a per-concept asset the person creates
 * themselves: a free-text Mind Map annotation node, an imported Mind
 * Map diagram (image/PDF), or an imported custom Visual (image/PDF).
 * Deliberately NOT a ConceptRelation — 'mindmap-node' has no edge to
 * any other real Concept, so it can never be mistaken for (or leak
 * into) a Concept-to-Concept connection. Binary content lives in OPFS
 * (see core/file-storage), same pattern as LibraryItem.filePath; only
 * the logical path is stored here.
 */
export type ConceptAssetKind = 'mindmap-node' | 'mindmap-import' | 'visual-import'

export interface ConceptAsset {
  id: string
  conceptId: string
  kind: ConceptAssetKind
  /** For 'mindmap-node': the node's own free-text label. For imports: a display title (defaults to the file name). */
  label: string
  /** OPFS path — only present for 'mindmap-import'/'visual-import'. */
  filePath?: string
  /** Original MIME type — only present for 'mindmap-import'/'visual-import'; tells the viewer whether to render an <img> or the PDF viewer. */
  mimeType?: string
  createdAt: number
}

/**
 * Second Refinement §Part 1 — a real, freeform mind-map/flowchart node.
 * Deliberately a separate table from `ConceptAsset`'s 'mindmap-node'
 * kind (a plain annotation with no position): a map node has a
 * position, a shape, and can be an endpoint of a `ConceptMapEdge`,
 * none of which the old annotation model supports. `ConceptAsset`'s
 * 'mindmap-node' kind is left exactly as it was (still used by
 * anything reading historical annotation rows); new user-drawn map
 * nodes only ever go through this table.
 */
export type ConceptMapNodeShape = 'rounded' | 'rectangle' | 'circle' | 'pill' | 'diamond'
export type ConceptMapNodeAccent = 'terracotta' | 'olive' | 'sage' | 'ink'

export interface ConceptMapNode {
  id: string
  conceptId: string
  label: string
  /** Third Refinement §17 — optional, multiline, entirely the person's own words; never generated. Absent/undefined on nodes created before this field existed — treated identically to an empty description everywhere it's read (see MindMapStudio.tsx). Not part of the Dexie index string below since it's never queried on, so no schema version bump is needed to add it. */
  description?: string
  shape: ConceptMapNodeShape
  accent: ConceptMapNodeAccent
  /** Canvas-space position (not viewport pixels — independent of current zoom/pan). */
  x: number
  y: number
  createdAt: number
  updatedAt: number
}

/**
 * A connection between two `ConceptMapNode` rows belonging to the same
 * concept. `label` is the optional relationship phrase ("causes",
 * "part of", etc.) — free text, never inferred. Deleting either
 * endpoint node cascades to delete the edge (see mindMapStudio.ts).
 */
export interface ConceptMapEdge {
  id: string
  conceptId: string
  sourceNodeId: string
  targetNodeId: string
  label?: string
  createdAt: number
}

/**
 * Second Refinement §Part 2 — a user-authored study block attached to
 * one of Learn's sections. Deliberately free text the person wrote
 * themselves, never generated: this is what lets "MY STUDY NOTES"
 * coexist with (and stay visibly separate from) Cellfie's own verified
 * content in the same section — see ConceptDetailPage.tsx's rendering,
 * which always labels the two differently and never merges them.
 */
export type ConceptNoteSection = 'core-concept' | 'quick-revision' | 'exam-focus'
export type ConceptNoteBlockType =
  | 'text'
  | 'heading'
  | 'bullets'
  | 'numbered'
  | 'keyvalue'
  | 'important'
  | 'warning'
  | 'definition'
  | 'example'
  | 'formula'

export interface ConceptStudyNote {
  id: string
  conceptId: string
  section: ConceptNoteSection
  blockType: ConceptNoteBlockType
  title?: string
  /** Raw text as the person typed it. Bullets/numbered/key-value are stored as newline-separated lines and split for display — never re-parsed into anything invented. */
  content: string
  order: number
  createdAt: number
  updatedAt: number
}

/**
 * Book-First Learning Engine, Phase 2 — optional, additive personalization
 * of a Cellfie-generated Learn section. This is NOT `ConceptStudyNote`
 * (the person's own separate "My Study Notes" entries, added alongside
 * Cellfie's content) — this is the person choosing to REPLACE what's
 * displayed for one of Learn's three major sections (Quick Revision /
 * Core Concept / Exam Focus) with their own wording, while the original
 * source-derived content is preserved untouched underneath so "Restore
 * original" always works, no matter how the section was originally
 * sourced (uploaded book, curated lesson, or the MeSH/PubChem fallback).
 */
export interface ConceptSectionEdit {
  id: string
  conceptId: string
  /** Stable per (concept, major-section) — e.g. 'quick-revision', 'core-concept', 'exam-focus'. Deliberately NOT tied to which source produced the content, so an edit survives the underlying source changing (a newly-uploaded book becoming available, say) without silently vanishing or reattaching to the wrong content. */
  sectionKey: string
  /** Snapshot of the original source-derived plain text, taken once at the moment of the FIRST edit and never overwritten again — this is what "Restore original" restores, and what the original source data is; it is never itself the thing displayed unless the edit is restored. */
  originalText: string
  /** What's actually shown while this edit exists. */
  editedText: string
  createdAt: number
  updatedAt: number
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
  conceptAssets!: Table<ConceptAsset, string>
  conceptMapNodes!: Table<ConceptMapNode, string>
  conceptMapEdges!: Table<ConceptMapEdge, string>
  conceptStudyNotes!: Table<ConceptStudyNote, string>
  conceptSectionEdits!: Table<ConceptSectionEdit, string>

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
    // v5 — Concept 2.0 Phase 2: `conceptRelations` gains `origin` (plus
    // scientific-only evidence fields). Every other store is repeated
    // unchanged. The upgrade backfills every existing row's `origin` to
    // 'manual' — see the class-level doc comment above for why that's
    // the accurate label for all pre-migration rows.
    this.version(5)
      .stores({
        libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
        collections: 'id, name, createdAt',
        appSettings: 'key',
        readerBookmarks: 'id, itemId, page, createdAt',
        highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
        notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags',
        concepts: 'id, normalizedName, manuallyCreated, lastSeenAt, createdAt, *tags, *aliases',
        conceptSources:
          'id, conceptId, libraryItemId, sourceType, sourceId, createdAt, [conceptId+sourceType], [conceptId+libraryItemId]',
        conceptRelations: 'id, conceptAId, conceptBId, origin, createdAt, [conceptAId+conceptBId]'
      })
      .upgrade(async (tx) => {
        await tx
          .table('conceptRelations')
          .toCollection()
          .modify((r: Partial<ConceptRelation>) => {
            if (!r.origin) r.origin = 'manual'
          })
      })
    // v6 — Concept Hub Refinement: adds `conceptAssets` only (Mind Map
    // custom nodes/imports, Visuals custom imports — see ConceptAsset's
    // doc comment for why this is a separate table from
    // conceptRelations). Every prior store repeated unchanged; no
    // existing row in any table is touched by this upgrade.
    this.version(6).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt',
      highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
      notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags',
      concepts: 'id, normalizedName, manuallyCreated, lastSeenAt, createdAt, *tags, *aliases',
      conceptSources:
        'id, conceptId, libraryItemId, sourceType, sourceId, createdAt, [conceptId+sourceType], [conceptId+libraryItemId]',
      conceptRelations: 'id, conceptAId, conceptBId, origin, createdAt, [conceptAId+conceptBId]',
      conceptAssets: 'id, conceptId, kind, createdAt, [conceptId+kind]'
    })
    // v7 — Second Refinement: real freeform Mind Map (`conceptMapNodes`/
    // `conceptMapEdges`, replacing the old position-less annotation
    // model for anything drawn from here on) and user-authored Learn
    // blocks (`conceptStudyNotes`). Every prior store repeated
    // unchanged; no existing row in any table is touched by this
    // upgrade, and `conceptAssets`'s 'mindmap-node' kind is left alone
    // (old annotation rows keep rendering exactly as before).
    this.version(7).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt',
      highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
      notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags',
      concepts: 'id, normalizedName, manuallyCreated, lastSeenAt, createdAt, *tags, *aliases',
      conceptSources:
        'id, conceptId, libraryItemId, sourceType, sourceId, createdAt, [conceptId+sourceType], [conceptId+libraryItemId]',
      conceptRelations: 'id, conceptAId, conceptBId, origin, createdAt, [conceptAId+conceptBId]',
      conceptAssets: 'id, conceptId, kind, createdAt, [conceptId+kind]',
      conceptMapNodes: 'id, conceptId, createdAt, [conceptId+createdAt]',
      conceptMapEdges: 'id, conceptId, sourceNodeId, targetNodeId, createdAt, [conceptId+createdAt]',
      conceptStudyNotes: 'id, conceptId, section, order, createdAt, [conceptId+section]'
    })
    // v8 — Book-First Learning Engine, Phase 2: adds `conceptSectionEdits`
    // only. Every prior store repeated unchanged; no existing row in any
    // table is touched by this upgrade. A concept with no edits simply
    // has no rows here — Learn's three major sections render their
    // original source-derived content exactly as before until a person
    // explicitly saves an edit.
    this.version(8).stores({
      libraryItems: 'id, title, documentType, indexingStatus, fileHash, createdAt, *collectionIds, *tags',
      collections: 'id, name, createdAt',
      appSettings: 'key',
      readerBookmarks: 'id, itemId, page, createdAt',
      highlights: 'id, itemId, page, color, createdAt, [itemId+page]',
      notes: 'id, itemId, highlightId, pinned, favorite, createdAt, updatedAt, *tags',
      concepts: 'id, normalizedName, manuallyCreated, lastSeenAt, createdAt, *tags, *aliases',
      conceptSources:
        'id, conceptId, libraryItemId, sourceType, sourceId, createdAt, [conceptId+sourceType], [conceptId+libraryItemId]',
      conceptRelations: 'id, conceptAId, conceptBId, origin, createdAt, [conceptAId+conceptBId]',
      conceptAssets: 'id, conceptId, kind, createdAt, [conceptId+kind]',
      conceptMapNodes: 'id, conceptId, createdAt, [conceptId+createdAt]',
      conceptMapEdges: 'id, conceptId, sourceNodeId, targetNodeId, createdAt, [conceptId+createdAt]',
      conceptStudyNotes: 'id, conceptId, section, order, createdAt, [conceptId+section]',
      conceptSectionEdits: 'id, conceptId, sectionKey, updatedAt, [conceptId+sectionKey]'
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
