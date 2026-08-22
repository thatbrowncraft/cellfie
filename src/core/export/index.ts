/**
 * core/export — Sprint 2 §8 (Markdown notes export), extended by the
 * Module Activation + Unified Export task to cover every user-owned
 * store across Cellfie's shipped modules, not just the original Offline
 * Reader tables.
 *
 * Markdown export of notes (+ their linked highlights) is unchanged from
 * Sprint 2.
 *
 * The JSON backup is now built by walking `db.tables` directly instead
 * of naming each table by hand: every Dexie store Cellfie defines is
 * swept into the backup EXCEPT the two explicitly denylisted below (see
 * `EXCLUDED_TABLES`), so a future module's new user-data table is picked
 * up automatically the day it ships, with no edit needed in this file.
 * Both exports run entirely client-side (Blob + object URL download) —
 * no server, no network, per the offline-only constraint.
 */

import { db, type Highlight, type LibraryItem, type Note } from '../db'
import { version as appVersion } from '../../../package.json'

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Deferred revoke — some browsers need the object URL to survive past the click handler.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function timestampSlug(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** Renders one note (and, if linked, its highlight) as a Markdown section. */
function noteToMarkdown(note: Note, itemsById: Map<string, LibraryItem>, highlightsById: Map<string, Highlight>): string {
  const lines: string[] = [`## ${note.title}`, '']
  const meta: string[] = []
  if (note.itemId) {
    const book = itemsById.get(note.itemId)
    meta.push(`**Book:** ${book?.title ?? 'Unknown'}${note.page ? `, p.${note.page}` : ''}`)
  }
  if (note.tags.length) meta.push(`**Tags:** ${note.tags.map((t) => `#${t}`).join(' ')}`)
  meta.push(`**Created:** ${new Date(note.createdAt).toLocaleDateString()}`)
  if (meta.length) {
    lines.push(meta.join('  \n'), '')
  }
  if (note.highlightId) {
    const h = highlightsById.get(note.highlightId)
    if (h) lines.push(`> ${h.text.trim().replace(/\n+/g, ' ')}`, '')
  }
  lines.push(note.contentMarkdown.trim() || '*(empty)*', '', '---', '')
  return lines.join('\n')
}

/** Exports the given notes (default: all) as a single Markdown file. */
export async function exportNotesAsMarkdown(notes?: Note[]): Promise<void> {
  const [allNotes, items, highlights] = await Promise.all([
    notes ? Promise.resolve(notes) : db.notes.orderBy('createdAt').toArray(),
    db.libraryItems.toArray(),
    db.highlights.toArray()
  ])
  const itemsById = new Map(items.map((i) => [i.id, i]))
  const highlightsById = new Map(highlights.map((h) => [h.id, h]))

  const sorted = [...allNotes].sort((a, b) => b.updatedAt - a.updatedAt)
  const body = [
    '# Cellfie Notes Export',
    '',
    `_Exported ${new Date().toLocaleString()} — ${sorted.length} note${sorted.length === 1 ? '' : 's'}._`,
    '',
    ...sorted.map((n) => noteToMarkdown(n, itemsById, highlightsById))
  ].join('\n')

  downloadBlob(`cellfie-notes-${timestampSlug()}.md`, new Blob([body], { type: 'text/markdown' }))
}

/**
 * Dexie stores that exist on `db` but are deliberately never part of the
 * user-facing JSON backup:
 *
 * - `appSettings` — despite the name, every row actually written to this
 *   table today is an internal cache / derived-state marker: concept
 *   extraction metadata, per-page relevance/extraction-quality cache,
 *   the Learn "study overview" cache, cleanup/purge run markers, the
 *   Organism Explorer Knowledge-Layer lookup cache, and taxonomy
 *   resolution cache (see core/concepts/extraction.ts,
 *   core/concepts/service.ts, core/organisms/knowledgeLayer.ts,
 *   core/organisms/taxonomyResolution.ts, core/organisms/recentlyViewed.ts).
 *   None of it is data the user created or would recognize as "theirs" —
 *   including it would bloat the backup with re-derivable engine state,
 *   exactly the "temporary scanning state" the brief says to leave out.
 *   The genuinely user-facing preferences (theme, large text, reader
 *   navigation mode) live in localStorage, not this table, and are
 *   exported separately below as `preferences`.
 * - `organismImageBlobs` — raw image `Blob` bytes (the IndexedDB
 *   fallback path for a custom organism image upload, used only when
 *   OPFS is unavailable). Blobs aren't meaningfully JSON-serializable,
 *   and embedding them would make the backup huge for no benefit — the
 *   same reasoning the brief gives for never embedding raw PDF/EPUB
 *   files.
 */
const EXCLUDED_TABLES = new Set<string>(['appSettings', 'organismImageBlobs'])

/**
 * Per-table field stripping — removes fields that are only meaningful as
 * an OPFS path or an internal blob-table key on THIS device (the same
 * reasoning as the original `libraryItems` filePath/thumbnailPath
 * omission, extended to the two other tables that hold the same kind of
 * device-local reference: `ConceptAsset.filePath` for imported Mind
 * Map/Visual files, `OrganismImage.filePath`/`blobId` for custom organism
 * images). Every other field of every other table is exported as-is.
 */
const FIELD_STRIPPERS: Record<string, (row: Record<string, unknown>) => Record<string, unknown>> = {
  libraryItems: ({ filePath: _filePath, thumbnailPath: _thumbnailPath, ...rest }) => rest,
  conceptAssets: ({ filePath: _filePath, ...rest }) => rest,
  organismImages: ({ filePath: _filePath, blobId: _blobId, ...rest }) => rest
}

/** localStorage keys behind Settings' real, working preference controls (theme mode, large text, reader page-navigation) — see core/theme and core/reader-settings. */
const PREFERENCE_KEYS = ['cellfie:theme-mode', 'cellfie:large-text', 'cellfie:reader-navigation-mode'] as const

function readLocalPreferences(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof window === 'undefined') return out
  for (const key of PREFERENCE_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}

interface JsonBackup {
  format: 'cellfie-backup'
  version: 2
  exportedAt: number
  appVersion: string
  /**
   * Theme/reader preferences from localStorage — see PREFERENCE_KEYS.
   * Not the same thing as "module visibility preferences": no such
   * per-module toggle is actually persisted anywhere yet (Settings'
   * Modules list is a status display, not a saved per-user setting —
   * see src/config/modules.ts), so nothing is invented here for it.
   */
  preferences: Record<string, string>
  /**
   * One array per included Dexie store, keyed by table name — see
   * `EXCLUDED_TABLES`/`FIELD_STRIPPERS` above for what's left out or
   * trimmed, and why. Records reference each other by id (e.g. a
   * Concept's `conceptSources` row points at a `libraryItemId` rather
   * than embedding the book) exactly as they already do in the live
   * database, so nothing is duplicated across stores.
   */
  data: Record<string, unknown[]>
}

/**
 * Exports every user-owned structured record Cellfie currently persists
 * — across the Offline Reader, Study Tools, Concept Explorer/Learn,
 * Organism Explorer, and any other shipped module with its own Dexie
 * store — as a single versioned JSON file. Deliberately omits OPFS-only
 * paths/blob keys (see `FIELD_STRIPPERS`) and internal cache/binary
 * tables (see `EXCLUDED_TABLES`); this is a metadata + user-content
 * backup, not a full binary re-importer.
 */
export async function exportJsonBackup(): Promise<void> {
  const tables = db.tables.filter((t) => !EXCLUDED_TABLES.has(t.name))
  const rows = await Promise.all(tables.map((t) => t.toArray()))

  const data: Record<string, unknown[]> = {}
  tables.forEach((table, i) => {
    const strip = FIELD_STRIPPERS[table.name]
    data[table.name] = strip ? rows[i].map((row) => strip(row as Record<string, unknown>)) : rows[i]
  })

  const backup: JsonBackup = {
    format: 'cellfie-backup',
    version: 2,
    exportedAt: Date.now(),
    appVersion,
    preferences: readLocalPreferences(),
    data
  }

  downloadBlob(
    `cellfie-backup-${timestampSlug()}.json`,
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  )
}
