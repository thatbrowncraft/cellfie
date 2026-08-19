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
    | 'dividingCell'
    | 'microbe'
    | 'dnaStrand'
  label?: string
}

// Spread deliberately across the full 0–98% of both axes, in loose bands
// (top strip, upper-mid, mid, lower-mid, bottom) so the field reads as
// distributed across the whole Dashboard rather than concentrated near
// the header. Sizes, opacities, and durations are varied item-to-item
// so nothing repeats in an obviously tiled way.
const ITEMS: FloatingItem[] = [
  // — TOP SECTION (0% – 30%) —
  { id: 'dna-strand-1', top: '8%', left: '88%', size: 28, colorClassName: 'text-olive', opacity: 0.38, duration: 16, delay: 0, motion: 'drift', kind: 'dnaStrand' },
  { id: 'microbe-1', top: '12%', left: '3%', size: 26, colorClassName: 'text-sage', opacity: 0.35, duration: 14, delay: 1, motion: 'sway', kind: 'microbe' },
  { id: 'eq-hardy-weinberg', top: '7%', left: '46%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.4, duration: 18, delay: 0.5, motion: 'drift', kind: 'formula', label: 'p² + 2pq + q² = 1' },
  { id: 'dividing-cell-1', top: '16%', left: '26%', size: 24, colorClassName: 'text-terracotta', opacity: 0.38, duration: 15, delay: 0.2, motion: 'pulse', kind: 'dividingCell' },
  { id: 'sparkle-1', top: '10%', left: '72%', size: 14, colorClassName: 'text-terracotta', opacity: 0.38, duration: 13, delay: 0.8, motion: 'pulse', kind: 'sparkle' },
  { id: 'dot-1', top: '22%', left: '94%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.45, duration: 12, delay: 0.3, motion: 'drift', kind: 'dot' },

  // — MID SECTION (30% – 60%) —
  { id: 'eq-michaelis-menten', top: '28%', left: '78%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.4, duration: 17, delay: 1.2, motion: 'drift', kind: 'formula', label: 'v = Vmax[S] / (Km + [S])' },
  { id: 'flask-1', top: '32%', left: '88%', size: 26, colorClassName: 'text-terracotta', opacity: 0.35, duration: 15, delay: 0.3, motion: 'sway', kind: 'flask' },
  { id: 'microbe-2', top: '26%', left: '4%', size: 24, colorClassName: 'text-sage', opacity: 0.35, duration: 15, delay: 0.7, motion: 'sway', kind: 'microbe' },
  { id: 'dna-strand-2', top: '36%', left: '48%', size: 26, colorClassName: 'text-olive', opacity: 0.36, duration: 18, delay: 1.8, motion: 'drift', kind: 'dnaStrand' },
  { id: 'dividing-cell-2', top: '46%', left: '3%', size: 26, colorClassName: 'text-sage', opacity: 0.38, duration: 16, delay: 0.4, motion: 'pulse', kind: 'dividingCell' },
  { id: 'eq-gibbs', top: '50%', left: '85%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.38, duration: 14, delay: 0.9, motion: 'drift', kind: 'formula', label: 'ΔG = ΔH - TΔS' },
  { id: 'microbe-3', top: '44%', left: '50%', size: 24, colorClassName: 'text-olive', opacity: 0.35, duration: 13, delay: 1.4, motion: 'sway', kind: 'microbe' },
  { id: 'atom-1', top: '54%', left: '18%', size: 28, colorClassName: 'text-olive', opacity: 0.32, duration: 20, delay: 0.2, motion: 'sway', kind: 'atom' },

  // — DENSE LOWER & BOTTOM SECTION (60% – 98%) —
  { id: 'eq-ph', top: '64%', left: '4%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.4, duration: 18, delay: 0.1, motion: 'drift', kind: 'formula', label: 'pH = -log[H⁺]' },
  { id: 'dna-strand-3', top: '62%', left: '92%', size: 26, colorClassName: 'text-sage', opacity: 0.36, duration: 15, delay: 1.3, motion: 'drift', kind: 'dnaStrand' },
  { id: 'dividing-cell-3', top: '68%', left: '48%', size: 25, colorClassName: 'text-terracotta', opacity: 0.38, duration: 17, delay: 0.8, motion: 'pulse', kind: 'dividingCell' },
  { id: 'eq-glucose', top: '72%', left: '74%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.38, duration: 16, delay: 1.0, motion: 'drift', kind: 'formula', label: 'C₆H₁₂O₆ + 6O₂' },
  { id: 'petri-bot-1', top: '70%', left: '2%', size: 22, colorClassName: 'text-olive', opacity: 0.35, duration: 15, delay: 0.4, motion: 'sway', kind: 'petri' },
  { id: 'flask-bot-1', top: '76%', left: '94%', size: 24, colorClassName: 'text-terracotta', opacity: 0.35, duration: 14, delay: 1.6, motion: 'sway', kind: 'flask' },
  { id: 'microbe-bot-1', top: '78%', left: '12%', size: 26, colorClassName: 'text-sage', opacity: 0.38, duration: 13, delay: 0.2, motion: 'sway', kind: 'microbe' },
  { id: 'eq-ideal-gas', top: '82%', left: '3%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.4, duration: 15, delay: 0.7, motion: 'drift', kind: 'formula', label: 'PV = nRT' },
  { id: 'dividing-cell-bot-1', top: '84%', left: '50%', size: 28, colorClassName: 'text-olive', opacity: 0.4, duration: 16, delay: 1.1, motion: 'pulse', kind: 'dividingCell' },
  { id: 'sparkle-bot-1', top: '86%', left: '82%', size: 14, colorClassName: 'text-terracotta', opacity: 0.4, duration: 12, delay: 0.5, motion: 'pulse', kind: 'sparkle' },
  { id: 'dna-strand-bot-1', top: '90%', left: '6%', size: 28, colorClassName: 'text-sage', opacity: 0.38, duration: 17, delay: 1.4, motion: 'drift', kind: 'dnaStrand' },
  { id: 'microbe-bot-2', top: '92%', left: '88%', size: 26, colorClassName: 'text-olive', opacity: 0.38, duration: 14, delay: 0.3, motion: 'sway', kind: 'microbe' },
  { id: 'eq-atp', top: '94%', left: '46%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.4, duration: 18, delay: 0.9, motion: 'drift', kind: 'formula', label: 'ATP ➔ ADP + Pi' },
  { id: 'dividing-cell-bot-2', top: '96%', left: '24%', size: 24, colorClassName: 'text-terracotta', opacity: 0.38, duration: 15, delay: 0.6, motion: 'pulse', kind: 'dividingCell' },
  { id: 'dot-bot-1', top: '98%', left: '72%', size: 7, colorClassName: 'text-ink-tertiary', opacity: 0.45, duration: 11, delay: 1.8, motion: 'drift', kind: 'dot' }
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
          case 'dividingCell':
      return (
        <svg width={item.size * 1.5} height={item.size} viewBox="0 0 36 24" fill="none" {...common}>
          {/* Cleavage furrow pinching membrane */}
          <path
            d="M10 2 C16 2 15 9 18 12 C21 9 20 2 26 2 C32 2 35 7 35 12 C35 17 32 22 26 22 C20 22 21 15 18 12 C15 15 16 22 10 22 C4 22 1 17 1 12 C1 7 4 2 10 2 Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          {/* Separating nuclei */}
          <circle cx="9" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" />
          <circle cx="27" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    case 'microbe':
      return (
        <svg width={item.size * 1.5} height={item.size} viewBox="0 0 36 24" fill="none" {...common}>
          {/* Flagellated bacterium body */}
          <rect x="12" y="6" width="18" height="12" rx="6" stroke="currentColor" strokeWidth="1.3" />
          {/* Flagella / swim tails */}
          <path d="M12 12 C8 9 6 15 2 12 C0 10 -1 14 -4 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12 15 C8 16 6 20 2 18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx="18" cy="12" r="1.2" fill="currentColor" />
          <circle cx="23" cy="10" r="0.8" fill="currentColor" />
        </svg>
      )
    case 'dnaStrand':
      return (
        <svg width={item.size} height={item.size * 1.6} viewBox="0 0 24 38" fill="none" {...common}>
          {/* Graphical double helix with base pairs */}
          <path d="M4 2 C20 10 20 20 4 28 C-4 33 4 38 4 38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M20 2 C4 10 4 20 20 28 C28 33 20 38 20 38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="7" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.2" />
          <line x1="11" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.2" />
          <line x1="7" y1="24" x2="17" y2="24" stroke="currentColor" strokeWidth="1.2" />
          <line x1="11" y1="30" x2="13" y2="30" stroke="currentColor" strokeWidth="1.2" />
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
    drift: 'cellfie-rise-drift',
    sway: 'cellfie-rise-sway',
    pulse: 'cellfie-rise-straight'
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-rise-drift {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-300px) translateX(22px) rotate(15deg); opacity: 0; }
        }
        @keyframes cellfie-rise-sway {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-260px) translateX(-20px) rotate(-12deg); opacity: 0; }
        }
        @keyframes cellfie-rise-straight {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-340px) rotate(8deg); opacity: 0; }
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
