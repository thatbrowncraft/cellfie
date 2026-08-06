import { useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'

/**
 * Subscribes a component to a Dexie `liveQuery`, so any table write
 * (import, edit, delete) anywhere in the app re-renders every screen
 * reading that data — no manual refetch plumbing. This is the state-
 * management approach for Library/Collections data specifically; it
 * follows Dexie's own reactivity rather than introducing a separate
 * global store for what is, at this stage, straightforward CRUD data.
 */
export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial)
  const querierRef = useRef(querier)
  querierRef.current = querier

  useEffect(() => {
    const subscription = liveQuery(() => querierRef.current()).subscribe({
      next: setValue,
      error: (err) => console.error('useLiveQuery error:', err)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}
