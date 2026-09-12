import { useBreakpoint, useReducedMotion } from '@/shared/hooks'

/**
 * ExamPrepFloatingParticles — Exam Prep's section-specific ambient
 * background (visual-polish brief: "section-specific floating
 * particles" for Organism Explorer / Exam Prep / Laboratory /
 * Comparison Studio, modeled on the existing Dashboard
 * (`FloatingScienceLayer`) and Study Vault (`FloatingStudyParticles`)
 * layers).
 *
 * Deliberately its OWN small component rather than a shared generic
 * engine — same call the brief makes explicitly ("do NOT refactor the
 * existing Dashboard/Study Vault implementation aggressively just to
 * make it reusable; preserve what already works"). The *pattern* is
 * reused (CSS-only keyframe animation, a plain data array, a
 * `ShapeGlyph` switch, `useReducedMotion`), copied from
 * `modules/notes/components/FloatingStudyParticles.tsx` specifically —
 * its four in-place ambient motions (`bob`/`spin`/`driftDown`/
 * `driftUp`/`sidleSide`, none of which is a one-directional "rise")
 * are the better match for this brief's "quiet scientific atmosphere,
 * not animated wallpaper" ask than Dashboard's upward-stream motion.
 *
 * Vocabulary is exam/study-specific only (brief §4): books, pencils/
 * pens, paper, a check mark, a question mark, a graduation cap, and a
 * couple of tiny math/reasoning glyphs — no organism, lab-glassware, or
 * comparison motifs here.
 *
 * Same safety contract as every other floating layer in Cellfie:
 * `pointer-events-none` + `aria-hidden` throughout, `z-0` behind real
 * content, `overflow-hidden` on the parent (set by ExamPrepPage) so
 * nothing causes horizontal scroll, no JS animation loop, and
 * `prefers-reduced-motion` swaps every animation for a static (but
 * still visible) layout rather than removing the decoration outright.
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
  kind: 'book' | 'pencil' | 'pen' | 'paper' | 'checkMark' | 'questionMark' | 'graduationCap' | 'glyph' | 'dot'
  label?: string
  /** False on mobile — the desktop set is intentionally denser than what a small screen should carry (brief §11: don't just scale the count blindly, curate it). */
  mobileVisible?: boolean
}

const PARTICLES: Particle[] = [
  { id: 'book-1', top: '5%', left: '88%', size: 26, colorClassName: 'text-olive', opacity: 0.54, duration: 16, delay: 0, motion: 'bob', kind: 'book', mobileVisible: true },
  { id: 'question-1', top: '9%', left: '8%', size: 20, colorClassName: 'text-terracotta', opacity: 0.56, duration: 13, delay: 0.5, motion: 'spin', kind: 'questionMark', mobileVisible: true },
  { id: 'pencil-1', top: '14%', left: '48%', size: 24, colorClassName: 'text-ink-tertiary', opacity: 0.5, duration: 18, delay: 1.0, motion: 'sidleSide', kind: 'pencil', mobileVisible: true },
  { id: 'dot-1', top: '7%', left: '32%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 11, delay: 0.2, motion: 'driftUp', kind: 'dot', mobileVisible: true },
  { id: 'ruler-1', top: '3%', left: '65%', size: 22, colorClassName: 'text-sage', opacity: 0.52, duration: 15, delay: 0.7, motion: 'sidleSide', kind: 'pen', mobileVisible: true },

  { id: 'check-1', top: '22%', left: '92%', size: 20, colorClassName: 'text-sage', opacity: 0.56, duration: 14, delay: 0.8, motion: 'driftDown', kind: 'checkMark', mobileVisible: true },
  { id: 'glyph-pi', top: '26%', left: '4%', size: 14, colorClassName: 'text-ink-tertiary', opacity: 0.58, duration: 17, delay: 1.3, motion: 'bob', kind: 'glyph', label: 'π', mobileVisible: true },
  { id: 'grad-cap-1', top: '30%', left: '66%', size: 26, colorClassName: 'text-terracotta', opacity: 0.54, duration: 19, delay: 0.4, motion: 'spin', kind: 'graduationCap', mobileVisible: true },
  { id: 'paper-1', top: '20%', left: '58%', size: 22, colorClassName: 'text-olive', opacity: 0.5, duration: 15, delay: 1.6, motion: 'sidleSide', kind: 'paper', mobileVisible: true },
  { id: 'dot-2a', top: '24%', left: '20%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 0.9, motion: 'spin', kind: 'dot', mobileVisible: true },

  { id: 'pen-1', top: '42%', left: '10%', size: 24, colorClassName: 'text-olive', opacity: 0.54, duration: 18, delay: 0.9, motion: 'driftUp', kind: 'pen', mobileVisible: true },
  { id: 'book-2', top: '46%', left: '90%', size: 24, colorClassName: 'text-sage', opacity: 0.54, duration: 15, delay: 0.3, motion: 'bob', kind: 'book', mobileVisible: true },
  { id: 'glyph-sigma', top: '38%', left: '78%', size: 14, colorClassName: 'text-ink-tertiary', opacity: 0.58, duration: 16, delay: 1.1, motion: 'driftDown', kind: 'glyph', label: '∑', mobileVisible: true },
  { id: 'dot-2', top: '50%', left: '42%', size: 7, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 0.1, motion: 'sidleSide', kind: 'dot', mobileVisible: true },
  { id: 'question-1b', top: '36%', left: '30%', size: 18, colorClassName: 'text-terracotta', opacity: 0.56, duration: 15, delay: 1.8, motion: 'bob', kind: 'questionMark', mobileVisible: true },

  { id: 'question-2', top: '58%', left: '94%', size: 18, colorClassName: 'text-terracotta', opacity: 0.56, duration: 14, delay: 0.6, motion: 'spin', kind: 'questionMark', mobileVisible: true },
  { id: 'pencil-2', top: '64%', left: '16%', size: 24, colorClassName: 'text-ink-tertiary', opacity: 0.5, duration: 19, delay: 1.4, motion: 'bob', kind: 'pencil', mobileVisible: true },
  { id: 'check-2', top: '62%', left: '56%', size: 20, colorClassName: 'text-sage', opacity: 0.56, duration: 15, delay: 0.7, motion: 'driftUp', kind: 'checkMark', mobileVisible: true },
  { id: 'glyph-percent', top: '70%', left: '80%', size: 14, colorClassName: 'text-ink-tertiary', opacity: 0.58, duration: 17, delay: 0.2, motion: 'sidleSide', kind: 'glyph', label: '%', mobileVisible: true },
  { id: 'book-2b', top: '56%', left: '30%', size: 22, colorClassName: 'text-olive', opacity: 0.52, duration: 17, delay: 1.2, motion: 'sidleSide', kind: 'book', mobileVisible: true },

  { id: 'paper-2', top: '80%', left: '5%', size: 22, colorClassName: 'text-olive', opacity: 0.5, duration: 20, delay: 1.5, motion: 'driftDown', kind: 'paper', mobileVisible: true },
  { id: 'pen-2', top: '86%', left: '64%', size: 24, colorClassName: 'text-terracotta', opacity: 0.54, duration: 18, delay: 0.5, motion: 'bob', kind: 'pen', mobileVisible: true },
  { id: 'dot-3', top: '92%', left: '90%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.6, duration: 12, delay: 1.0, motion: 'spin', kind: 'dot', mobileVisible: true },
  { id: 'book-3', top: '94%', left: '34%', size: 24, colorClassName: 'text-sage', opacity: 0.52, duration: 15, delay: 0.3, motion: 'sidleSide', kind: 'book', mobileVisible: true },
  { id: 'grad-cap-2', top: '78%', left: '48%', size: 22, colorClassName: 'text-terracotta', opacity: 0.52, duration: 18, delay: 2.0, motion: 'driftUp', kind: 'graduationCap', mobileVisible: true },
  { id: 'question-3', top: '88%', left: '12%', size: 16, colorClassName: 'text-terracotta', opacity: 0.56, duration: 13, delay: 0.4, motion: 'bob', kind: 'questionMark', mobileVisible: true },
  { id: 'glyph-x2', top: '46%', left: '20%', size: 14, colorClassName: 'text-ink-tertiary', opacity: 0.58, duration: 16, delay: 1.7, motion: 'sidleSide', kind: 'glyph', label: 'x²', mobileVisible: true },
  { id: 'check-3', top: '32%', left: '90%', size: 18, colorClassName: 'text-sage', opacity: 0.56, duration: 14, delay: 2.3, motion: 'driftDown', kind: 'checkMark', mobileVisible: true }
]

const ANIMATION_NAME: Record<Motion, string> = {
  bob: 'cellfie-exam-bob',
  spin: 'cellfie-exam-spin',
  driftDown: 'cellfie-exam-drift-down',
  driftUp: 'cellfie-exam-drift-up',
  sidleSide: 'cellfie-exam-sidle'
}

function ParticleGlyph({ item }: { item: Particle }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
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
    case 'pencil':
      return (
        <svg width={item.size * 0.4} height={item.size} viewBox="0 0 10 26" fill="none" {...common}>
          <path d="M5 2 8.5 6 5.5 24h-1L2 6 5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M2.6 7h4.8" stroke="currentColor" strokeWidth="1" />
          <path d="M4 24h2l-1 2-1-2Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'pen':
      return (
        <svg width={item.size * 0.4} height={item.size} viewBox="0 0 10 26" fill="none" {...common}>
          <path d="M5 2 8 6 5 24 2 6 5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M2.6 8h4.8" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    case 'paper':
      return (
        <svg width={item.size} height={item.size * 1.2} viewBox="0 0 20 24" fill="none" {...common}>
          <path d="M3 2h10l4 4v16H3V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M13 2v4h4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M6 12h8M6 16h8M6 20h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case 'checkMark':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'questionMark':
      return (
        <span className={`${item.colorClassName} font-ui font-semibold`} style={{ fontSize: item.size, opacity: item.opacity, lineHeight: 1 }}>
          ?
        </span>
      )
    case 'graduationCap':
      return (
        <svg width={item.size} height={item.size * 0.75} viewBox="0 0 28 21" fill="none" {...common}>
          <path d="M14 2 26 8l-12 6L2 8 14 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M8 10.5v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M24 9v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'glyph':
      return (
        <span className={`${item.colorClassName} font-mono whitespace-nowrap`} style={{ fontSize: item.size, opacity: item.opacity }}>
          {item.label}
        </span>
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

export function ExamPrepFloatingParticles() {
  const reducedMotion = useReducedMotion()
  const isMobile = useBreakpoint() === 'mobile'
  const items = isMobile ? PARTICLES.filter((p) => p.mobileVisible) : PARTICLES

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-exam-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes cellfie-exam-spin {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(6deg) scale(1.04); }
        }
        @keyframes cellfie-exam-drift-down {
          0% { transform: translateY(-8px) translateX(0); }
          50% { transform: translateY(14px) translateX(6px); }
          100% { transform: translateY(-8px) translateX(0); }
        }
        @keyframes cellfie-exam-drift-up {
          0% { transform: translateY(8px) translateX(0); }
          50% { transform: translateY(-14px) translateX(-6px); }
          100% { transform: translateY(8px) translateX(0); }
        }
        @keyframes cellfie-exam-sidle {
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
