import { useMemo } from 'react'

interface FlowReaderViewProps {
  /** Sanitized page HTML (see useFlowDocument/core/epub-engine) for the current page only. */
  html: string
}

// Warm-neutral reading theme matching the app's light-mode design tokens
// (src/index.css) — hardcoded rather than read from CSS custom properties
// because a sandboxed iframe's `srcDoc` is a separate document with no
// access to the parent page's stylesheet.
const READER_STYLE = `
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', ui-serif, serif;
    font-size: 18px;
    line-height: 1.7;
    color: #3a2e22;
    background: #f6f1e7;
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 20px 96px;
    word-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.6em 0 0.5em; color: #3a2e22; }
  p, li { margin: 0 0 1em; }
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #dccfb4; padding: 6px 10px; text-align: left; }
  a { color: #6e7a41; }
  blockquote { border-left: 3px solid #dccfb4; margin: 1em 0; padding: 0.2em 0 0.2em 1em; color: #6c5a46; }
`

/**
 * Book Reader — EPUB/HTML page display. The non-canvas counterpart to
 * `ReaderCanvas`: instead of rendering a PDF page's pixels, this renders
 * one "page" (an EPUB spine item, or the whole document for a
 * standalone HTML import) as real, flowing HTML inside a sandboxed
 * iframe. `sandbox="allow-same-origin"` deliberately omits
 * `allow-scripts` — nothing in an imported book's markup can execute,
 * regardless of whether `core/epub-engine` already stripped `<script>`
 * tags on the way in.
 *
 * Scope: no text-selection highlighting yet (§9's highlight model is
 * built around PDF's canvas + text-layer rect coordinates, which don't
 * apply to flowing HTML) — see ReaderPage.tsx, which disables the
 * highlight control for this format. Bookmarks and notes, being
 * page-number-based, work the same as they do for PDF.
 */
export function FlowReaderView({ html }: FlowReaderViewProps) {
  const srcDoc = useMemo(() => {
    // `html` already has a <head>/<body> from core/epub-engine's
    // serializeSanitizedHtml — inject the reading theme into its head.
    return html.replace('</head>', `<style>${READER_STYLE}</style></head>`)
  }, [html])

  return (
    <div className="h-full overflow-auto bg-canvas">
      <iframe
        title="Book page"
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        className="mx-auto block h-full w-full max-w-[720px] border-0"
      />
    </div>
  )
}
