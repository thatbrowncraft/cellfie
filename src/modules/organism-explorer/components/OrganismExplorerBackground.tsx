import { useReducedMotion } from '@/shared/hooks'

/**
 * Organism Explorer redesign §16-§17 — a medium-opacity field of
 * floating microbiology motifs that continuously rise from bottom to top behind the Explorer's hub/category
 * views only (never the organism detail page, never any other module).
 * Deliberately restricted to bacteria, fungi, and virus shapes — no
 * protozoa decorations here (§16) — and kept visually subtle without disappearing: medium opacity,
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
  bottom: string
  left: string
  size: number
  colorClassName: string
  opacity: number
  duration: number
  delay: number
  motion: 'rise'
  kind: 'rod' | 'coccusCluster' | 'spiral' | 'hypha' | 'buddingYeast' | 'virusParticle' | 'vibrio' | 'spore' | 'phage'
}

const ITEMS: FloatingItem[] = [
  // Existing items slowed down by doubling duration values
  { id: 'rod-1', bottom: '-8%', left: '90%', size: 30, colorClassName: 'text-olive', opacity: 0.32, duration: 52, delay: 0, motion: 'rise', kind: 'rod' },
  { id: 'cocci-1', bottom: '-14%', left: '7%', size: 25, colorClassName: 'text-sage', opacity: 0.29, duration: 46, delay: 3, motion: 'rise', kind: 'coccusCluster' },
  { id: 'virus-1', bottom: '-5%', left: '48%', size: 24, colorClassName: 'text-terracotta', opacity: 0.31, duration: 58, delay: 8, motion: 'rise', kind: 'virusParticle' },
  { id: 'hypha-1', bottom: '-18%', left: '84%', size: 31, colorClassName: 'text-sage', opacity: 0.27, duration: 62, delay: 12, motion: 'rise', kind: 'hypha' },
  { id: 'spiral-1', bottom: '-10%', left: '15%', size: 26, colorClassName: 'text-olive', opacity: 0.30, duration: 54, delay: 16, motion: 'rise', kind: 'spiral' },
  { id: 'yeast-1', bottom: '-12%', left: '67%', size: 23, colorClassName: 'text-terracotta', opacity: 0.30, duration: 48, delay: 20, motion: 'rise', kind: 'buddingYeast' },
  { id: 'rod-2', bottom: '-20%', left: '34%', size: 28, colorClassName: 'text-olive', opacity: 0.28, duration: 60, delay: 24, motion: 'rise', kind: 'rod' },
  { id: 'virus-2', bottom: '-7%', left: '79%', size: 24, colorClassName: 'text-terracotta', opacity: 0.30, duration: 56, delay: 28, motion: 'rise', kind: 'virusParticle' },
  { id: 'cocci-2', bottom: '-16%', left: '55%', size: 24, colorClassName: 'text-sage', opacity: 0.27, duration: 50, delay: 32, motion: 'rise', kind: 'coccusCluster' },
  { id: 'hypha-2', bottom: '-11%', left: '21%', size: 29, colorClassName: 'text-sage', opacity: 0.28, duration: 64, delay: 36, motion: 'rise', kind: 'hypha' },
  { id: 'spiral-2', bottom: '-15%', left: '94%', size: 24, colorClassName: 'text-olive', opacity: 0.30, duration: 58, delay: 40, motion: 'rise', kind: 'spiral' },
  // New bacteria, fungi, and virus items
  { id: 'vibrio-1', bottom: '-9%', left: '42%', size: 26, colorClassName: 'text-olive', opacity: 0.29, duration: 53, delay: 7, motion: 'rise', kind: 'vibrio' },
  { id: 'spore-1', bottom: '-13%', left: '72%', size: 27, colorClassName: 'text-sage', opacity: 0.28, duration: 61, delay: 15, motion: 'rise', kind: 'spore' },
  { id: 'phage-1', bottom: '-6%', left: '27%', size: 28, colorClassName: 'text-terracotta', opacity: 0.31, duration: 57, delay: 22, motion: 'rise', kind: 'phage' },
  { id: 'vibrio-2', bottom: '-17%', left: '60%', size: 25, colorClassName: 'text-olive', opacity: 0.30, duration: 49, delay: 34, motion: 'rise', kind: 'vibrio' },
  { id: 'spore-2', bottom: '-11%', left: '3%', size: 28, colorClassName: 'text-sage', opacity: 0.27, duration: 63, delay: 43, motion: 'rise', kind: 'spore' },
  { id: 'phage-2', bottom: '-19%', left: '88%', size: 26, colorClassName: 'text-terracotta', opacity: 0.29, duration: 55, delay: 47, motion: 'rise', kind: 'phage' }
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
    case 'vibrio':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path d="M6 18c0-6 4-12 12-12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )
    case 'spore':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" />
          <circle cx="18" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="6" r="2.5" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="18" r="2.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    case 'phage':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path d="M12 3l5 4v5l-5 4-5-4V7l5-4z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M12 16v4M9 22l3-2 3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

export function OrganismExplorerBackground() {
  const reducedMotion = useReducedMotion()

  const animationName: Record<FloatingItem['motion'], string> = {
    rise: 'cellfie-organism-rise'
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-organism-rise {
          0% {
            transform: translate3d(0, 18vh, 0) rotate(-2deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          50% {
            transform: translate3d(18px, -48vh, 0) rotate(5deg);
            opacity: 1;
          }
          92% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(-14px, -125vh, 0) rotate(-4deg);
            opacity: 0;
          }
        }
      `}</style>

      {ITEMS.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            bottom: item.bottom,
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
