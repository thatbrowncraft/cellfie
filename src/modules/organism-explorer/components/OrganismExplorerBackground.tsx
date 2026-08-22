import { useReducedMotion } from '@/shared/hooks'

/**
 * Organism Explorer redesign §16-§17 — a quiet, low-opacity field of
 * floating microbiology motifs behind the Explorer's hub/category
 * views only (never the organism detail page, never any other module).
 * Deliberately restricted to bacteria, fungi, and virus shapes — no
 * protozoa decorations here (§16) — and kept subtle: low opacity,
 * `pointer-events-none`, `aria-hidden`, and never affecting layout or
 * causing horizontal scroll (the parent keeps `overflow-hidden`).
 *
 * Reuses the same reduced-motion convention as the Dashboard's
 * `FloatingScienceLayer`: when `prefers-reduced-motion: reduce` is set,
 * the shapes stay visible but completely still instead of disappearing
 * (§17).
 */

interface FloatingItem {
  id: string
  top: string
  left: string
  size: number
  colorClassName: string
  opacity: number
  duration: number
  delay: number
  motion: 'drift' | 'sway'
  kind: 'rod' | 'coccusCluster' | 'spiral' | 'hypha' | 'buddingYeast' | 'virusParticle'
}

const ITEMS: FloatingItem[] = [
  { id: 'rod-1', top: '6%', left: '90%', size: 26, colorClassName: 'text-olive', opacity: 0.14, duration: 22, delay: 0, motion: 'drift', kind: 'rod' },
  { id: 'cocci-1', top: '14%', left: '5%', size: 22, colorClassName: 'text-sage', opacity: 0.13, duration: 19, delay: 0.6, motion: 'sway', kind: 'coccusCluster' },
  { id: 'virus-1', top: '10%', left: '48%', size: 20, colorClassName: 'text-terracotta', opacity: 0.13, duration: 20, delay: 1.1, motion: 'drift', kind: 'virusParticle' },
  { id: 'hypha-1', top: '30%', left: '85%', size: 26, colorClassName: 'text-sage', opacity: 0.12, duration: 24, delay: 0.4, motion: 'sway', kind: 'hypha' },
  { id: 'spiral-1', top: '36%', left: '6%', size: 22, colorClassName: 'text-olive', opacity: 0.14, duration: 21, delay: 1.4, motion: 'drift', kind: 'spiral' },
  { id: 'yeast-1', top: '48%', left: '92%', size: 18, colorClassName: 'text-terracotta', opacity: 0.13, duration: 18, delay: 0.2, motion: 'sway', kind: 'buddingYeast' },
  { id: 'rod-2', top: '58%', left: '3%', size: 24, colorClassName: 'text-olive', opacity: 0.12, duration: 23, delay: 0.9, motion: 'drift', kind: 'rod' },
  { id: 'virus-2', top: '66%', left: '88%', size: 20, colorClassName: 'text-terracotta', opacity: 0.13, duration: 20, delay: 1.6, motion: 'sway', kind: 'virusParticle' },
  { id: 'cocci-2', top: '76%', left: '10%', size: 20, colorClassName: 'text-sage', opacity: 0.12, duration: 19, delay: 0.3, motion: 'drift', kind: 'coccusCluster' },
  { id: 'hypha-2', top: '84%', left: '55%', size: 24, colorClassName: 'text-sage', opacity: 0.12, duration: 22, delay: 1.2, motion: 'sway', kind: 'hypha' },
  { id: 'spiral-2', top: '92%', left: '80%', size: 20, colorClassName: 'text-olive', opacity: 0.13, duration: 21, delay: 0.7, motion: 'drift', kind: 'spiral' }
]

function ShapeGlyph({ item }: { item: FloatingItem }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
    case 'rod':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 40 20" fill="none" {...common}>
          <rect x="2" y="5" width="36" height="10" rx="5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )
    case 'coccusCluster':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 28 28" fill="none" {...common}>
          <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="19" cy="9" r="5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="9" cy="19" r="5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="19" cy="19" r="5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )
    case 'spiral':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path
            d="M3 12c0-3 6-3 6-6s-6-3-6 0 6 3 6 6-6 3-6 6 6 3 6 0"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path d="M9 6c3-1 6 1 6 4s-3 5-6 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M15 10c2 0 4 1 4 3s-2 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'hypha':
      return (
        <svg width={item.size} height={item.size * 0.7} viewBox="0 0 36 24" fill="none" {...common}>
          <path d="M2 20c6-2 8-10 14-12M16 8c3 1 3 6 6 6M22 14c2-1 4 1 4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="16" cy="8" r="2.4" stroke="currentColor" strokeWidth="1" />
          <circle cx="26" cy="17" r="2" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    case 'buddingYeast':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 26 26" fill="none" {...common}>
          <circle cx="11" cy="14" r="8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="20" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )
    case 'virusParticle':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 28 28" fill="none" {...common}>
          <circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="1.3" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const x1 = 14 + Math.cos(angle) * 7
            const y1 = 14 + Math.sin(angle) * 7
            const x2 = 14 + Math.cos(angle) * 12
            const y2 = 14 + Math.sin(angle) * 12
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          })}
        </svg>
      )
    default:
      return null
  }
}

export function OrganismExplorerBackground() {
  const reducedMotion = useReducedMotion()

  const animationName: Record<FloatingItem['motion'], string> = {
    drift: 'cellfie-organism-drift',
    sway: 'cellfie-organism-sway'
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-organism-drift {
          0% { transform: translateY(0) translateX(0) rotate(0deg); }
          50% { transform: translateY(-18px) translateX(8px) rotate(4deg); }
          100% { transform: translateY(0) translateX(0) rotate(0deg); }
        }
        @keyframes cellfie-organism-sway {
          0% { transform: translateY(0) translateX(0) rotate(0deg); }
          50% { transform: translateY(12px) translateX(-10px) rotate(-4deg); }
          100% { transform: translateY(0) translateX(0) rotate(0deg); }
        }
      `}</style>

      {ITEMS.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            top: item.top,
            left: item.left,
            animation: reducedMotion ? undefined : `${animationName[item.motion]} ${item.duration}s ease-in-out ${item.delay}s infinite`
          }}
        >
          <ShapeGlyph item={item} />
        </div>
      ))}
    </div>
  )
}
