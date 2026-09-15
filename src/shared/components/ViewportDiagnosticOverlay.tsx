import { useState, type CSSProperties } from 'react'
import { useViewportDiagnostics } from '../hooks/useViewportDiagnostics'

/**
 * TEMPORARY — pre-APK viewport/zoom diagnostic overlay. See
 * useViewportDiagnostics.ts for why this exists and what it's for, and
 * docs/viewport-zoom-fix.md for the investigation this was built to support.
 *
 * Ugly on purpose — this is a debugging instrument, not a UI surface.
 * Deliberately does not reuse Cellfie's Card/Typography/design-token system
 * so it stays legible even if a future layout bug affects those components.
 *
 * DELETE THIS FILE once the viewport/zoom fix is confirmed working on a
 * real device — along with useViewportDiagnostics.ts and the
 * `SHOW_VIEWPORT_DIAGNOSTIC` line + import in AppShell.tsx.
 */
export function ViewportDiagnosticOverlay() {
  const [open, setOpen] = useState(true)
  const d = useViewportDiagnostics()

  const wrapStyle: CSSProperties = {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
    left: 8,
    zIndex: 99999,
    background: 'rgba(0, 0, 0, 0.88)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 1.45,
    borderRadius: 4,
    maxWidth: open ? '92vw' : undefined,
    maxHeight: open ? '80vh' : undefined,
    overflow: open ? 'auto' : 'hidden',
    boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
  }

  const scaleColor =
    d.pageScale === 'NORMAL' ? '#7CFC7C' : d.pageScale === 'UNKNOWN' ? '#aaa' : '#ff6b6b'

  return (
    <div style={wrapStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 10px',
          background: 'transparent',
          color: scaleColor,
          border: 'none',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 700,
          textAlign: 'left'
        }}
      >
        CELLFIE VIEWPORT DIAGNOSTIC — {d.pageScale} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ padding: '0 10px 10px 10px', whiteSpace: 'pre' }}>
          {`Viewport            ${d.innerWidth} × ${d.innerHeight}
Outer               ${d.outerWidth} × ${d.outerHeight}
Client (layout vp)  ${d.clientWidth} × ${d.clientHeight}
Visual viewport     ${d.visualViewportWidth ?? 'n/a'} × ${d.visualViewportHeight ?? 'n/a'}
Visual scale        ${d.visualViewportScale ?? 'n/a'}
Layout vp scale     ${d.layoutViewportScale != null ? d.layoutViewportScale.toFixed(3) : 'n/a'}
DPR                 ${d.devicePixelRatio}
Scroll size         ${d.scrollWidth} × ${d.scrollHeight}
Screen              ${d.screenWidth} × ${d.screenHeight}
Screen avail        ${d.screenAvailWidth} × ${d.screenAvailHeight}
html font-size      ${d.htmlFontSize}
body font-size      ${d.bodyFontSize}
#root transform     ${d.rootTransform}
#root zoom          ${d.rootZoom}
#root size          ${d.rootWidth.toFixed(0)} × ${d.rootHeight.toFixed(0)}
body size           ${d.bodyWidth.toFixed(0)} × ${d.bodyHeight.toFixed(0)}
Horizontal overflow ${d.horizontalOverflow}
Vertical overflow   ${d.verticalOverflow}
Page scale          ${d.pageScale}`}
        </div>
      )}
    </div>
  )
}
