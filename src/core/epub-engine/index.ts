/**
 * core/epub-engine — Book Import Formats §17-19: EPUB/XHTML import as a
 * first-class format, parsed entirely locally with zero new
 * dependencies. An EPUB file is itself an ordinary ZIP archive, and the
 * only compression method EPUBs use (DEFLATE) already has a native,
 * unpackaged decoder in every modern browser —
 * `DecompressionStream('deflate-raw')`. That means EPUB support needed
 * no new dependency at all: just a small ZIP central-directory reader
 * (below) plus the browser's own `DOMParser` for the XHTML content
 * itself. Nothing here reads or writes the network; the file never
 * leaves the device.
 *
 * Scope (§26, "do not overbuild this pass"): this reads an EPUB's
 * manifest/spine and turns each spine document into two forms — plain
 * heading-aware text (feeding the exact same downstream pipeline a PDF
 * page does, see `core/concepts/documentText.ts`) and sanitized,
 * image-inlined HTML for the actual page-flip reading view (see
 * `FlowReaderView.tsx`). Canvas-based rendering (core/pdf-engine's job)
 * stays PDF-only — EPUB/HTML get a simpler scrolling-page reader, not
 * pixel-identical pagination, which is the right tradeoff for a format
 * that has no fixed page geometry to begin with.
 */

interface ZipEntry {
  name: string
  compressionMethod: number
  compressedSize: number
  localHeaderOffset: number
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50

function findEndOfCentralDirectory(view: DataView): number {
  // The EOCD record is 22 bytes and sits at the end of the archive,
  // optionally followed by up to 65535 bytes of a zip comment — scan
  // backward for its signature rather than assuming it's the very last
  // 22 bytes.
  const maxCommentLength = 65535
  const start = Math.max(0, view.byteLength - 22 - maxCommentLength)
  for (let i = view.byteLength - 22; i >= start; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i
  }
  throw new Error('Not a valid ZIP/EPUB file (no end-of-central-directory record found).')
}

function readCentralDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer)
  const eocdOffset = findEndOfCentralDirectory(view)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralDirOffset = view.getUint32(eocdOffset + 16, true)

  const entries: ZipEntry[] = []
  let offset = centralDirOffset
  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIR_SIGNATURE) break
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameBytes = new Uint8Array(buffer, offset + 46, nameLength)
    entries.push({ name: new TextDecoder('utf-8').decode(nameBytes), compressionMethod, compressedSize, localHeaderOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer)
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true)
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true)
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength
  const compressed = new Uint8Array(buffer, dataStart, entry.compressedSize)

  if (entry.compressionMethod === 0) return compressed
  if (entry.compressionMethod !== 8) {
    throw new Error(`Unsupported ZIP compression method (${entry.compressionMethod}) for "${entry.name}".`)
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress EPUB files (DecompressionStream unsupported).')
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readZipEntryText(buffer: ArrayBuffer, entries: ZipEntry[], name: string): Promise<string | undefined> {
  const entry = entries.find((e) => e.name === name)
  if (!entry) return undefined
  return new TextDecoder('utf-8').decode(await readZipEntry(buffer, entry))
}

/** True when a blob is a ZIP archive, checked by magic bytes rather than filename/extension. */
export async function isZipFile(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  return header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07)
}

// --------------------------------- EPUB ---------------------------------

export interface ParsedEpub {
  title?: string
  author?: string
  /** One entry per spine item, in reading order — the EPUB's "pages" (see documentText.ts). */
  pageTexts: string[]
  /** Sanitized (script-stripped, image-inlined) markup per spine item, ready for the reader's sandboxed iframe (see FlowReaderView.tsx). */
  pageHtml: string[]
}

function resolveRelative(basePath: string, href: string): string {
  if (href.startsWith('/')) return href.slice(1)
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : ''
  const parts = (baseDir + href).split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') resolved.pop()
    else resolved.push(part)
  }
  return resolved.join('/')
}

/**
 * Serializes one XHTML document into heading-aware plain text: every
 * h1-h6 becomes its own short standalone line, and Retrieval
 * Correction's structural heading detector (textDisplay.ts) already
 * recognizes exactly that shape — a real EPUB heading tag is a strictly
 * better signal than the heuristic it was built for, so this needs no
 * special-casing downstream. Paragraphs/list items become their own
 * lines; table rows collapse to one line each. Script/style/nav chrome
 * is dropped, everything else preserves reading order.
 */
function serializeXhtmlToText(doc: Document): string {
  const root = doc.body ?? doc.documentElement
  const lines: string[] = []

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'nav') return

    if (/^h[1-6]$/.test(tag)) {
      const text = el.textContent?.replace(/\s+/g, ' ').trim()
      if (text) {
        lines.push('')
        lines.push(text)
        lines.push('')
      }
      return
    }
    if (tag === 'p' || tag === 'li' || tag === 'figcaption' || tag === 'blockquote') {
      const text = el.textContent?.replace(/\s+/g, ' ').trim()
      if (text) lines.push(text)
      return
    }
    if (tag === 'tr') {
      const cells = Array.from(el.querySelectorAll('td, th'))
        .map((c) => c.textContent?.replace(/\s+/g, ' ').trim())
        .filter((c): c is string => Boolean(c))
      if (cells.length) lines.push(cells.join(' | '))
      return
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }

  walk(root)
  return lines.join('\n')
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000 // avoid a stack-overflowing spread on a large image
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Book Reader — EPUB display support. Resolves every `<img src>` in a
 * spine document to a `data:` URI read straight out of the EPUB's own
 * zip entries, and strips `<script>` tags outright. The reader renders
 * this markup inside a sandboxed iframe with scripts disabled regardless
 * (see FlowReaderView.tsx), so this is belt-and-suspenders, not the only
 * line of defense — but there's no reason to ship an inert `<script>`
 * tag to the DOM at all when it's this cheap to remove up front.
 */
async function inlineEpubImages(doc: Document, buffer: ArrayBuffer, entries: ZipEntry[], basePath: string): Promise<void> {
  doc.querySelectorAll('script').forEach((el) => el.remove())

  for (const img of Array.from(doc.querySelectorAll('img[src]'))) {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:')) continue
    const path = resolveRelative(basePath, src)
    const entry = entries.find((e) => e.name === path)
    if (!entry) {
      img.removeAttribute('src')
      continue
    }
    try {
      const bytes = await readZipEntry(buffer, entry)
      const ext = path.split('.').pop()?.toLowerCase() ?? ''
      const mime = IMAGE_MIME_BY_EXTENSION[ext] ?? 'application/octet-stream'
      img.setAttribute('src', `data:${mime};base64,${bytesToBase64(bytes)}`)
    } catch {
      img.removeAttribute('src')
    }
  }
}

/** A minimal, self-contained HTML document string, ready to hand to an iframe's `srcDoc`. */
function serializeSanitizedHtml(doc: Document): string {
  const body = doc.body ?? doc.documentElement
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body.innerHTML}</body></html>`
}

export async function parseEpub(blob: Blob): Promise<ParsedEpub> {
  const buffer = await blob.arrayBuffer()
  const entries = readCentralDirectory(buffer)

  const containerXml = await readZipEntryText(buffer, entries, 'META-INF/container.xml')
  if (!containerXml) throw new Error('Not a valid EPUB (missing META-INF/container.xml).')
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const opfPath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
  if (!opfPath) throw new Error('Not a valid EPUB (no OPF rootfile declared).')

  const opfXml = await readZipEntryText(buffer, entries, opfPath)
  if (!opfXml) throw new Error('Not a valid EPUB (OPF file missing).')
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml')

  const titleEl = opfDoc.getElementsByTagName('dc:title')[0] ?? opfDoc.getElementsByTagName('title')[0]
  const authorEl = opfDoc.getElementsByTagName('dc:creator')[0] ?? opfDoc.getElementsByTagName('creator')[0]
  const title = titleEl?.textContent?.trim() || undefined
  const author = authorEl?.textContent?.trim() || undefined

  const manifest = new Map<string, string>() // manifest item id -> href
  Array.from(opfDoc.getElementsByTagName('item')).forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest.set(id, href)
  })

  const spineIds = Array.from(opfDoc.getElementsByTagName('itemref'))
    .map((el) => el.getAttribute('idref'))
    .filter((id): id is string => Boolean(id))

  const pageTexts: string[] = []
  const pageHtml: string[] = []
  for (const id of spineIds) {
    const href = manifest.get(id)
    if (!href) continue
    const path = resolveRelative(opfPath, href)
    const xhtml = await readZipEntryText(buffer, entries, path)
    if (!xhtml) continue
    const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml')
    const text = serializeXhtmlToText(doc).trim()
    if (!text) continue
    await inlineEpubImages(doc, buffer, entries, path)
    pageTexts.push(text)
    pageHtml.push(serializeSanitizedHtml(doc))
  }

  if (pageTexts.length === 0) throw new Error('Could not find any readable content in this EPUB.')
  return { title, author, pageTexts, pageHtml }
}

// ----------------------------- Plain XHTML/HTML -----------------------------

export interface ParsedHtmlDocument {
  title?: string
  pageText: string
  /** Sanitized (script-stripped) markup, ready for the reader's sandboxed iframe. Any image paths relative to the original file can't be resolved without the file's siblings, so those images simply won't render — a standalone HTML import only carries what's inside the one file. */
  pageHtml: string
}

/** A single standalone .html/.xhtml file — treated as a one-"page" book. */
export function parseHtmlDocument(html: string): ParsedHtmlDocument {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = doc.querySelector('title')?.textContent?.trim() || undefined
  doc.querySelectorAll('script').forEach((el) => el.remove())
  return { title, pageText: serializeXhtmlToText(doc).trim(), pageHtml: serializeSanitizedHtml(doc) }
}
