import { useEffect, type RefObject } from 'react'

/** Fires a callback when a pointer or focus event occurs outside the given ref. */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  onOutside: () => void,
  active = true
) {
  useEffect(() => {
    if (!active) return

    function handlePointer(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
    }
  }, [ref, onOutside, active])
}
