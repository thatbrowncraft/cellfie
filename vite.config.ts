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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Default precache ceiling is 2 MiB; the main JS bundle has grown
        // past that (organism content, Concept/Organism/Laboratory/
        // Comparison modules all bundle in) and will keep growing as more
        // content ships. Raised with real headroom rather than just
        // enough to fit today's bundle, so this doesn't need revisiting
        // every time content is added. Precaching the JS bundle matters
        // here specifically because the app is offline-first.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
