import { useReducedMotion } from '../../../shared/hooks'

/**
 * FloatingScienceLayer — Dashboard-only ambient decoration (requested
 * dashboard change #9/#10). A handful of small, low-opacity scientific
 * shapes (DNA helix, hexagon/molecule, flask, orbiting atom, dots,
 * formula glyphs) drifting gently behind the real content.
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
 * the motion doesn't.
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
  /** Animation duration in seconds; slightly varied so shapes don't move in lockstep. */
  duration: number
  delay: number
  rotate?: boolean
  kind: 'helix' | 'hexagon' | 'flask' | 'atom' | 'dot' | 'formula' | 'sparkle' | 'glassware'
  label?: string
}

const ITEMS: FloatingItem[] = [
  { id: 'helix-1', top: '6%', left: '88%', size: 34, colorClassName: 'text-olive', opacity: 0.1, duration: 14, delay: 0, kind: 'helix' },
  { id: 'hex-1', top: '14%', left: '6%', size: 26, colorClassName: 'text-sage', opacity: 0.09, duration: 16, delay: 1.5, kind: 'hexagon', rotate: true },
  { id: 'flask-1', top: '38%', left: '94%', size: 24, colorClassName: 'text-terracotta', opacity: 0.1, duration: 12, delay: 0.5, kind: 'flask' },
  { id: 'atom-1', top: '58%', left: '3%', size: 30, colorClassName: 'text-olive', opacity: 0.08, duration: 18, delay: 2, kind: 'atom', rotate: true },
  { id: 'dot-1', top: '24%', left: '40%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.25, duration: 10, delay: 0, kind: 'dot' },
  { id: 'dot-2', top: '70%', left: '60%', size: 5, colorClassName: 'text-ink-tertiary', opacity: 0.2, duration: 9, delay: 1, kind: 'dot' },
  { id: 'dot-3', top: '48%', left: '20%', size: 4, colorClassName: 'text-ink-tertiary', opacity: 0.2, duration: 11, delay: 2.5, kind: 'dot' },
  { id: 'formula-1', top: '82%', left: '10%', size: 13, colorClassName: 'text-ink-tertiary', opacity: 0.14, duration: 15, delay: 0.8, kind: 'formula', label: 'ΔG = −RT ln K' },
  { id: 'formula-2', top: '4%', left: '42%', size: 12, colorClassName: 'text-ink-tertiary', opacity: 0.12, duration: 17, delay: 1.2, kind: 'formula', label: 'log₂ n' },
  { id: 'sparkle-1', top: '32%', left: '70%', size: 14, colorClassName: 'text-terracotta', opacity: 0.12, duration: 8, delay: 0.3, kind: 'sparkle' },
  { id: 'sparkle-2', top: '90%', left: '82%', size: 10, colorClassName: 'text-sage', opacity: 0.14, duration: 9, delay: 1.8, kind: 'sparkle' },
  { id: 'glass-1', top: '65%', left: '92%', size: 22, colorClassName: 'text-olive', opacity: 0.08, duration: 13, delay: 0.6, kind: 'glassware' },
  { id: 'hex-2', top: '92%', left: '46%', size: 20, colorClassName: 'text-sage', opacity: 0.08, duration: 15, delay: 2.2, kind: 'hexagon', rotate: true }
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

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-float-a {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-14px) translateX(6px); }
        }
        @keyframes cellfie-float-b {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(10px) rotate(8deg); }
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
              : `${item.rotate ? 'cellfie-float-b' : 'cellfie-float-a'} ${item.duration}s ease-in-out ${item.delay}s infinite`
          }}
        >
          <ShapeGlyph item={item} />
        </div>
      ))}
    </div>
  )
}
