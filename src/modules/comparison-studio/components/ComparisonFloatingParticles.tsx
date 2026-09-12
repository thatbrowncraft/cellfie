import { useBreakpoint, useReducedMotion } from '@/shared/hooks'

/**
 * ComparisonFloatingParticles — Comparison Studio's section-specific
 * ambient background (visual-polish brief: "section-specific floating
 * particles"). Same self-contained pattern as
 * `ExamPrepFloatingParticles`/`LaboratoryFloatingParticles`, copying the
 * CSS-only ambient-motion approach from
 * `modules/notes/components/FloatingStudyParticles.tsx`.
 *
 * Vocabulary is comparison/analysis-specific only (brief §6): a
 * left-right arrow, a split circle (two halves), a balance/scale
 * silhouette, a plus/minus pairing, and two small connected dots — the
 * "two things → compare" visual language the brief asks for. No
 * organism, exam, or lab-glassware motifs.
 *
 * Same safety contract throughout: `pointer-events-none` + `aria-hidden`,
 * `z-0` behind real content, `overflow-hidden` on the parent
 * (ComparisonStudioPage wraps this), no JS animation loop, and
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
  kind: 'arrow' | 'splitCircle' | 'balance' | 'plusMinus' | 'linkedDots' | 'dot'
  /** False on mobile — a curated subset, not a blind percentage cut (brief §11). */
  mobileVisible?: boolean
}

const PARTICLES: Particle[] = [
  { id: 'arrow-1', top: '5%', left: '88%', size: 26, colorClassName: 'text-terracotta', opacity: 0.54, duration: 15, delay: 0, motion: 'sidleSide', kind: 'arrow', mobileVisible: true },
  { id: 'split-1', top: '10%', left: '6%', size: 24, colorClassName: 'text-olive', opacity: 0.54, duration: 17, delay: 0.5, motion: 'spin', kind: 'splitCircle', mobileVisible: true },
  { id: 'linked-1', top: '8%', left: '46%', size: 20, colorClassName: 'text-sage', opacity: 0.58, duration: 13, delay: 1.0, motion: 'bob', kind: 'linkedDots', mobileVisible: true },
  { id: 'dot-1', top: '16%', left: '30%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 11, delay: 0.3, motion: 'driftUp', kind: 'dot', mobileVisible: true },
  { id: 'plusminus-1a', top: '3%', left: '66%', size: 18, colorClassName: 'text-sage', opacity: 0.56, duration: 14, delay: 0.6, motion: 'driftDown', kind: 'plusMinus', mobileVisible: true },

  { id: 'balance-1', top: '22%', left: '94%', size: 26, colorClassName: 'text-olive', opacity: 0.54, duration: 19, delay: 0.8, motion: 'driftDown', kind: 'balance', mobileVisible: true },
  { id: 'plusminus-1', top: '28%', left: '4%', size: 20, colorClassName: 'text-terracotta', opacity: 0.56, duration: 14, delay: 0.4, motion: 'bob', kind: 'plusMinus', mobileVisible: true },
  { id: 'arrow-2', top: '20%', left: '66%', size: 24, colorClassName: 'text-sage', opacity: 0.5, duration: 16, delay: 1.4, motion: 'spin', kind: 'arrow', mobileVisible: true },
  { id: 'split-2', top: '32%', left: '54%', size: 22, colorClassName: 'text-olive', opacity: 0.5, duration: 18, delay: 0.6, motion: 'sidleSide', kind: 'splitCircle', mobileVisible: true },
  { id: 'linked-1b', top: '24%', left: '20%', size: 18, colorClassName: 'text-terracotta', opacity: 0.58, duration: 15, delay: 1.7, motion: 'driftUp', kind: 'linkedDots', mobileVisible: true },

  { id: 'linked-2', top: '44%', left: '90%', size: 20, colorClassName: 'text-terracotta', opacity: 0.58, duration: 15, delay: 0.9, motion: 'driftUp', kind: 'linkedDots', mobileVisible: true },
  { id: 'balance-2', top: '48%', left: '10%', size: 26, colorClassName: 'text-olive', opacity: 0.54, duration: 18, delay: 0.3, motion: 'bob', kind: 'balance', mobileVisible: true },
  { id: 'dot-2', top: '40%', left: '38%', size: 7, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 1.2, motion: 'driftDown', kind: 'dot', mobileVisible: true },
  { id: 'plusminus-2', top: '52%', left: '76%', size: 20, colorClassName: 'text-sage', opacity: 0.56, duration: 12, delay: 0.1, motion: 'sidleSide', kind: 'plusMinus', mobileVisible: true },
  { id: 'arrow-2b', top: '36%', left: '82%', size: 20, colorClassName: 'text-terracotta', opacity: 0.52, duration: 16, delay: 2.1, motion: 'bob', kind: 'arrow', mobileVisible: true },

  { id: 'arrow-3', top: '60%', left: '20%', size: 24, colorClassName: 'text-terracotta', opacity: 0.54, duration: 17, delay: 0.7, motion: 'spin', kind: 'arrow', mobileVisible: true },
  { id: 'split-3', top: '66%', left: '86%', size: 22, colorClassName: 'text-sage', opacity: 0.5, duration: 19, delay: 1.5, motion: 'bob', kind: 'splitCircle', mobileVisible: true },
  { id: 'linked-3', top: '64%', left: '48%', size: 20, colorClassName: 'text-olive', opacity: 0.58, duration: 15, delay: 0.5, motion: 'driftUp', kind: 'linkedDots', mobileVisible: true },
  { id: 'balance-3', top: '72%', left: '6%', size: 24, colorClassName: 'text-terracotta', opacity: 0.54, duration: 17, delay: 0.3, motion: 'sidleSide', kind: 'balance', mobileVisible: true },
  { id: 'split-3b', top: '58%', left: '60%', size: 18, colorClassName: 'text-olive', opacity: 0.5, duration: 14, delay: 1.9, motion: 'driftDown', kind: 'splitCircle', mobileVisible: true },

  { id: 'plusminus-3', top: '82%', left: '58%', size: 20, colorClassName: 'text-olive', opacity: 0.56, duration: 20, delay: 1.6, motion: 'driftDown', kind: 'plusMinus', mobileVisible: true },
  { id: 'arrow-4', top: '88%', left: '92%', size: 24, colorClassName: 'text-sage', opacity: 0.54, duration: 18, delay: 0.6, motion: 'bob', kind: 'arrow', mobileVisible: true },
  { id: 'dot-3', top: '92%', left: '14%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 1.1, motion: 'spin', kind: 'dot', mobileVisible: true },
  { id: 'split-4', top: '95%', left: '38%', size: 22, colorClassName: 'text-terracotta', opacity: 0.5, duration: 14, delay: 0.2, motion: 'sidleSide', kind: 'splitCircle', mobileVisible: true },
  { id: 'balance-3b', top: '78%', left: '30%', size: 18, colorClassName: 'text-olive', opacity: 0.52, duration: 17, delay: 2.4, motion: 'bob', kind: 'balance', mobileVisible: true },
  { id: 'linked-4', top: '86%', left: '4%', size: 18, colorClassName: 'text-terracotta', opacity: 0.56, duration: 15, delay: 0.9, motion: 'driftUp', kind: 'linkedDots', mobileVisible: true },
  { id: 'plusminus-4', top: '46%', left: '68%', size: 18, colorClassName: 'text-sage', opacity: 0.56, duration: 16, delay: 2.6, motion: 'sidleSide', kind: 'plusMinus', mobileVisible: true }
]

const ANIMATION_NAME: Record<Motion, string> = {
  bob: 'cellfie-compare-bob',
  spin: 'cellfie-compare-spin',
  driftDown: 'cellfie-compare-drift-down',
  driftUp: 'cellfie-compare-drift-up',
  sidleSide: 'cellfie-compare-sidle'
}

function ParticleGlyph({ item }: { item: Particle }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
    case 'arrow':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 32 16" fill="none" {...common}>
          <path d="M2 8h28M2 8l5-5M2 8l5 5M30 8l-5-5M30 8l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'splitCircle':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.3" />
          <path d="M12 2v20" stroke="currentColor" strokeWidth="1.2" />
          <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.35" stroke="none" />
        </svg>
      )
    case 'balance':
      return (
        <svg width={item.size} height={item.size * 0.85} viewBox="0 0 28 24" fill="none" {...common}>
          <path d="M14 2v18M6 21h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M2 8h12M16 8h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 8c0 2.5 2 4.5 4 4.5S10 10.5 10 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M18 8c0 2.5 2 4.5 4 4.5S26 10.5 26 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )
    case 'plusMinus':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 32 16" fill="none" {...common}>
          <path d="M6 3v10M1 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M21 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'linkedDots':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 32 16" fill="none" {...common}>
          <circle cx="5" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="27" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9 8h18" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2.5" />
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

export function ComparisonFloatingParticles() {
  const reducedMotion = useReducedMotion()
  const isMobile = useBreakpoint() === 'mobile'
  const items = isMobile ? PARTICLES.filter((p) => p.mobileVisible) : PARTICLES

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-compare-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes cellfie-compare-spin {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(6deg) scale(1.04); }
        }
        @keyframes cellfie-compare-drift-down {
          0% { transform: translateY(-8px) translateX(0); }
          50% { transform: translateY(14px) translateX(6px); }
          100% { transform: translateY(-8px) translateX(0); }
        }
        @keyframes cellfie-compare-drift-up {
          0% { transform: translateY(8px) translateX(0); }
          50% { transform: translateY(-14px) translateX(-6px); }
          100% { transform: translateY(8px) translateX(0); }
        }
        @keyframes cellfie-compare-sidle {
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
