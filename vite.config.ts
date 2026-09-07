import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Cellfie — Vite configuration.
// PWA is configured with a conservative, offline-first cache strategy.
// No external analytics, no telemetry, per the product's local-first principles.
//
// `base` is read from a BASE_PATH env var rather than hardcoded, so the
// same config works both locally (`npm run dev`, base "/") and on GitHub
// Pages project sites, which are served from "/<repo-name>/", not "/".
// The deploy workflow (.github/workflows/deploy.yml) sets BASE_PATH
// automatically from the repository name — see docs/deployment.md.
const basePath = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Cellfie',
        short_name: 'Cellfie',
        description: 'A calm, offline-first scientific learning companion.',
        theme_color: '#F6F1E7',
        background_color: '#F6F1E7',
        display: 'standalone',
        // Relative, not "/" — resolved against the manifest's own URL, so
        // installing the PWA works correctly whether it's served from the
        // domain root or a GitHub Pages "/<repo-name>/" subpath.
        //
        // The "?pwa=1" is a deliberate app-launch marker, not a cache-buster.
        // `display-mode: standalone` is supposed to be the reliable signal
        // that this is an installed app rather than a normal browser tab,
        // but on Android an installed shortcut can end up sharing Chrome's
        // per-origin "Request desktop site" state and NOT reliably report
        // `standalone` — there's no way to confirm that from source alone,
        // only from the actual device. This marker is a second, independent
        // signal: Android's home-screen launch always opens exactly this
        // start_url, so its presence alone is enough to identify "this
        // navigation came from the installed app icon," regardless of
        // whatever display-mode/viewport Chrome decides to report. Normal
        // browser visits never carry it. See index.html's inline bootstrap
        // script and useIsStandalonePwa() in shared/hooks/useMediaQuery.ts
        // for where it's read and how it's kept alive for the rest of the
        // app session.
        start_url: './?pwa=1',
        scope: '.',
        icons: [
          // Real 192/512 PNGs, required for Android to treat an
          // "Add to Home Screen" install as a genuine WebAPK (standalone
          // display-mode) rather than a plain browser-tab shortcut. An
          // SVG-only icon list is spec-legal and fine for desktop/iOS,
          // but on Android it's the difference between the installed app
          // actually getting `display-mode: standalone` — which is what
          // useIsStandalonePwa()/useBreakpoint() key off of to force the
          // mobile layout — and silently falling back to a bookmark that
          // opens in ordinary (non-standalone) Chrome, where the mobile-
          // only rule never even engages. The SVG favicon stays too, for
          // browser tab/address-bar icons where it works fine everywhere.
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Separate maskable variants with the artwork inset to an ~80%
          // safe zone, since Android can crop a maskable icon into a
          // circle/squircle/rounded-square and a full-bleed image (like
          // the "any" icons above) would get its edges clipped.
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // NOTE: 'pdf' was briefly added here to precache the bundled
        // Cellfie User Manual (public/manual/cellfie-user-manual.pdf) at
        // install time. That broke the build: the manual is 2.36 MB,
        // over Workbox's default 2 MiB precache ceiling (see the
        // bundle-size note below on why that ceiling is intentional and
        // not just raised). Precaching was never actually necessary for
        // this file anyway — ManualReaderOverlay.tsx only fetch()es it
        // when the reader is opened (see MANUAL_PDF_URL there), so it's
        // lazy by design already. runtimeCaching below gets the same
        // "works offline after first read" outcome without touching the
        // precache budget: CacheFirst stores it in its own named cache
        // the first time someone opens the manual, and
        // maximumFileSizeToCacheInBytes doesn't apply to runtime
        // caching, only precaching.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Matches the manual regardless of BASE_PATH (GitHub Pages
            // subpath vs local "/"), since it checks the end of the
            // pathname rather than the full URL.
            urlPattern: ({ url }) => url.pathname.endsWith('/manual/cellfie-user-manual.pdf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'cellfie-manual',
              expiration: {
                maxEntries: 1,
                // The manual ships as a static, versioned build asset —
                // it only changes when the app is rebuilt/redeployed, at
                // which point autoUpdate's service-worker refresh takes
                // over anyway. A long age just avoids needless re-fetches
                // of an otherwise-immutable file.
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
        // Bundle-size remediation: a previous change here raised
        // maximumFileSizeToCacheInBytes to 5 MiB to paper over a 2.11 MB
        // main JS chunk (organism + laboratory content registries were
        // being eagerly bundled — see core/organisms/registry.ts and
        // core/laboratory/registry.ts). That override masked the actual
        // problem rather than fixing it, and would have let the initial
        // bundle keep growing unnoticed. It's been removed in favor of
        // route-level code splitting (src/app/router.tsx) plus decoupling
        // global search (core/search) and Dashboard's recently-viewed
        // organism lookup from the two content registries, so every
        // emitted chunk — including the pdf.worker chunk — now fits
        // under Workbox's default 2 MiB precache ceiling on its own
        // merits. If a genuinely large single asset is ever needed again,
        // raise this deliberately and explain why, rather than as a
        // reaction to a bundle that grew unchecked.
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
