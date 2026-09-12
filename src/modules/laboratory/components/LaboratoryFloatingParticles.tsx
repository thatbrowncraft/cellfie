import { useBreakpoint, useReducedMotion } from '@/shared/hooks'

/**
 * LaboratoryFloatingParticles — Laboratory's section-specific ambient
 * background (visual-polish brief: "section-specific floating
 * particles"). Same pattern as `ExamPrepFloatingParticles` and
 * `ComparisonFloatingParticles` — each its own small, self-contained
 * component copying the CSS-only ambient-motion approach from
 * `modules/notes/components/FloatingStudyParticles.tsx` rather than a
 * single shared engine, per the brief's explicit "don't refactor what
 * already works" instruction.
 *
 * Vocabulary is lab-glassware/equipment only (brief §5): test tube,
 * flask, beaker, pipette, Petri dish, a simple molecule, and a droplet
 * — no organism, exam, or comparison motifs.
 *
 * Same safety contract throughout: `pointer-events-none` + `aria-hidden`,
 * `z-0` behind real content, `overflow-hidden` on the parent
 * (LaboratoryPage wraps this), no JS animation loop, and
 * `prefers-reduced-motion` renders the same shapes fully still instead
 * of removing them.
 */

type Motion = 'bob' | 'spin' | 'driftDown' | 'driftUp' | 'sidleSide'

interface Particle {
  id: string
  top: string
  left: string
  size: number
  colorClassName: string
  opacity: number
  duration: number
  delay: number
  motion: Motion
  kind: 'testTube' | 'flask' | 'beaker' | 'pipette' | 'petriDish' | 'molecule' | 'droplet' | 'dot'
  /** False on mobile — a curated subset, not a blind percentage cut (brief §11). */
  mobileVisible?: boolean
}

const PARTICLES: Particle[] = [
  { id: 'flask-1', top: '5%', left: '90%', size: 26, colorClassName: 'text-terracotta', opacity: 0.54, duration: 16, delay: 0, motion: 'bob', kind: 'flask', mobileVisible: true },
  { id: 'tube-1', top: '10%', left: '6%', size: 22, colorClassName: 'text-olive', opacity: 0.54, duration: 14, delay: 0.5, motion: 'sidleSide', kind: 'testTube', mobileVisible: true },
  { id: 'droplet-1', top: '7%', left: '46%', size: 14, colorClassName: 'text-sage', opacity: 0.58, duration: 12, delay: 0.2, motion: 'driftUp', kind: 'droplet', mobileVisible: true },
  { id: 'dot-1', top: '16%', left: '30%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 11, delay: 0.8, motion: 'spin', kind: 'dot', mobileVisible: true },
  { id: 'beaker-1a', top: '3%', left: '68%', size: 22, colorClassName: 'text-sage', opacity: 0.52, duration: 15, delay: 0.3, motion: 'driftDown', kind: 'beaker', mobileVisible: true },

  { id: 'petri-1', top: '22%', left: '94%', size: 24, colorClassName: 'text-olive', opacity: 0.54, duration: 18, delay: 1.0, motion: 'driftDown', kind: 'petriDish', mobileVisible: true },
  { id: 'beaker-1', top: '28%', left: '4%', size: 24, colorClassName: 'text-sage', opacity: 0.54, duration: 15, delay: 0.3, motion: 'bob', kind: 'beaker', mobileVisible: true },
  { id: 'molecule-1', top: '20%', left: '66%', size: 24, colorClassName: 'text-terracotta', opacity: 0.5, duration: 19, delay: 1.4, motion: 'spin', kind: 'molecule', mobileVisible: true },
  { id: 'pipette-1', top: '32%', left: '54%', size: 22, colorClassName: 'text-ink-tertiary', opacity: 0.5, duration: 17, delay: 0.6, motion: 'sidleSide', kind: 'pipette', mobileVisible: true },
  { id: 'droplet-1b', top: '24%', left: '20%', size: 12, colorClassName: 'text-sage', opacity: 0.58, duration: 13, delay: 1.6, motion: 'driftUp', kind: 'droplet', mobileVisible: true },

  { id: 'tube-2', top: '44%', left: '92%', size: 22, colorClassName: 'text-terracotta', opacity: 0.54, duration: 15, delay: 0.9, motion: 'driftUp', kind: 'testTube', mobileVisible: true },
  { id: 'flask-2', top: '48%', left: '10%', size: 26, colorClassName: 'text-olive', opacity: 0.54, duration: 18, delay: 0.4, motion: 'bob', kind: 'flask', mobileVisible: true },
  { id: 'droplet-2', top: '40%', left: '38%', size: 14, colorClassName: 'text-sage', opacity: 0.58, duration: 13, delay: 1.2, motion: 'driftDown', kind: 'droplet', mobileVisible: true },
  { id: 'dot-2', top: '52%', left: '76%', size: 7, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 0.1, motion: 'sidleSide', kind: 'dot', mobileVisible: true },
  { id: 'molecule-1b', top: '36%', left: '82%', size: 20, colorClassName: 'text-terracotta', opacity: 0.5, duration: 16, delay: 2.0, motion: 'bob', kind: 'molecule', mobileVisible: true },

  { id: 'petri-2', top: '60%', left: '20%', size: 22, colorClassName: 'text-olive', opacity: 0.54, duration: 16, delay: 0.7, motion: 'spin', kind: 'petriDish', mobileVisible: true },
  { id: 'beaker-2', top: '66%', left: '86%', size: 24, colorClassName: 'text-sage', opacity: 0.54, duration: 19, delay: 1.5, motion: 'bob', kind: 'beaker', mobileVisible: true },
  { id: 'molecule-2', top: '64%', left: '48%', size: 24, colorClassName: 'text-terracotta', opacity: 0.5, duration: 15, delay: 0.5, motion: 'driftUp', kind: 'molecule', mobileVisible: true },
  { id: 'pipette-2', top: '72%', left: '6%', size: 22, colorClassName: 'text-ink-tertiary', opacity: 0.5, duration: 17, delay: 0.3, motion: 'sidleSide', kind: 'pipette', mobileVisible: true },
  { id: 'tube-2b', top: '58%', left: '60%', size: 20, colorClassName: 'text-olive', opacity: 0.52, duration: 14, delay: 1.9, motion: 'driftDown', kind: 'testTube', mobileVisible: true },

  { id: 'tube-3', top: '82%', left: '58%', size: 22, colorClassName: 'text-olive', opacity: 0.54, duration: 20, delay: 1.6, motion: 'driftDown', kind: 'testTube', mobileVisible: true },
  { id: 'flask-3', top: '88%', left: '92%', size: 24, colorClassName: 'text-terracotta', opacity: 0.54, duration: 18, delay: 0.6, motion: 'bob', kind: 'flask', mobileVisible: true },
  { id: 'dot-3', top: '92%', left: '14%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 1.1, motion: 'spin', kind: 'dot', mobileVisible: true },
  { id: 'droplet-3', top: '95%', left: '38%', size: 14, colorClassName: 'text-sage', opacity: 0.58, duration: 14, delay: 0.2, motion: 'sidleSide', kind: 'droplet', mobileVisible: true },
  { id: 'petri-3', top: '78%', left: '30%', size: 20, colorClassName: 'text-olive', opacity: 0.52, duration: 17, delay: 2.2, motion: 'bob', kind: 'petriDish', mobileVisible: true },
  { id: 'beaker-3', top: '86%', left: '4%', size: 20, colorClassName: 'text-sage', opacity: 0.52, duration: 15, delay: 0.9, motion: 'driftUp', kind: 'beaker', mobileVisible: true },
  { id: 'pipette-3', top: '46%', left: '68%', size: 18, colorClassName: 'text-ink-tertiary', opacity: 0.5, duration: 16, delay: 2.5, motion: 'sidleSide', kind: 'pipette', mobileVisible: true }
]

const ANIMATION_NAME: Record<Motion, string> = {
  bob: 'cellfie-lab-bob',
  spin: 'cellfie-lab-spin',
  driftDown: 'cellfie-lab-drift-down',
  driftUp: 'cellfie-lab-drift-up',
  sidleSide: 'cellfie-lab-sidle'
}

function ParticleGlyph({ item }: { item: Particle }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
    case 'testTube':
      return (
        <svg width={item.size * 0.45} height={item.size} viewBox="0 0 12 26" fill="none" {...common}>
          <path d="M3 2h6M4 2v15.5a2 2 0 0 0 4 0V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M4 13c0 2.5 4 2.5 4 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
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
    case 'beaker':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path d="M7 2h10M8 2v6.5l-4 10.5a1.6 1.6 0 0 0 1.5 2.2h13a1.6 1.6 0 0 0 1.5-2.2L16 8.5V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 15h12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )
    case 'pipette':
      return (
        <svg width={item.size * 0.4} height={item.size} viewBox="0 0 10 26" fill="none" {...common}>
          <path d="M3 2h4l1 3-2.5 2.5V20l-1.5 4-1.5-4V7.5L2 5l1-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      )
    case 'petriDish':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <ellipse cx="12" cy="10" rx="9" ry="4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10v3c0 2.2 4 4 9 4s9-1.8 9-4v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="9" cy="9.5" r="0.8" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="0.6" fill="currentColor" />
          <circle cx="12" cy="8.5" r="0.5" fill="currentColor" />
        </svg>
      )
    case 'molecule':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <circle cx="6" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 8.3 10.5 15.5M16 8.3 13.5 15.5M8.3 7h7.4" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      )
    case 'droplet':
      return (
        <svg width={item.size * 0.7} height={item.size} viewBox="0 0 18 26" fill="none" {...common}>
          <path d="M9 2c4 6 7 10.5 7 15a7 7 0 1 1-14 0c0-4.5 3-9 7-15Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )
    case 'dot':
      return (
        <span
          className={`${item.colorClassName} block rounded-full`}
          style={{ width: item.size, height: item.size, opacity: item.opacity, backgroundColor: 'currentColor' }}
        />
      )
    default:
      return null
  }
}

export function LaboratoryFloatingParticles() {
  const reducedMotion = useReducedMotion()
  const isMobile = useBreakpoint() === 'mobile'
  const items = isMobile ? PARTICLES.filter((p) => p.mobileVisible) : PARTICLES

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-lab-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes cellfie-lab-spin {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(6deg) scale(1.04); }
        }
        @keyframes cellfie-lab-drift-down {
          0% { transform: translateY(-8px) translateX(0); }
          50% { transform: translateY(14px) translateX(6px); }
          100% { transform: translateY(-8px) translateX(0); }
        }
        @keyframes cellfie-lab-drift-up {
          0% { transform: translateY(8px) translateX(0); }
          50% { transform: translateY(-14px) translateX(-6px); }
          100% { transform: translateY(8px) translateX(0); }
        }
        @keyframes cellfie-lab-sidle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(12px) rotate(2deg); }
        }
      `}</style>

      {items.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            top: item.top,
            left: item.left,
            animation: reducedMotion ? undefined : `${ANIMATION_NAME[item.motion]} ${item.duration}s ease-in-out ${item.delay}s infinite`
          }}
        >
          <ParticleGlyph item={item} />
        </div>
      ))}
    </div>
  )
}
