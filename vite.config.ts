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
        start_url: '.',
        scope: '.',
        icons: [
          // Swap in real 192/512 PNGs before shipping; the SVG favicon
          // works as a manifest icon in all evergreen browsers today and
          // keeps this foundation buildable without binary assets.
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
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
