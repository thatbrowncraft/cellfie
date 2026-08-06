/**
 * core/file-storage — Origin Private File System (OPFS) wrapper.
 *
 * Per SDD v3 §10, raw binary blobs (PDFs, thumbnails) never go into
 * IndexedDB directly — they live here, and Dexie records only ever hold a
 * logical path string (`LibraryItem.filePath` / `.thumbnailPath`) pointing
 * into this store. This keeps IndexedDB fast and small regardless of
 * library size, and matches "fully offline, 5–10 year durability" (SDD §3)
 * since OPFS is a standard, origin-scoped filesystem rather than an
 * in-memory cache that can be evicted like the browser Cache API can.
 *
 * Paths are logical, not real filesystem paths: `"<dir>/<fileName>"`,
 * e.g. `"library-files/3f2a...-uuid.pdf"`. The directory segment maps to
 * a real OPFS subdirectory; everything else is a flat file within it.
 */

export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
}

async function getSubDir(name: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(name, { create })
}

function splitPath(path: string): [dir: string, fileName: string] {
  const slash = path.indexOf('/')
  if (slash === -1) throw new Error(`Invalid OPFS path (expected "dir/fileName"): ${path}`)
  return [path.slice(0, slash), path.slice(slash + 1)]
}

/** Writes a blob to OPFS under `<dir>/<fileName>` and returns the logical path. */
export async function writeFile(dir: string, fileName: string, blob: Blob): Promise<string> {
  const dirHandle = await getSubDir(dir, true)
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
  return `${dir}/${fileName}`
}

/** Reads a file back out of OPFS as a Blob. Throws if the path doesn't exist. */
export async function readFile(path: string): Promise<Blob> {
  const [dir, fileName] = splitPath(path)
  const dirHandle = await getSubDir(dir, false)
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: false })
  return fileHandle.getFile()
}

/** Deletes a file from OPFS. Safe to call on an already-missing file. */
export async function deleteFile(path: string): Promise<void> {
  try {
    const [dir, fileName] = splitPath(path)
    const dirHandle = await getSubDir(dir, false)
    await dirHandle.removeEntry(fileName)
  } catch {
    // Missing directory or file — deletion is idempotent, nothing to do.
  }
}
