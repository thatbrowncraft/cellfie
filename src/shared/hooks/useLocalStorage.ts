import { useCallback, useState } from 'react'

/** Small typed localStorage-backed state hook, used for session-local UI prefs. */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // storage unavailable (private mode, quota) — fail silently, keep in-memory value
        }
        return resolved
      })
    },
    [key]
  )

  return [value, setStoredValue] as const
}
