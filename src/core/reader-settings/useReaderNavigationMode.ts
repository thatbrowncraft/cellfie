import { useCallback, useEffect, useState } from 'react'
import {
  getReaderNavigationMode,
  setReaderNavigationMode,
  subscribeReaderNavigationMode,
  type ReaderNavigationMode
} from './readerNavigationMode'

/**
 * Universal reader page-navigation preference (Swipe / Scroll). Same shape
 * as core/theme's useTheme — reads the persisted value on mount, exposes a
 * setter that persists + updates state, and stays in sync if changed
 * elsewhere (e.g. Settings changed while a ReaderPage is already open).
 */
export function useReaderNavigationMode(): [ReaderNavigationMode, (mode: ReaderNavigationMode) => void] {
  const [mode, setMode] = useState<ReaderNavigationMode>(getReaderNavigationMode)

  useEffect(() => subscribeReaderNavigationMode(setMode), [])

  const update = useCallback((next: ReaderNavigationMode) => {
    setReaderNavigationMode(next)
    setMode(next)
  }, [])

  return [mode, update]
}
