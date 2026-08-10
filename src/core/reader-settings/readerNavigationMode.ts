export type ReaderNavigationMode = 'swipe' | 'scroll'

const STORAGE_KEY = 'cellfie:reader-navigation-mode'
// Fired whenever the preference changes so any open ReaderPage picks it up
// immediately, even though this isn't wired through React context — same
// "localStorage + event" pattern would be used if this needed cross-tab
// sync; here it just keeps this single tab's reader + settings in lockstep.
const CHANGE_EVENT = 'cellfie:reader-navigation-mode-change'

/**
 * Reader page-navigation preference: Swipe (default, existing horizontal
 * swipe-to-turn-page behavior) or Scroll (vertical drag reads down the
 * current page; swipe-to-turn-page is disabled).
 *
 * Persisted the same way theme mode / large text are (§ core/theme) —
 * plain localStorage, universal across every book, never per-PDF.
 */
export function getReaderNavigationMode(): ReaderNavigationMode {
  if (typeof window === 'undefined') return 'swipe'
  return window.localStorage.getItem(STORAGE_KEY) === 'scroll' ? 'scroll' : 'swipe'
}

export function setReaderNavigationMode(mode: ReaderNavigationMode): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, mode)
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: mode }))
}

export function subscribeReaderNavigationMode(onChange: (mode: ReaderNavigationMode) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handleCustom = () => onChange(getReaderNavigationMode())
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange(getReaderNavigationMode())
  }
  window.addEventListener(CHANGE_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}
