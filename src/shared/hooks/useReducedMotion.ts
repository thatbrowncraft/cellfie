import { useMediaQuery } from './useMediaQuery'

/** Respects prefers-reduced-motion app-wide (Design System §12, §13). */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
