import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './core/theme'
import { AppRouter } from './app/router'
import { useStandaloneViewportScaleFix } from './shared/hooks'

/**
 * App — top-level composition root. ThemeProvider wraps everything so
 * theme tokens are available before first paint; BrowserRouter drives
 * client-side navigation for the PWA shell.
 *
 * `basename` uses Vite's `import.meta.env.BASE_URL`, which mirrors
 * whatever `base` was set to at build time (see vite.config.ts). Locally
 * that's "/"; on GitHub Pages it's "/<repo-name>/" — without this, every
 * in-app link would 404 once the app is served from a subpath.
 */
export function App() {
  // Standalone-PWA-only fix for Chrome's 980px "Request Desktop Site"
  // virtual viewport being applied to the installed Android app — see
  // the hook itself for the full root-cause writeup. Called here (not
  // inside AppShell) so it takes effect on first paint regardless of
  // which route loads first, and is a guaranteed no-op for every normal
  // browser tab and desktop browser.
  useStandaloneViewportScaleFix()

  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRouter />
      </BrowserRouter>
    </ThemeProvider>
  )
}
