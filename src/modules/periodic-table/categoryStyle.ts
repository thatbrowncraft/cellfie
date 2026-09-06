import type { CSSProperties } from 'react'
import type { ElementCategory } from '../../core/periodic-table/types'

/**
 * Visual treatment per element category — reuses only the six existing
 * theme accent/status colors (olive, sage, terracotta, success,
 * warning, error) rather than introducing new hues (brief §20). Ten
 * categories from six colors means two pairs double up on hue; each
 * pair is told apart by `mode` (filled vs outline) so no two
 * categories render identically.
 *
 * Accessibility (brief §23): color is never the only signal — every
 * cell also shows a short category code and the category's full name
 * is always available via `aria-label`/tooltip, so the table stays
 * legible with category colors switched off or unavailable.
 */
export interface CategoryStyle {
  code: string
  cssVar: string
  mode: 'filled' | 'outline'
}

export const CATEGORY_STYLES: Record<ElementCategory, CategoryStyle> = {
  'alkali-metal': { code: 'AM', cssVar: '--color-highlight-terracotta', mode: 'filled' },
  'alkaline-earth-metal': { code: 'AE', cssVar: '--color-warning', mode: 'filled' },
  'transition-metal': { code: 'TM', cssVar: '--color-accent-olive', mode: 'filled' },
  'post-transition-metal': { code: 'PT', cssVar: '--color-accent-sage', mode: 'filled' },
  metalloid: { code: 'ML', cssVar: '--color-border-strong', mode: 'filled' },
  nonmetal: { code: 'NM', cssVar: '--color-success', mode: 'filled' },
  halogen: { code: 'HA', cssVar: '--color-error', mode: 'filled' },
  'noble-gas': { code: 'NG', cssVar: '--color-accent-sage', mode: 'outline' },
  lanthanide: { code: 'LA', cssVar: '--color-accent-olive', mode: 'outline' },
  actinide: { code: 'AC', cssVar: '--color-highlight-terracotta', mode: 'outline' }
}

export function categoryCellStyle(category: ElementCategory): CSSProperties {
  const s = CATEGORY_STYLES[category]
  const color = `var(${s.cssVar})`
  if (s.mode === 'filled') {
    return {
      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
      borderColor: `color-mix(in srgb, ${color} 55%, transparent)`
    }
  }
  return {
    backgroundColor: 'transparent',
    borderColor: color,
    borderStyle: 'dashed'
  }
}

export function categoryAccentColor(category: ElementCategory): string {
  return `var(${CATEGORY_STYLES[category].cssVar})`
}
