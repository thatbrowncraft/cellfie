/**
 * shared/utils/resolveExamPrepAssetPath — fixes curated Exam Prep
 * illustration/thumbnail paths for GitHub Pages subpath deployment.
 *
 * Every Exam Prep content JSON (`src/content/exam-prep/**`) hardcodes
 * its `illustration.src` / structure `image.src` as a root-absolute
 * path, e.g. "/exam-prep/human-anatomy/body-systems-overview.png".
 * That's correct for local dev (served from "/"), but wrong once the
 * app is built for GitHub Pages under a repo subpath — `vite.config.ts`
 * sets `base: "/<repo-name>/"`, and `import.meta.env.BASE_URL` mirrors
 * it everywhere else in the app (see `App.tsx`'s router `basename` and
 * `ManualReaderOverlay.tsx`'s manual PDF path), but a hardcoded
 * "/exam-prep/..." string never picks that prefix up on its own — it
 * always resolves against the domain root, so the browser requests
 * "https://thatbrowncraft.github.io/exam-prep/..." instead of
 * "https://thatbrowncraft.github.io/<repo-name>/exam-prep/...", and
 * gets a 404. That 404 is what `IllustrationFrame`'s `onError` catches,
 * which is why the deployed page shows "Illustration unavailable"
 * even though the JSON itself loaded fine.
 *
 * This resolver is the fix, applied only where a curated Exam Prep
 * asset path reaches an `<img>` — never a blanket rewrite of every
 * image URL in Cellfie. Organism Explorer's own images (`blob:` URLs
 * for user uploads, direct `https:` URLs for built-in organisms) never
 * pass through here and must keep working exactly as before.
 */

/**
 * True for any string that already names a fully-resolved or
 * externally-owned resource — one that must never get `BASE_URL`
 * prepended. Covers absolute URLs (`https:`, `http:`), user-supplied
 * blob/data URLs, and non-http schemes like `mailto:`.
 */
function isAlreadyResolved(path: string): boolean {
  // A scheme like "https:", "blob:", "data:", "mailto:" — anything
  // with "://" or a bare "word:" prefix — is left completely alone.
  return /^[a-z][a-z0-9+.-]*:/i.test(path)
}

/**
 * Resolves a curated Exam Prep content asset path (an `illustration.src`,
 * a structure `image.src`, a topic-card thumbnail, a quiz diagram) so it
 * loads correctly both in local dev (`BASE_URL` = "/") and on GitHub
 * Pages (`BASE_URL` = "/<repo-name>/").
 *
 * - Absolute URLs, `blob:`, `data:`, and any other URL that already has
 *   a scheme pass through completely untouched.
 * - A root-absolute path ("/exam-prep/...") or a bare relative path
 *   ("exam-prep/...") both get `BASE_URL` prefixed, with slash
 *   handling that avoids both a missing separator and a doubled one —
 *   e.g. BASE_URL "/Cellfie/" + "/exam-prep/x.png" becomes
 *   "/Cellfie/exam-prep/x.png", never "/Cellfie//exam-prep/x.png".
 * - `undefined`/empty input passes through as-is so callers that
 *   already do their own `src && ...` guard don't need to change.
 */
export function resolveExamPrepAssetPath(path: string): string
export function resolveExamPrepAssetPath(path: string | undefined): string | undefined
export function resolveExamPrepAssetPath(path: string | undefined): string | undefined {
  if (!path) return path
  if (isAlreadyResolved(path)) return path

  const base = import.meta.env.BASE_URL // e.g. "/" locally, "/Cellfie/" on GitHub Pages
  const baseWithoutTrailingSlash = base.endsWith('/') ? base.slice(0, -1) : base
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`

  return `${baseWithoutTrailingSlash}${pathWithLeadingSlash}`
}
