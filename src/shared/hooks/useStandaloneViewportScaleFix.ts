import { useEffect } from 'react'
import { useIsStandalonePwa } from './useMediaQuery'

/**
 * Standalone-PWA-only correction for Chrome's 980px "Request Desktop
 * Site" virtual viewport bleeding into the installed Android Cellfie
 * app.
 *
 * ROOT CAUSE (confirmed via PwaDebugBadge on a real device): standalone
 * detection and useBreakpoint() are already correct — an installed
 * Android WebAPK shares Chrome's per-origin "Request desktop site"
 * setting, and when that's on, Chrome forces the page's layout
 * viewport to ~980px CSS px regardless of the page's own
 * `<meta name="viewport">` (that override is the entire point of the
 * feature, so rewriting the meta tag at runtime cannot undo it — this
 * was tried and ruled out). Chrome then auto-scales that 980px-wide
 * layout down to fit the physical screen, which is what makes the
 * correctly-selected mobile UI *render* at a fraction of its intended
 * size instead of failing to render at all.
 *
 * `visualViewport.scale` is Chrome's own report of exactly that
 * auto-fit ratio (visual viewport ÷ layout viewport) — i.e. it already
 * tells us how compressed the current render is, with no need to
 * derive it indirectly from screen/window dimensions. The fix is to
 * apply a counter-zoom of `1 / visualViewport.scale` to the document
 * root, so the two multiply out to ~1 (true physical size) instead of
 * guessing or hardcoding a phone-specific number.
 *
 * WHY `zoom` AND NOT `transform: scale()`: a `transform` on an
 * ancestor creates a new containing block for any `position: fixed`
 * descendant (BottomNav, the Quick Capture FAB, dialogs/drawers), so
 * they'd stop tracking the real screen and start tracking the
 * transformed wrapper instead — silently breaking exactly the fixed
 * UI this fix must not touch. `zoom` is a genuine layout-level scale
 * with no such side effect: `position: fixed` descendants keep
 * resolving against the real viewport. The tradeoff is that `zoom` is
 * Chromium/WebKit-only and unstandardized — acceptable here because
 * this whole code path only ever runs inside the installed Android
 * Chrome WebAPK (guarded by `useIsStandalonePwa()` below), never in a
 * normal browser tab or on desktop.
 *
 * SELF-CORRECTING BY CONSTRUCTION: once the counter-zoom is applied,
 * Chrome's own auto-fit collapses back toward 1:1, so
 * `visualViewport.scale` itself settles near 1 and the next
 * recalculation (fired by the `visualViewport`/`resize`/
 * `orientationchange` listeners below) computes a target close to 1 —
 * i.e. effectively a no-op. There's no separate "undo" branch needed:
 * a scale that's already ~1 just re-applies ~1.
 *
 * NORMAL BROWSER TABS AND DESKTOP ARE NEVER TOUCHED: the entire effect
 * is a no-op whenever `useIsStandalonePwa()` is false, which is every
 * ordinary Chrome tab (whether or not Request Desktop Site is on) and
 * every desktop browser — none of those ever get a `zoom` style
 * written to `<html>`.
 */
export function useStandaloneViewportScaleFix() {
  const isStandalone = useIsStandalonePwa()

  useEffect(() => {
    const root = document.documentElement

    if (!isStandalone) {
      // Defensive only — normal tabs never reach this branch with a zoom
      // already set, since the effect below never runs for them. Kept
      // so a hot-reload or an unexpected standalone->non-standalone
      // transition within the same session can never leave a stale
      // zoom behind.
      root.style.removeProperty('zoom')
      return
    }

    // Below this line, this session is confirmed to be the installed
    // Cellfie PWA (see useIsStandalonePwa's three independent signals) —
    // normal Chrome mobile tabs, Chrome's Request-Desktop-Site toggle in
    // a normal tab, and desktop browsers never execute anything past
    // this guard.

    let raf = 0

    function recalculate() {
      const vv = window.visualViewport

      // No Visual Viewport API support: nothing reliable to correct
      // against, so leave native rendering exactly as-is rather than
      // guess. (Every real Android Chrome version this targets has it.)
      if (!vv || !vv.scale || !Number.isFinite(vv.scale)) {
        root.style.removeProperty('zoom')
        return
      }

      const TRIGGER_THRESHOLD = 0.92
      const CLAMP_MIN = 0.5
      const CLAMP_MAX = 4

      if (vv.scale >= TRIGGER_THRESHOLD) {
        // Already rendering at (near) true scale — either a normal
        // standalone launch with no desktop-site override in play, or
        // our own previous correction already converged. Nothing to do.
        root.style.removeProperty('zoom')
        return
      }

      // Derived from live measurements every time, never a fixed
      // per-device constant — this is what makes it work across
      // different Android phone sizes rather than one specific screen.
      const targetZoom = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, 1 / vv.scale))
      root.style.setProperty('zoom', String(targetZoom))
    }

    function scheduleRecalculate() {
      // Coalesce bursts of resize/visualViewport events (address-bar
      // show/hide, keyboard open/close, rapid rotation) into a single
      // measurement-and-apply per animation frame, so this never fights
      // itself mid-transition.
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(recalculate)
    }

    scheduleRecalculate()

    window.addEventListener('resize', scheduleRecalculate)
    window.addEventListener('orientationchange', scheduleRecalculate)
    window.visualViewport?.addEventListener('resize', scheduleRecalculate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleRecalculate)
      window.removeEventListener('orientationchange', scheduleRecalculate)
      window.visualViewport?.removeEventListener('resize', scheduleRecalculate)
    }
  }, [isStandalone])
}
