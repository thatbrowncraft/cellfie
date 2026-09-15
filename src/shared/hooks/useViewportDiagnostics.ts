import { useEffect, useState } from 'react'

/**
 * TEMPORARY — pre-APK viewport/zoom diagnostic (see docs/viewport-zoom-fix.md
 * and shared/components/ViewportDiagnosticOverlay.tsx, which renders this).
 *
 * Same reason this project already has `usePwaDebugSignals`/`PwaDebugBadge`
 * (shared/hooks/useMediaQuery.ts, shared/components/PwaDebugBadge.tsx):
 * Cellfie is built and tested entirely from an Android phone, so there is no
 * devtools/USB debugging session to inspect `window.visualViewport` etc. on
 * the real device — the numbers have to be readable on-screen instead.
 *
 * This is broader than that existing diagnostic on purpose: this one is for
 * confirming/ruling out every mechanism the pinch-zoom investigation could
 * plausibly be (browser page zoom, pinch zoom, viewport meta, visualViewport
 * scaling, CSS transform/zoom on the app root, incorrect root sizing, an
 * accidental min-width/fixed-width layout, device-pixel-ratio confusion, or
 * a responsive-breakpoint issue), not specifically the Request-Desktop-Site
 * 980px case `usePwaDebugSignals` was built for. The two overlays are kept
 * separate rather than merged, since they answer different questions and
 * this one is meant to come out again once the zoom fix is confirmed.
 *
 * DELETE THIS FILE (and ViewportDiagnosticOverlay.tsx, and the
 * `SHOW_VIEWPORT_DIAGNOSTIC` line + import in AppShell.tsx) once the fix is
 * confirmed working on-device.
 */
export interface ViewportDiagnosticSnapshot {
  innerWidth: number
  innerHeight: number
  clientWidth: number
  clientHeight: number
  outerWidth: number
  outerHeight: number
  devicePixelRatio: number
  visualViewportWidth: number | null
  visualViewportHeight: number | null
  visualViewportScale: number | null
  scrollWidth: number
  scrollHeight: number
  screenWidth: number
  screenHeight: number
  screenAvailWidth: number
  screenAvailHeight: number
  htmlFontSize: string
  bodyFontSize: string
  rootTransform: string
  rootZoom: string
  rootWidth: number
  rootHeight: number
  bodyWidth: number
  bodyHeight: number
  horizontalOverflow: number
  verticalOverflow: number
  /** visualViewport.width ÷ layout-viewport (documentElement) width — ~1 when
   *  what's rendered matches what's shown; well below 1 is the signature of
   *  a layout laid out wider than the physical screen (e.g. the 980px
   *  Request-Desktop-Site case), independent of pinch-zoom. */
  layoutViewportScale: number | null
  /** Coarse verdict, not a substitute for reading the raw numbers above. */
  pageScale: 'NORMAL' | 'ZOOMED' | 'OVERFLOW' | 'UNKNOWN'
}

function readSnapshot(): ViewportDiagnosticSnapshot {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      innerWidth: 0,
      innerHeight: 0,
      clientWidth: 0,
      clientHeight: 0,
      outerWidth: 0,
      outerHeight: 0,
      devicePixelRatio: 0,
      visualViewportWidth: null,
      visualViewportHeight: null,
      visualViewportScale: null,
      scrollWidth: 0,
      scrollHeight: 0,
      screenWidth: 0,
      screenHeight: 0,
      screenAvailWidth: 0,
      screenAvailHeight: 0,
      htmlFontSize: '',
      bodyFontSize: '',
      rootTransform: '',
      rootZoom: '',
      rootWidth: 0,
      rootHeight: 0,
      bodyWidth: 0,
      bodyHeight: 0,
      horizontalOverflow: 0,
      verticalOverflow: 0,
      layoutViewportScale: null,
      pageScale: 'UNKNOWN'
    }
  }

  const docEl = document.documentElement
  const vv = window.visualViewport
  const htmlComputed = window.getComputedStyle(docEl)
  const bodyComputed = window.getComputedStyle(document.body)
  const rootEl = document.getElementById('root')
  const rootComputed = rootEl ? window.getComputedStyle(rootEl) : null

  const horizontalOverflow = docEl.scrollWidth - docEl.clientWidth
  const verticalOverflow = docEl.scrollHeight - docEl.clientHeight
  const visualViewportScale = vv ? vv.scale : null
  const layoutViewportScale = vv && docEl.clientWidth ? vv.width / docEl.clientWidth : null

  let pageScale: ViewportDiagnosticSnapshot['pageScale'] = 'UNKNOWN'
  if (visualViewportScale != null) {
    if (horizontalOverflow > 2) {
      pageScale = 'OVERFLOW'
    } else if (visualViewportScale < 0.97 || visualViewportScale > 1.03) {
      pageScale = 'ZOOMED'
    } else {
      pageScale = 'NORMAL'
    }
  }

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: docEl.clientWidth,
    clientHeight: docEl.clientHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    visualViewportWidth: vv ? vv.width : null,
    visualViewportHeight: vv ? vv.height : null,
    visualViewportScale,
    scrollWidth: docEl.scrollWidth,
    scrollHeight: docEl.scrollHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    screenAvailWidth: window.screen.availWidth,
    screenAvailHeight: window.screen.availHeight,
    htmlFontSize: htmlComputed.fontSize,
    bodyFontSize: bodyComputed.fontSize,
    rootTransform: rootComputed ? rootComputed.transform : 'n/a',
    rootZoom: rootComputed ? rootComputed.getPropertyValue('zoom') || 'n/a' : 'n/a',
    rootWidth: rootEl ? rootEl.getBoundingClientRect().width : 0,
    rootHeight: rootEl ? rootEl.getBoundingClientRect().height : 0,
    bodyWidth: document.body.getBoundingClientRect().width,
    bodyHeight: document.body.getBoundingClientRect().height,
    horizontalOverflow,
    verticalOverflow,
    layoutViewportScale,
    pageScale
  }
}

/**
 * Live-updating viewport diagnostic snapshot. Re-reads on every event that
 * could plausibly change page scale: window resize, the Visual Viewport
 * API's own resize/scroll events (fired on pinch-zoom and address-bar
 * show/hide), orientation change, and scroll (to catch layout-driven
 * horizontal overflow appearing/disappearing).
 */
export function useViewportDiagnostics(): ViewportDiagnosticSnapshot {
  const [snapshot, setSnapshot] = useState(readSnapshot)

  useEffect(() => {
    let raf = 0
    function scheduleUpdate() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSnapshot(readSnapshot()))
    }

    scheduleUpdate()

    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('orientationchange', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.visualViewport?.addEventListener('resize', scheduleUpdate)
    window.visualViewport?.addEventListener('scroll', scheduleUpdate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('orientationchange', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate)
      window.visualViewport?.removeEventListener('resize', scheduleUpdate)
      window.visualViewport?.removeEventListener('scroll', scheduleUpdate)
    }
  }, [])

  return snapshot
}
