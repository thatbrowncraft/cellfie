import { useId } from 'react'
import { cn } from '../utils/cn'

interface IllustrationFrameProps {
  src?: string
  alt: string
  caption: string
  className?: string
}

/**
 * Illustration Frame — Cellfie's one signature visual element (§1, §7, §10.13).
 * Soft deckled edge (hand-torn paper effect) + a specimen-label caption tab,
 * styled like a museum specimen card. Reserved for illustrated/curated
 * content only — never applied to PDF thumbnails or UI screenshots.
 * The decorative deckled-edge SVG is aria-hidden; only the image's real
 * content and caption are exposed to assistive tech (§13).
 */
export function IllustrationFrame({ src, alt, caption, className }: IllustrationFrameProps) {
  const filterId = `deckle-${useId()}`

  return (
    <figure className={cn('relative inline-block rounded-lg', className)}>
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-2">
        {/* Deckled edge overlay — decorative only */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-border-strong opacity-60"
          preserveAspectRatio="none"
        >
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
          </filter>
          <rect
            x="1"
            y="1"
            width="99%"
            height="99%"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            filter={`url(#${filterId})`}
          />
        </svg>

        {src ? (
          <img src={src} alt={alt} className="relative block w-full rounded-md" />
        ) : (
          <div
            className="relative flex aspect-[4/3] w-full items-center justify-center rounded-md bg-surface-raised font-ui text-caption text-ink-tertiary"
            role="img"
            aria-label={alt}
          >
            Illustration placeholder
          </div>
        )}
      </div>

      <figcaption className="absolute -bottom-3 left-3 rounded-sm border border-border-strong bg-canvas px-2 py-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-secondary shadow-1">
        {caption}
      </figcaption>
    </figure>
  )
}
