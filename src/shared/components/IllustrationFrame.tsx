import { useEffect, useId, useState } from 'react'
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
 *
 * Two behaviors fixed after the live Organism Explorer showed broken-
 * image icons instead of illustrations:
 *
 * 1. A real `onError` fallback. Previously, an `<img>` whose `src` 404'd
 *    just rendered the browser's own broken-image icon plus visible alt
 *    text — never acceptable UI. Now any load failure (a stale custom-
 *    image blob URL, an organism with no built-in SVG yet, a bad path)
 *    falls through to the same intentional "Illustration placeholder"
 *    state used when `src` is absent, with no infinite retry loop (the
 *    failed `src` is never re-attempted; a *new* `src` — e.g. after the
 *    user uploads a different image — gets a fresh, uncorrupted attempt
 *    since the error flag resets whenever `src` itself changes).
 * 2. A real, consistent 4:3 aspect box around the image itself, not
 *    just around the empty-state placeholder. Previously only the
 *    placeholder had `aspect-[4/3]`; an actual loaded `<img>` had no
 *    intrinsic sizing at all, so it rendered at whatever thin height
 *    happened to result from the surrounding layout — the "banner, not
 *    an illustration" problem. `object-contain` keeps the artwork
 *    fully visible and undistorted inside that box rather than cropping
 *    it (appropriate for scientific illustrations, as opposed to
 *    `object-cover`, which is right for photos).
 */
export function IllustrationFrame({ src, alt, caption, className }: IllustrationFrameProps) {
  const filterId = `deckle-${useId()}`
  const [hasErrored, setHasErrored] = useState(false)

  // A new src (different upload, different organism) always deserves a
  // fresh attempt — only the src that actually just failed stays failed.
  useEffect(() => {
    setHasErrored(false)
  }, [src])

  const showImage = Boolean(src) && !hasErrored

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

        {showImage ? (
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-surface-raised">
            <img
              src={src}
              alt={alt}
              onError={() => setHasErrored(true)}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-md bg-surface-raised px-4 text-center font-ui text-caption text-ink-tertiary"
            role="img"
            aria-label={alt}
          >
            <span>Illustration unavailable</span>
            <span className="font-body text-micro text-ink-tertiary/80">Add your illustration</span>
          </div>
        )}
      </div>

      <figcaption className="absolute -bottom-3 left-3 rounded-sm border border-border-strong bg-canvas px-2 py-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-secondary shadow-1">
        {caption}
      </figcaption>
    </figure>
  )
}
