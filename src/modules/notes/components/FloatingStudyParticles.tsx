import { useReducedMotion } from '../../../shared/hooks'

/**
 * FloatingStudyParticles — Study Vault redesign (Final Polish brief
 * §10-12): a subtle field of tiny study-desk objects drifting behind the
 * Notes/Highlights/Bookmarks content.
 *
 * Deliberately NOT a reuse of `dashboard/FloatingScienceLayer` even
 * though the shape is similar, for one specific reason the brief calls
 * out explicitly: every motion in that layer is a one-direction "rise"
 * (`translateY(-Npx)`, always upward, with only sway varying the
 * horizontal component) — exactly the "obvious single-direction
 * particle stream" / "website loading animation" look this brief asks
 * this page NOT to have. This layer's four motions are built so no two
 * neighboring items obviously share a direction: `bob` and `spin` don't
 * translate anywhere at all (in-place, so they read as "settled" rather
 * than "flowing"), `driftDown` and `driftUp` are opposite to each other,
 * and `sidleSide` moves purely horizontally. Assigning them so adjacent
 * items alternate keeps the field from reading as a current.
 *
 * Same safety contract as FloatingScienceLayer: `pointer-events-none`
 * and `aria-hidden` throughout (screen readers never see it), `z-0`
 * behind real content, `overflow-hidden` on the wrapper so nothing
 * causes horizontal scroll, CSS-only animation (no JS animation loop —
 * this is a PWA, brief §11), a small, fixed element count, and
 * `prefers-reduced-motion` swaps every animation for a fully static
 * (but still visually present) layout instead of removing the decor
 * entirely.
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
  kind: 'notebook' | 'bookmark' | 'highlighter' | 'pen' | 'pencil' | 'ruler' | 'paper' | 'stickyNote' | 'dot'
}

// Spread across the full page height in loose, non-aligned bands with a
// deliberately alternating motion assignment (no two adjacent items use
// the same one) so nothing reads as a directional current.
const PARTICLES: Particle[] = [
  { id: 'notebook-1', top: '4%', left: '90%', size: 26, colorClassName: 'text-olive', opacity: 0.3, duration: 15, delay: 0, motion: 'bob', kind: 'notebook' },
  { id: 'pencil-1', top: '9%', left: '6%', size: 24, colorClassName: 'text-terracotta', opacity: 0.3, duration: 19, delay: 0.6, motion: 'sidleSide', kind: 'pencil' },
  { id: 'sticky-1', top: '14%', left: '48%', size: 18, colorClassName: 'text-terracotta', opacity: 0.28, duration: 13, delay: 1.1, motion: 'spin', kind: 'stickyNote' },
  { id: 'dot-1', top: '6%', left: '32%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.35, duration: 11, delay: 0.3, motion: 'driftUp', kind: 'dot' },

  { id: 'highlighter-1', top: '24%', left: '94%', size: 26, colorClassName: 'text-sage', opacity: 0.32, duration: 17, delay: 0.9, motion: 'driftDown', kind: 'highlighter' },
  { id: 'bookmark-1', top: '30%', left: '3%', size: 22, colorClassName: 'text-terracotta', opacity: 0.32, duration: 14, delay: 0.2, motion: 'bob', kind: 'bookmark' },
  { id: 'paper-1', top: '34%', left: '60%', size: 24, colorClassName: 'text-ink-tertiary', opacity: 0.24, duration: 20, delay: 1.4, motion: 'sidleSide', kind: 'paper' },
  { id: 'ruler-1', top: '22%', left: '68%', size: 30, colorClassName: 'text-olive', opacity: 0.28, duration: 16, delay: 0.5, motion: 'spin', kind: 'ruler' },

  { id: 'pen-1', top: '46%', left: '8%', size: 24, colorClassName: 'text-olive', opacity: 0.3, duration: 18, delay: 1.6, motion: 'driftUp', kind: 'pen' },
  { id: 'notebook-2', top: '50%', left: '88%', size: 24, colorClassName: 'text-sage', opacity: 0.3, duration: 15, delay: 0.7, motion: 'bob', kind: 'notebook' },
  { id: 'dot-2', top: '44%', left: '42%', size: 7, colorClassName: 'text-ink-tertiary', opacity: 0.35, duration: 12, delay: 0.1, motion: 'sidleSide', kind: 'dot' },
  { id: 'sticky-2', top: '56%', left: '30%', size: 18, colorClassName: 'text-terracotta', opacity: 0.28, duration: 14, delay: 1.0, motion: 'driftDown', kind: 'stickyNote' },

  { id: 'bookmark-2', top: '64%', left: '95%', size: 22, colorClassName: 'text-terracotta', opacity: 0.3, duration: 16, delay: 0.4, motion: 'spin', kind: 'bookmark' },
  { id: 'pencil-2', top: '70%', left: '14%', size: 24, colorClassName: 'text-olive', opacity: 0.3, duration: 19, delay: 1.2, motion: 'bob', kind: 'pencil' },
  { id: 'highlighter-2', top: '68%', left: '55%', size: 24, colorClassName: 'text-sage', opacity: 0.3, duration: 15, delay: 0.8, motion: 'driftUp', kind: 'highlighter' },
  { id: 'ruler-2', top: '76%', left: '78%', size: 28, colorClassName: 'text-ink-tertiary', opacity: 0.24, duration: 17, delay: 0.3, motion: 'sidleSide', kind: 'ruler' },

  { id: 'paper-2', top: '84%', left: '4%', size: 22, colorClassName: 'text-olive', opacity: 0.26, duration: 20, delay: 1.5, motion: 'driftDown', kind: 'paper' },
  { id: 'pen-2', top: '88%', left: '62%', size: 24, colorClassName: 'text-terracotta', opacity: 0.3, duration: 18, delay: 0.6, motion: 'bob', kind: 'pen' },
  { id: 'dot-3', top: '92%', left: '90%', size: 6, colorClassName: 'text-ink-tertiary', opacity: 0.35, duration: 12, delay: 1.1, motion: 'spin', kind: 'dot' },
  { id: 'notebook-3', top: '94%', left: '34%', size: 24, colorClassName: 'text-sage', opacity: 0.28, duration: 15, delay: 0.2, motion: 'sidleSide', kind: 'notebook' }
]

const ANIMATION_NAME: Record<Motion, string> = {
  bob: 'cellfie-vault-bob',
  spin: 'cellfie-vault-spin',
  driftDown: 'cellfie-vault-drift-down',
  driftUp: 'cellfie-vault-drift-up',
  sidleSide: 'cellfie-vault-sidle'
}

function ParticleGlyph({ item }: { item: Particle }) {
  const common = { className: item.colorClassName, style: { opacity: item.opacity } }

  switch (item.kind) {
    case 'notebook':
      return (
        <svg width={item.size} height={item.size * 1.15} viewBox="0 0 24 28" fill="none" {...common}>
          <rect x="3" y="2" width="18" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 6h4M8 2v24" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M11 10h7M11 14h7M11 18h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case 'bookmark':
      return (
        <svg width={item.size * 0.72} height={item.size} viewBox="0 0 18 26" fill="none" {...common}>
          <path d="M2 2h14v22l-7-5-7 5V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )
    case 'highlighter':
      return (
        <svg width={item.size} height={item.size * 0.5} viewBox="0 0 32 16" fill="none" {...common}>
          <path d="M2 5h20l4 3-4 3H2V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M22 5v6" stroke="currentColor" strokeWidth="1.1" />
          <path d="M2 5v6" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      )
    case 'pen':
      return (
        <svg width={item.size * 0.4} height={item.size} viewBox="0 0 10 26" fill="none" {...common}>
          <path d="M5 2 8 6 5 24 2 6 5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M2.6 8h4.8" stroke="currentColor" strokeWidth="1" />
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
    case 'ruler':
      return (
        <svg width={item.size} height={item.size * 0.32} viewBox="0 0 36 12" fill="none" {...common}>
          <rect x="1" y="1" width="34" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 1v4M12 1v6M18 1v4M24 1v6M30 1v4" stroke="currentColor" strokeWidth="1" />
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
    case 'stickyNote':
      return (
        <svg width={item.size} height={item.size} viewBox="0 0 24 24" fill="none" {...common}>
          <path d="M3 3h18v13l-6 5H3V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M21 16h-6v5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      )
    case 'dot':
      return <span className={`${item.colorClassName} block rounded-full`} style={{ width: item.size, height: item.size, opacity: item.opacity, backgroundColor: 'currentColor' }} />
    default:
      return null
  }
}

export function FloatingStudyParticles() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes cellfie-vault-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes cellfie-vault-spin {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(6deg) scale(1.04); }
        }
        @keyframes cellfie-vault-drift-down {
          0% { transform: translateY(-8px) translateX(0); }
          50% { transform: translateY(14px) translateX(6px); }
          100% { transform: translateY(-8px) translateX(0); }
        }
        @keyframes cellfie-vault-drift-up {
          0% { transform: translateY(8px) translateX(0); }
          50% { transform: translateY(-14px) translateX(-6px); }
          100% { transform: translateY(8px) translateX(0); }
        }
        @keyframes cellfie-vault-sidle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(12px) rotate(2deg); }
        }
      `}</style>

      {PARTICLES.map((item) => (
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
