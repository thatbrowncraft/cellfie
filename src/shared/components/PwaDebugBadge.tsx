import { useState, type CSSProperties } from 'react'
import { usePwaDebugSignals } from '../hooks/useMediaQuery'

/**
 * TEMPORARY on-device diagnostic badge for the PWA mobile-lock fix.
 *
 * This exists specifically because this project is built and deployed
 * entirely from an Android phone with no laptop/devtools/USB debugging
 * available — so there is no other way to see what useIsStandalonePwa()
 * and useBreakpoint() are actually computing on the real installed app.
 * Tap the badge to expand it and read every signal directly off screen.
 *
 * WHAT TO CHECK: open the installed Cellfie icon (not a browser tab),
 * expand the badge, and confirm:
 *   - "session" is true (this is the "?pwa=1" marker actually working)
 *   - "breakpoint" says mobile
 * Then toggle Chrome's Request Desktop Site setting and refresh/reopen —
 * "session" and "breakpoint" should NOT change. If they don't change but
 * the layout still looks like desktop, the bug is in a component that
 * isn't reading useBreakpoint() at all. If "session" itself flips to
 * false or was never true to begin with, the marker isn't reaching this
 * build — see the notes on href/manifest below.
 *
 * REMOVE THIS once the fix is confirmed working: delete this file and
 * the <PwaDebugBadge /> line + import in AppShell.tsx.
 */
export function PwaDebugBadge() {
  const [open, setOpen] = useState(false)
  const signals = usePwaDebugSignals()

  const badgeStyle: CSSProperties = {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
    right: 8,
    zIndex: 9999,
    background: 'rgba(20, 16, 12, 0.92)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 1.5,
    borderRadius: 8,
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    maxWidth: open ? '86vw' : undefined
  }

  return (
    <div style={badgeStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 10px',
          background: 'transparent',
          color: signals.breakpoint === 'mobile' ? '#9bbf7e' : '#e0a0ad',
          border: 'none',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 700,
          textAlign: 'left'
        }}
      >
        PWA: {signals.breakpoint.toUpperCase()} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ padding: '0 10px 10px 10px', wordBreak: 'break-all' }}>
          <div>breakpoint: {signals.breakpoint}</div>
          <div>display-mode standalone: {String(signals.isStandaloneDisplayMode)}</div>
          <div>ios standalone: {String(signals.isIosStandalone)}</div>
          <div>app-launch session: {String(signals.isAppLaunchSession)}</div>
          <div>sessionStorage raw: {String(signals.sessionStorageRaw)}</div>
          <div>window.__CELLFIE_PWA_SESSION__: {String(signals.globalFlag)}</div>
          <div>html.cellfie-pwa class: {String(signals.htmlHasClass)}</div>
          <div>innerWidth: {signals.innerWidth}</div>
          <div>href: {signals.href}</div>
        </div>
      )}
    </div>
  )
}
