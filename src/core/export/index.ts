/**
 * core/export — Sprint 2 §8. Markdown export of notes (+ their linked
 * highlights) and a full JSON backup of every structured record Cellfie
 * knows about. Both run entirely client-side (Blob + object URL
 * download) — no server, no network, per the offline-only constraint.
 * PDF export is explicitly "(later)" per the brief and isn't implemented.
 */

import { db, type Collection, type Highlight, type LibraryItem, type Note, type ReaderBookmark } from '../db'

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

interface JsonBackup {
  version: 1
  exportedAt: number
  libraryItems: Omit<LibraryItem, 'filePath' | 'thumbnailPath'>[]
  collections: Collection[]
  highlights: Highlight[]
  notes: Note[]
  readerBookmarks: ReaderBookmark[]
}

/**
 * Exports every structured record as JSON. Deliberately omits `filePath`/
 * `thumbnailPath` (OPFS-internal paths, meaningless outside this origin)
 * and the binary PDFs/thumbnails themselves — this is a metadata +
 * notes/highlights backup, not a full library re-importer.
 */
export async function exportJsonBackup(): Promise<void> {
  const [items, collections, highlights, notes, readerBookmarks] = await Promise.all([
    db.libraryItems.toArray(),
    db.collections.toArray(),
    db.highlights.toArray(),
    db.notes.toArray(),
    db.readerBookmarks.toArray()
  ])

  const backup: JsonBackup = {
    version: 1,
    exportedAt: Date.now(),
    libraryItems: items.map(({ filePath: _filePath, thumbnailPath: _thumbnailPath, ...rest }) => rest),
    collections,
    highlights,
    notes,
    readerBookmarks
  }

  downloadBlob(`cellfie-backup-${timestampSlug()}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
}
