import { useEffect } from 'react'

/**
 * storage-persistence — a minimal, one-shot wrapper around
 * `navigator.storage.persist()`.
 *
 * WHY THIS EXISTS
 * Cellfie's user data (Dexie/IndexedDB for structured data, OPFS for PDF
 * binaries — see core/file-storage) lives entirely on-device with no
 * cloud backup by design. Without persistent storage, that data is
 * "best-effort": the browser is allowed to silently evict it under
 * storage pressure, same as it would evict a cache. For an app whose
 * whole value proposition is "your imported PDFs and notes are safely
 * on your device," that eviction risk is worth closing off.
 *
 * WHY THIS IS SAFE TO CALL
 * - Feature-detected: `navigator.storage?.persist` is checked before use,
 *   mirroring the existing `isOpfsAvailable()` pattern in
 *   core/file-storage/index.ts. Absent entirely, this is a silent no-op.
 * - No user gesture required: unlike (for example) clipboard APIs,
 *   `persist()` does not require a click/tap to invoke.
 * - No blocking UI on the browsers Cellfie actually targets: on Android
 *   Chrome (Cellfie's primary target, and the engine behind the eventual
 *   TWA/APK build), Chrome decides silently using its own site-engagement
 *   heuristics — no permission dialog is shown, so there is nothing to
 *   nag the user with. Firefox does show a one-time permission prompt,
 *   but only once ever per origin; it remembers the answer and never
 *   asks again regardless of how often this function runs.
 * - Never blocks startup: fired from a `useEffect` after mount (see
 *   `useRequestPersistentStorage` below), not awaited by anything in the
 *   render path.
 * - Denial is silently accepted: if the browser says no, or already
 *   granted, or the call rejects for any reason, Cellfie's storage
 *   architecture (Dexie, OPFS) is completely unaffected either way —
 *   `persist()` only ever changes eviction *priority*, never how or
 *   whether the existing storage code reads/writes.
 * - Called at most once per browser session: gated behind a module-level
 *   flag, not a render-cycle or route change, so remounts (e.g. React
 *   StrictMode's double-invoke in dev) don't fire it twice in a row.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * No new settings UI, no persisted "did we ask" flag in localStorage or
 * Dexie (session-scoped is enough — persist() itself is idempotent and
 * cheap to call again on a future visit), no retry/backoff logic, no
 * telemetry. If it's unsupported or denied, Cellfie just keeps working
 * exactly as it does today.
 */

let requested = false

/**
 * Feature-detects and, if available, requests persistent storage.
 * Safe to call multiple times — only the first call in a session does
 * anything; the rest are no-ops. Never throws.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (requested) return
  requested = true

  try {
    if (typeof navigator === 'undefined') return
    if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') {
      // Unsupported browser/context (e.g. older WebView, non-secure
      // origin). Cellfie's storage keeps working as best-effort, exactly
      // as it did before this module existed.
      return
    }

    // Already persisted (possible on a repeat visit, or if the platform
    // granted it automatically) — nothing to do.
    if (typeof navigator.storage.persisted === 'function') {
      const already = await navigator.storage.persisted()
      if (already) return
    }

    // Fire and let the browser decide. Resolves `true`/`false`; either
    // outcome is fine and requires no follow-up from Cellfie.
    await navigator.storage.persist()
  } catch {
    // Any failure here (unsupported, permissions-policy blocked,
    // browser quirk) is not actionable and not worth surfacing —
    // storage keeps working in best-effort mode, same as before.
  }
}

/**
 * Requests persistent storage once, after mount. Intended to be called
 * once near the top of the app (see App.tsx), the same way
 * `useStandaloneViewportScaleFix` is — a side-effect-only hook with no
 * return value and no effect on render.
 */
export function useRequestPersistentStorage() {
  useEffect(() => {
    void requestPersistentStorage()
  }, [])
}
