# Theme System

## How it works

`src/core/theme/ThemeProvider.tsx` holds three pieces of state:

- **`mode`** — what the person picked: `'system' | 'light' | 'dark'`. Persisted to `localStorage` under `cellfie:theme-mode`.
- **`resolvedTheme`** — the theme actually applied right now: `'light' | 'dark'`. When `mode` is `'system'`, this tracks `window.matchMedia('(prefers-color-scheme: dark)')` live — if the OS theme changes while Cellfie is open, it updates without a reload.
- **`largeText`** — a boolean, persisted under `cellfie:large-text`, for the Design System's §13 large-text accessibility requirement.

`resolvedTheme` is written to `document.documentElement.setAttribute('data-theme', ...)`. Every color token in `index.css` is scoped to `[data-theme='light']` or `[data-theme='dark']`, so this one attribute is the entire theme switch — no class toggling, no component re-render needed for colors to update, since they're CSS variables the browser re-resolves instantly.

`largeText` similarly sets `data-large-text="true"` on `<html>`, which triggers a `font-size: 118%` rule in `index.css` — everything sized in `rem` (which is everything, per the type scale) scales together.

## Using it in a component

```tsx
import { useTheme } from '@/core/theme'

function MyComponent() {
  const { mode, resolvedTheme, setMode, largeText, setLargeText } = useTheme()
  // ...
}
```

`useTheme()` throws if called outside `<ThemeProvider>` — but since `ThemeProvider` wraps the whole app in `App.tsx`, you won't hit this in practice.

## Why no flash on load

Because the theme is applied via a `useEffect` in `ThemeProvider`, there's a brief moment on first paint before `data-theme` is set, where the page would render with light-theme CSS variable defaults (`:root` and `[data-theme='light']` share the same values). If you want to eliminate even that first-paint flash for a user with `mode: 'dark'` stored, add a tiny inline script in `index.html`'s `<head>` that reads `localStorage.getItem('cellfie:theme-mode')` and sets `data-theme` before React mounts. This wasn't added by default to keep `index.html` free of inline logic during the foundation build — it's a one-function addition if you want it.

## Adding a new themed color

1. Add the light value to `:root, [data-theme='light']` and the dark value to `[data-theme='dark']` in `index.css`.
2. Add a matching entry to `theme.extend.colors` in `tailwind.config.ts`, pointing at the new CSS variable.
3. Use it as a normal Tailwind utility (`bg-your-new-token`, `text-your-new-token`).

Don't hardcode a hex value in a component — if it needs to differ between light and dark, it belongs in this token system, not inline.
