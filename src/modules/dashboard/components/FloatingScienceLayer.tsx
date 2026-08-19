import { useReducedMotion } from '../../../shared/hooks'

/**
 * FloatingScienceLayer — Dashboard-only ambient decoration (requested
 * dashboard change #9/#10, later densified/diversified/spread on
 * request). A large, varied field of small, low-opacity scientific
 * motifs — DNA helices, molecular structures, microorganisms/cells,
 * microscope and petri-dish silhouettes, flasks, books, formula
 * glyphs, measurement tick marks, dots, and occasional sparkles —
 * drifting very slowly behind the real content, spread across the
 * full height of the Dashboard rather than clustered near the top.
 *
 * Deliberately NOT a shared/layouts change — DashboardLayout is reused
 * by Library/Concepts/Organism Explorer too, so this component is only
 * ever mounted from modules/dashboard/DashboardPage.tsx, keeping the
 * effect scoped to the Dashboard as requested.
 *
 * Purely decorative: `pointer-events-none` on the outer layer and every
 * child, `aria-hidden`, and it never renders text a screen reader would
 * announce. `overflow-hidden` on the parent (set by DashboardPage) keeps
 * it from ever causing horizontal scroll on narrow/mobile viewports.
 * Respects prefers-reduced-motion by rendering the same shapes
 * completely still instead of skipping them — the ambient texture stays,
 * the motion doesn't. Opacity is kept low (mostly 0.05–0.16, a touch
 * higher only for the smallest dots) and movement very slow (18–34s per
 * cycle) so density reads as texture, not noise.
 */

interface FloatingItem {
  id: string
  /** Position as percentages of the container, so it scales with content height instead of using fixed pixels. */
  top: string
  left: string
  size: number
  /** Tailwind color utility class — kept within the existing palette. */
  colorClassName: string
  opacity: number
  /** Animation duration in seconds; slightly varied so shapes don't move in lockstep. Kept slow throughout. */
  duration: number
  delay: number
  motion?: 'drift' | 'sway' | 'pulse'
  kind:
    | 'helix'
    | 'hexagon'
    | 'flask'
    | 'atom'
    | 'dot'
    | 'formula'
    | 'sparkle'
    | 'glassware'
    | 'cell'
    | 'microscope'
    | 'petri'
    | 'book'
    | 'measurement'
  label?: string
}

// Spread deliberately across the full 0–98% of both axes, in loose bands
// (top strip, upper-mid, mid, lower-mid, bottom) so the field reads as
// distributed across the whole Dashboard rather than concentrated near
// the header. Sizes, opacities, and durations are varied item-to-item
// so nothing repeats in an obviously tiled way.
const ITEMS: FloatingItem[] = [
  // — top band —
  { id: 'helix-1', top: '3%', left: '88%', size: 34, colorClassName: 'text-olive', opacity: 0.1, duration: 24, delay: 0, motion: 'drift', kind: 'helix' },
  { id: 'hex-1', top: '5%', left: '6%', size: 26, colorClassName: 'text-sage', opacity: 0.09, duration: 22, delay: 1.5, motion: 'sway', kind: 'hexagon' },
  { id: 'formula-1', top: '2%', left: '42%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.12, duration: 26, delay: 1.2, motion: 'drift', kind: 'formula', label: 'H₂O' },
  { id: 'dot-1', top: '9%', left: '26%', size: 5, colorClassName: 'text-ink-tertiary', opacity: 0.22, duration: 18, delay: 0.4, motion: 'drift', kind: 'dot' },
  { id: 'sparkle-1', top: '7%', left: '64%', size: 13, colorClassName: 'text-terracotta', opacity: 0.12, duration: 20, delay: 0.3, motion: 'pulse', kind: 'sparkle' },
  { id: 'measurement-1', top: '11%', left: '96%', size: 20, colorClassName: 'text-ink-tertiary', opacity: 0.11, duration: 28, delay: 2, motion: 'drift', kind: 'measurement' },

  // — upper-mid band —
  { id: 'flask-1', top: '20%', left: '94%', size: 24, colorClassName: 'text-terracotta', opacity: 0.1, duration: 21, delay: 0.5, motion: 'sway', kind: 'flask' },
  { id: 'cell-1', top: '18%', left: '16%', size: 20, colorClassName: 'text-sage', opacity: 0.1, duration: 25, delay: 1, motion: 'pulse', kind: 'cell' },
  { id: 'dot-2', top: '24%', left: '40%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.24, duration: 19, delay: 0, motion: 'drift', kind: 'dot' },
  { id: 'formula-2', top: '17%', left: '55%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.11, duration: 27, delay: 1.8, motion: 'drift', kind: 'formula', label: 'DNA' },
  { id: 'book-1', top: '26%', left: '3%', size: 22, colorClassName: 'text-olive', opacity: 0.08, duration: 23, delay: 0.9, motion: 'sway', kind: 'book' },
  { id: 'petri-1', top: '15%', left: '76%', size: 22, colorClassName: 'text-sage', opacity: 0.09, duration: 24, delay: 2.4, motion: 'drift', kind: 'petri' },

  // — middle band —
  { id: 'atom-1', top: '38%', left: '4%', size: 30, colorClassName: 'text-olive', opacity: 0.08, duration: 29, delay: 2, motion: 'sway', kind: 'atom' },
  { id: 'formula-3', top: '42%', left: '88%', size: 13, colorClassName: 'text-ink-tertiary', opacity: 0.13, duration: 22, delay: 0.6, motion: 'drift', kind: 'formula', label: 'RNA' },
  { id: 'sparkle-2', top: '35%', left: '68%', size: 11, colorClassName: 'text-terracotta', opacity: 0.13, duration: 18, delay: 1.6, motion: 'pulse', kind: 'sparkle' },
  { id: 'dot-3', top: '46%', left: '22%', size: 4, colorClassName: 'text-ink-tertiary', opacity: 0.2, duration: 20, delay: 2.5, motion: 'drift', kind: 'dot' },
  { id: 'microscope-1', top: '40%', left: '48%', size: 22, colorClassName: 'text-olive', opacity: 0.08, duration: 26, delay: 1.1, motion: 'sway', kind: 'microscope' },
  { id: 'hex-2', top: '48%', left: '92%', size: 18, colorClassName: 'text-sage', opacity: 0.08, duration: 25, delay: 0.7, motion: 'sway', kind: 'hexagon' },
  { id: 'cell-2', top: '33%', left: '30%', size: 14, colorClassName: 'text-terracotta', opacity: 0.09, duration: 21, delay: 1.9, motion: 'pulse', kind: 'cell' },

  // — lower-mid band —
  { id: 'formula-4', top: '58%', left: '8%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.12, duration: 28, delay: 0.2, motion: 'drift', kind: 'formula', label: 'pH 7' },
  { id: 'glass-1', top: '55%', left: '96%', size: 22, colorClassName: 'text-olive', opacity: 0.08, duration: 23, delay: 0.6, motion: 'sway', kind: 'glassware' },
  { id: 'dot-4', top: '62%', left: '54%', size: 5, colorClassName: 'text-ink-tertiary', opacity: 0.22, duration: 17, delay: 1, motion: 'drift', kind: 'dot' },
  { id: 'sparkle-3', top: '65%', left: '36%', size: 10, colorClassName: 'text-sage', opacity: 0.13, duration: 19, delay: 2.1, motion: 'pulse', kind: 'sparkle' },
  { id: 'petri-2', top: '60%', left: '18%', size: 18, colorClassName: 'text-terracotta', opacity: 0.09, duration: 27, delay: 1.4, motion: 'drift', kind: 'petri' },
  { id: 'formula-5', top: '68%', left: '78%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.11, duration: 24, delay: 0.5, motion: 'drift', kind: 'formula', label: 'PCR' },
  { id: 'measurement-2', top: '52%', left: '2%', size: 18, colorClassName: 'text-ink-tertiary', opacity: 0.1, duration: 26, delay: 1.7, motion: 'drift', kind: 'measurement' },

  // — bottom band —
  { id: 'helix-2', top: '82%', left: '90%', size: 28, colorClassName: 'text-sage', opacity: 0.09, duration: 30, delay: 0.3, motion: 'drift', kind: 'helix' },
  { id: 'hex-3', top: '92%', left: '46%', size: 20, colorClassName: 'text-sage', opacity: 0.08, duration: 25, delay: 2.2, motion: 'sway', kind: 'hexagon' },
  { id: 'formula-6', top: '78%', left: '10%', size: 13, colorClassName: 'text-ink-tertiary', opacity: 0.13, duration: 21, delay: 0.8, motion: 'drift', kind: 'formula', label: 'E = mc²' },
  { id: 'sparkle-4', top: '90%', left: '82%', size: 10, colorClassName: 'text-terracotta', opacity: 0.14, duration: 18, delay: 1.8, motion: 'pulse', kind: 'sparkle' },
  { id: 'cell-3', top: '86%', left: '28%', size: 18, colorClassName: 'text-olive', opacity: 0.09, duration: 24, delay: 1.3, motion: 'pulse', kind: 'cell' },
  { id: 'dot-5', top: '95%', left: '62%', size: 5, colorClassName: 'text-ink-tertiary', opacity: 0.2, duration: 20, delay: 0.9, motion: 'drift', kind: 'dot' },
  { id: 'book-2', top: '96%', left: '4%', size: 20, colorClassName: 'text-terracotta', opacity: 0.08, duration: 29, delay: 2.6, motion: 'sway', kind: 'book' },
  { id: 'flask-2', top: '75%', left: '58%', size: 18, colorClassName: 'text-olive', opacity: 0.09, duration: 22, delay: 1.5, motion: 'sway', kind: 'flask' },
  { id: 'dot-6', top: '88%', left: '48%', size: 4, colorClassName: 'text-ink-tertiary', opacity: 0.18, duration: 19, delay: 2.3, motion: 'drift', kind: 'dot' }
]

function ShapeGlyph({ item }: { item: FloatingItem }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
    case 'helix':
      return (
        <svg width={item.size} height={item.size * 1.8} viewBox="0 0 24 42" fill="none" {...common}>
          <path
            d="M2 2c6 4 14 4 20 8M2 12c6 4 14 4 20 8M2 22c6 4 14 4 20 8M2 32c6 4 14 4 20 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'hexagon':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'flask':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M10 2h4M9 2v6l-5.4 9.6A2 2 0 0 0 5.3 21h13.4a2 2 0 0 0 1.7-3.4L15 8V2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M7.5 14.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'atom':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="currentColor" strokeWidth="1.2" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="currentColor" strokeWidth="1.2" transform="rotate(120 12 12)" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      )
    case 'glassware':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M8 2h8M9 2v5.2a5 8 0 0 0-2.6 6.4C6.9 17.6 9.2 21 12 21s5.1-3.4 4.6-7.4A5 8 0 0 0 15 7.2V2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'sparkle':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M12 2 L13.6 9.4 21 11 13.6 12.6 12 20 10.4 12.6 3 11 10.4 9.4 Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'cell':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M12 3c4.5 0 8.2 2.6 9 6.6.5 2.5-.7 4.7-2.8 6.3-2.1 1.6-3.6 3.9-6.2 4-2.9.2-5.6-1.6-7.1-4C3.3 13.7 3 11 4.4 8.6 5.9 6 8.7 3 12 3Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="12.5" cy="11" r="2" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="8" cy="8.5" r="0.9" fill="currentColor" />
          <circle cx="16" cy="13.5" r="0.7" fill="currentColor" />
        </svg>
      )
    case 'microscope':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 20 24" fill="none" {...common}>
          <path
            d="M9 2v3M9 5c2.2 0 3.6 1.6 3.6 3.4 0 1.1-.5 2-1.3 2.7l3.2 3.6M6.6 8.4h4.8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M8 11.7 3.4 17c-.6.7-.5 1.8.3 2.3.6.4 1.4.4 2-.1l5-4.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path d="M4 21h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M13 21c1-2.4 1-4.6 0-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )
    case 'petri':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <ellipse cx="12" cy="10" rx="9" ry="4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10v3c0 2.2 4 4 9 4s9-1.8 9-4v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="9" cy="9.5" r="0.8" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="0.6" fill="currentColor" />
          <circle cx="12" cy="8.5" r="0.5" fill="currentColor" />
        </svg>
      )
    case 'book':
      return (
        <svg width={item.size} height={item.size * 0.78} viewBox="0 0 24 19" fill="none" {...common}>
          <path
            d="M12 3.5C10 2 6.8 1.5 3 2v13c3.8-.5 7 0 9 1.5M12 3.5C14 2 17.2 1.5 21 2v13c-3.8-.5-7 0-9 1.5M12 3.5v13"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'measurement':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 40 20" fill="none" {...common}>
          <path
            d="M1 4v12M9 8v8M17 2v14M25 8v8M33 4v12M1 10h32"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'dot':
      return (
        <span
          className={`${item.colorClassName} block rounded-full`}
          style={{ width: item.size, height: item.size, opacity: item.opacity, backgroundColor: 'currentColor' }}
        />
      )
    case 'formula':
      return (
        <span
          className={`${item.colorClassName} font-mono whitespace-nowrap`}
          style={{ fontSize: item.size, opacity: item.opacity }}
        >
          {item.label}
        </span>
      )
    default:
      return null
  }
}

export function FloatingScienceLayer() {
  const reducedMotion = useReducedMotion()

  const animationName: Record<NonNullable<FloatingItem['motion']>, string> = {
    drift: 'cellfie-float-drift',
    sway: 'cellfie-float-sway',
    pulse: 'cellfie-float-pulse'
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-float-drift {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-12px) translateX(5px); }
        }
        @keyframes cellfie-float-sway {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(9px) rotate(7deg); }
        }
        @keyframes cellfie-float-pulse {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.08); }
        }
      `}</style>
      {ITEMS.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            top: item.top,
            left: item.left,
            animation: reducedMotion
              ? undefined
              : `${animationName[item.motion ?? 'drift']} ${item.duration}s ease-in-out ${item.delay}s infinite`
          }}
        >
          <ShapeGlyph item={item} />
        </div>
      ))}
    </div>
  )
}
