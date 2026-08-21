/**
 * core/organisms/assetPath — fixes the root cause of the broken-image
 * icons reported on the live Organism Explorer.
 *
 * ROOT CAUSE: every organism JSON file's `image` field was written as a
 * hardcoded absolute path, e.g. "/organisms/escherichia-coli.svg". That
 * resolves to `https://<domain>/organisms/escherichia-coli.svg` — the
 * domain *root* — no matter where the app is actually deployed. This
 * app's own vite.config.ts sets `base` from a `BASE_PATH` env var
 * specifically because GitHub Pages *project* sites are served from
 * `/<repo-name>/`, not `/` (see the comment right above `basePath` in
 * vite.config.ts, and how `src/App.tsx` correctly uses
 * `import.meta.env.BASE_URL` as the router's `basename`). The SVG files
 * themselves were never missing or malformed — every one of them is a
 * real, valid file in `public/organisms/`, and `public/` assets ARE
 * included in the production build and served correctly by GitHub
 * Pages. The `<img src>` values pointing at the wrong base path is the
 * entire bug: routing worked because it used `BASE_URL`; images 404'd
 * because their src strings never did.
 *
 * THE FIX (strategy-level, not per-organism): organism content files
 * now store `image` as a path *relative to the public root*, with no
 * leading slash — e.g. "organisms/escherichia-coli.svg". Every call
 * site that turns that into an actual `<img src>` runs it through
 * `resolvePublicAssetPath` first, which prefixes it with the app's real
 * `import.meta.env.BASE_URL` — the same value the router already trusts
 * for correctness on both local dev (`/`) and GitHub Pages project
 * sites (`/<repo-name>/`). This scales to any number of organisms
 * without touching this function again.
 *
 * Already-absolute sources (a user's local blob: URL from OPFS, or an
 * https:// URL from a trusted external Knowledge Layer image) are
 * passed through unchanged — only a bare public/-relative path gets the
 * base prefix.
 */
export function resolvePublicAssetPath(path: string | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  const base = import.meta.env.BASE_URL // e.g. "/" locally, "/cellfie/" on a GitHub Pages project site
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.replace(/^\/+/, '')
  return `${normalizedBase}${normalizedPath}`
}
