import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/**
 * Text-size control (§13 accessibility, extended from a binary "Large
 * text" toggle to a 5-level scale). 3 is the ordinary Cellfie default —
 * exactly what the app has always looked like — and is the level every
 * user starts on. 4 is the old "Large text" ON state (~1.18×), kept
 * so nothing already-shipped changes size. 1/2 sit below default, 5
 * sits above 4.
 */
export type TextSizeLevel = 1 | 2 | 3 | 4 | 5

const STORAGE_KEY = 'cellfie:theme-mode'
const TEXT_SIZE_KEY = 'cellfie:text-size'
/** Pre-5-level-control key. Only ever read now, for one-time migration. */
const LEGACY_LARGE_TEXT_KEY = 'cellfie:large-text'
const DEFAULT_TEXT_SIZE: TextSizeLevel = 3

interface ThemeContextValue {
  /** The mode the user picked: 'system' | 'light' | 'dark' */
  mode: ThemeMode
  /** The theme actually applied to the DOM right now, after resolving 'system' */
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  textSize: TextSizeLevel
  setTextSize: (value: TextSizeLevel) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function readStoredTextSize(): TextSizeLevel {
  if (typeof window === 'undefined') return DEFAULT_TEXT_SIZE
  const stored = Number(window.localStorage.getItem(TEXT_SIZE_KEY))
  if (stored === 1 || stored === 2 || stored === 3 || stored === 4 || stored === 5) return stored
  // One-time migration: someone with the old binary toggle switched ON
  // lands on the equivalent new level (4 = the old "Large text" state)
  // instead of silently resetting to default.
  if (window.localStorage.getItem(LEGACY_LARGE_TEXT_KEY) === 'true') return 4
  return DEFAULT_TEXT_SIZE
}

/**
 * Cellfie's theme system.
 * Supports System / Manual Light / Manual Dark (Design System §1, §11).
 * Preference persists locally (no account, no cloud — per product philosophy).
 * Switching animates surface/text tokens via CSS transitions in index.css,
 * never a jarring flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const [textSize, setTextSizeState] = useState<TextSizeLevel>(readStoredTextSize)

  const resolvedTheme: ResolvedTheme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', String(textSize))
  }, [textSize])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const setTextSize = useCallback((value: TextSizeLevel) => {
    setTextSizeState(value)
    window.localStorage.setItem(TEXT_SIZE_KEY, String(value))
  }, [])

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, textSize, setTextSize }),
    [mode, resolvedTheme, setMode, textSize, setTextSize]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
