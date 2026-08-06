import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'cellfie:theme-mode'
const LARGE_TEXT_KEY = 'cellfie:large-text'

interface ThemeContextValue {
  /** The mode the user picked: 'system' | 'light' | 'dark' */
  mode: ThemeMode
  /** The theme actually applied to the DOM right now, after resolving 'system' */
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  largeText: boolean
  setLargeText: (value: boolean) => void
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

function readStoredLargeText(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(LARGE_TEXT_KEY) === 'true'
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
  const [largeText, setLargeTextState] = useState<boolean>(readStoredLargeText)

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
    document.documentElement.setAttribute('data-large-text', String(largeText))
  }, [largeText])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const setLargeText = useCallback((value: boolean) => {
    setLargeTextState(value)
    window.localStorage.setItem(LARGE_TEXT_KEY, String(value))
  }, [])

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, largeText, setLargeText }),
    [mode, resolvedTheme, setMode, largeText, setLargeText]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
