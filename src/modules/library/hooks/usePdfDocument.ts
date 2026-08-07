import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { readFile } from '@/core/file-storage'
import { loadPdfDocument } from '@/core/pdf-engine'

interface UsePdfDocumentResult {
  doc: PDFDocumentProxy | null
  numPages: number | null
  loading: boolean
  error: boolean
}

/**
 * Reads a LibraryItem's PDF back out of OPFS and opens it as a PDF.js
 * document for the reader. Destroys the previous document on path change
 * or unmount so PDF.js releases its worker-side resources for the file
 * we're no longer viewing.
 */
export function usePdfDocument(filePath: string | undefined): UsePdfDocumentResult {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!filePath) return

    let cancelled = false
    setLoading(true)
    setError(false)

    readFile(filePath)
      .then((blob) => loadPdfDocument(blob))
      .then((loadedDoc) => {
        if (cancelled) {
          void loadedDoc.destroy()
          return
        }
        setDoc(loadedDoc)
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
  }, [filePath])

  // Destroy the previously-loaded document whenever it's replaced or the
  // hook unmounts — separate effect so it fires on `doc` itself, not on
  // every filePath change (avoids destroying a doc we haven't set yet).
  useEffect(() => {
    const toDestroy = doc
    return () => {
      void toDestroy?.destroy()
    }
  }, [doc])

  return { doc, numPages: doc?.numPages ?? null, loading, error }
}
