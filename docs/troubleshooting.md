# Troubleshooting

This project was built without network access in the environment that generated it, so `npm install` and `npm run build` were never actually executed against it. Everything here was written carefully against known library APIs, but treat your first local build as the real test. This page lists the most likely failure points and the one-line fix for each.

## `npm install` fails on a version

The versions pinned in `package.json` were current as of early-to-mid 2026 knowledge. If npm complains about a specific package version not existing (registries do occasionally deprecate old prereleases), relax that one version specifier to `"^x.y.0"` or `"latest"` and reinstall — nothing in this codebase depends on a narrow patch range.

## An `@phosphor-icons/react` icon name isn't found

Icons used here: `List, MagnifyingGlass, WifiSlash, WifiHigh, Sun, Moon, Monitor, X, CaretDown, Check, DotsThreeVertical, Bookmark, Pencil, Lightbulb, Warning, ShieldWarning, Sparkle, WarningCircle, House, BookOpen, GitBranch, Bug, Flask, Scales, NotePencil, Gear, Compass, TextAa, Download, Upload`.

If TypeScript flags one of these as not exported, search the exact name at [phosphoricons.com](https://phosphoricons.com) — Phosphor occasionally renames or splits icons between "Simple" and non-"Simple" variants (e.g. `Pencil` vs `PencilSimple`). Swap the import for whatever the installed version actually calls it; the visual difference between variants is minor and won't affect layout.

## TypeScript complains about unused variables/imports

`tsconfig.json` has `noUnusedLocals` and `noUnusedParameters` set to `true`, which is intentional (it's the fastest way to catch dead code in a foundation nobody's built features on top of yet). If you're actively developing and this gets in the way temporarily, it's fine to comment those two lines out in your local checkout — just don't leave them off when you commit.

## `color-mix()` doesn't render as expected

The `.wash-*` utility classes in `index.css` use `color-mix(in srgb, ...)`, which needs a browser from roughly 2023 onward (all current evergreen browsers qualify). If you need to support something older, replace those four rules with precomputed `rgba()` fallback values per theme.

## The deckled-edge illustration frame looks too aggressive / too subtle

That's the SVG `feTurbulence`/`feDisplacementMap` filter in `IllustrationFrame.tsx`. Tune `baseFrequency` (currently `0.02`) and `scale` (currently `6`) — lower `baseFrequency` = larger, calmer waves; higher `scale` = more pronounced distortion.

## Fonts don't look right / fall back to a generic serif

Check that the Google Fonts `<link>` tags in `index.html` actually loaded (open devtools → Network → filter "fonts"). If you're building somewhere without internet access at runtime (unlikely for a real deployment, but possible in a locked-down intranet), you'll need to self-host Fraunces/Literata/Karla/IBM Plex Mono instead of pulling from Google Fonts — download the `.woff2` files and add `@font-face` rules to `index.css`.

## PWA install prompt doesn't appear / manifest warnings in devtools

The manifest currently points at `favicon.svg` as its only icon. That's valid but minimal — before shipping, generate real 192×192 and 512×512 PNG icons and add them to `public/`, then update the `icons` array in `vite.config.ts`'s `VitePWA` manifest block.
