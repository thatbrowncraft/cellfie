import { useEffect, useState } from 'react'
import { readFile } from '@/core/file-storage'
import { parseEpub, parseHtmlDocument } from '@/core/epub-engine'
import type { LibraryItem } from '@/core/db'

interface UseFlowDocumentResult {
  /** Sanitized, ready-to-render HTML per "page" (an EPUB spine item, or the whole document for a standalone HTML import). */
  pages: string[]
  loading: boolean
  error: boolean
}

/**
 * Book Reader — EPUB/HTML page-flip view. Reads a LibraryItem's EPUB or
 * HTML file back out of OPFS and parses it into per-page markup for
 * `FlowReaderView`. Deliberately separate from `documentText.ts`, which
 * covers the same files for the *concept engine* (plain text only) —
 * this hook additionally needs the sanitized HTML/inlined-image form,
 * which the concept engine has no use for. Both call into the same
 * `core/epub-engine` parser; re-parsing here rather than sharing
 * documentText's cache keeps the concept engine's cached shape (text
 * only) simple and avoids the reader holding image data in memory for a
 * book that's only ever been searched, not read.
 */
export function useFlowDocument(item: LibraryItem | undefined): UseFlowDocumentResult {
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!item || (item.format !== 'epub' && item.format !== 'html')) return

    let cancelled = false
    setLoading(true)
    setError(false)
    setPages([])

    readFile(item.filePath)
      .then(async (blob) => {
        if (item.format === 'epub') {
          const parsed = await parseEpub(blob)
          return parsed.pageHtml
        }
        const html = await blob.text()
        return [parseHtmlDocument(html).pageHtml]
      })
      .then((pageHtml) => {
        if (cancelled) return
        setPages(pageHtml)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [item])

  return { pages, loading, error }
}
