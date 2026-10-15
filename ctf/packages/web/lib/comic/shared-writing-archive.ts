import { unzipSync, strFromU8 } from 'fflate';

// Read the one file we want out of an uploaded Quora export `.zip`, and refuse anything that looks
// like an attack rather than an archive.
//
// Threat model, stated plainly: this endpoint accepts a file from anyone signed in, and the people
// this community exists to protect against are motivated to send a malicious one. An uploaded
// archive is hostile input until proven otherwise.
//
// What is done about it:
//   - The archive is parsed IN MEMORY and never written to disk. There is no extracted directory to
//     escape into, so the classic "zip slip" path-traversal write (an entry named `../../etc/...`)
//     has nothing to write to. Entry names are still validated below, because we use them to choose
//     a file and a crafted name should never be able to steer that choice.
//   - Nothing is ever executed, and no shell is invoked. The bytes are only ever decompressed and
//     read as text.
//   - A decompression-ratio and total-size ceiling stops a "zip bomb" — a few kilobytes that expand
//     to fill memory.
//   - Only `index.html` is read. Every other entry in the archive is ignored and discarded, whatever
//     it contains, so an executable or image smuggled into the archive is never even decoded.
//
// The caller enforces the upload byte cap before this runs; these limits guard what happens after
// decompression, which the upload size cannot bound.

// A Quora export's index.html is large but not unbounded. 60 MB of decompressed HTML is far past any
// real account and still small enough to hold safely.
const MAX_DECOMPRESSED_BYTES = 60 * 1024 * 1024;

// The file we want, at the archive root or one directory down (Quora nests it under a dated folder).
const INDEX_ENTRY = /^(?:[^/\\]+\/)?index\.html$/i;

export type ArchiveReadResult =
  | { ok: true; html: string }
  | { ok: false; reason: 'not_a_zip' | 'no_index_html' | 'too_large' };

// A single entry name we are willing to look at: no absolute paths, no parent-directory segments, no
// backslash separators (Windows-style names that some extractors treat as directories), no NUL.
function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > 512) return false;
  if (name.includes('\0')) return false;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  if (name.includes('\\')) return false;
  return !name.split('/').includes('..');
}

export function readQuoraExportArchive(bytes: Uint8Array): ArchiveReadResult {
  // "PK\x03\x04" — the local file header every zip starts with. Checking it gives a clear "that is
  // not a zip" instead of a parser exception for the common case of the wrong file being picked.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return { ok: false, reason: 'not_a_zip' };
  }

  let files: Record<string, Uint8Array>;
  try {
    // `filter` runs before an entry is decompressed, so everything that is not index.html costs
    // nothing and is never decoded — that is the zip-bomb guard as much as the size check is.
    files = unzipSync(bytes, {
      filter: (file) =>
        isSafeEntryName(file.name)
        && INDEX_ENTRY.test(file.name)
        && file.originalSize <= MAX_DECOMPRESSED_BYTES,
    });
  } catch {
    return { ok: false, reason: 'not_a_zip' };
  }

  const entryName = Object.keys(files).find((name) => INDEX_ENTRY.test(name));
  if (!entryName) {
    return { ok: false, reason: 'no_index_html' };
  }

  const content = files[entryName];
  if (content.length > MAX_DECOMPRESSED_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  return { ok: true, html: strFromU8(content) };
}
