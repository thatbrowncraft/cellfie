import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus inside a container while `active` is true, and
 * returns focus to the previously-focused element on deactivation.
 * Used by Dialogs, Bottom Sheets, and the universal Search overlay (§10.19).
 */
export function useFocusTrap<T extends HTMLElement>(ref: RefObject<T>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = ref.current
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusables[0]?.focus()

    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeydown)
    return () => {
      container.removeEventListener('keydown', handleKeydown)
      previouslyFocused?.focus()
    }
  }, [ref, active])
}
