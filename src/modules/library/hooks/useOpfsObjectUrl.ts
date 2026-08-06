import { useEffect, useState } from 'react'
import { readFile } from '@/core/file-storage'

/**
 * Loads the file at an OPFS path into a blob: object URL for <img>/<a>
 * use, and revokes it on unmount or path change so we don't leak memory
 * across a long library-browsing session.
 */
export function useOpfsObjectUrl(path?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!path) {
      setUrl(undefined)
      return
    }
    let cancelled = false
    let createdUrl: string | undefined

    readFile(path)
      .then((blob) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setUrl(createdUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [path])

  return url
}
