# Cellfie — Design Foundation

This is the design foundation for Cellfie, built against **Design System v1** and **Software Design Document v3**, per Task 3's scope. It contains no learning content, no PDF import, no AI, no search implementation, no lab tools, no notes, and no data — only the reusable UI foundation every future feature will sit on top of.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

> **Note on this build:** this project was generated in a sandboxed environment without network access, so `npm install` / `npm run build` could not be run or verified here. The code was written carefully against the exact library APIs it depends on (React 18, React Router 6, Tailwind 3, vite-plugin-pwa, @phosphor-icons/react), but you should treat the first `npm install && npm run build` on your machine as the real verification step. If something doesn't compile, it's most likely a small version-pinning or icon-name mismatch — see `docs/troubleshooting.md`.

## What's here

- A complete design token system (colors, type scale, spacing, radius, elevation, motion, breakpoints) translated 1:1 from `cellfie-design-system.md`
- Light/dark/system theming, persisted locally, with smooth transitions
- A responsive app shell (top nav, sidebar → icon rail → drawer, bottom tab bar, page transitions)
- A 20+ component reusable UI library (see `docs/components.md`)
- 8 layout primitives (see `docs/layouts.md`)
- Routing to 8 polished placeholder pages — no real feature logic
- PWA scaffolding (installable, offline shell)
- Accessibility: focus states, reduced motion, large-text mode, semantic HTML, keyboard navigation throughout

## What's deliberately NOT here

Per Task 3's brief: no Library logic, no PDF Reader, no search engine, no AI, no flashcards, no learning content, no flowcharts/mind maps (rendering), no organism database, no lab tools/calculators, no notes functionality, no bookmarks functionality, no backend, no API, no data models beyond a placeholder (`src/config/subjects.registry.ts`, `src/core/db/index.ts`).

## Documentation

- [`docs/folder-structure.md`](docs/folder-structure.md) — how the codebase is organized and why
- [`docs/design-tokens.md`](docs/design-tokens.md) — every token, where it lives, how to use it
- [`docs/theming.md`](docs/theming.md) — how the theme system works
- [`docs/components.md`](docs/components.md) — the component library, one entry per component
- [`docs/layouts.md`](docs/layouts.md) — the 8 layout primitives
- [`docs/adding-a-page.md`](docs/adding-a-page.md) — step-by-step: adding a new route
- [`docs/creating-a-component.md`](docs/creating-a-component.md) — step-by-step: adding a new reusable component
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — likely first-build issues and fixes
