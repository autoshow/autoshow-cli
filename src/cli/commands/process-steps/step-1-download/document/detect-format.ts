import { extname } from 'node:path'
import type { DetectResult } from '~/types'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const JPG_MAGIC = [0xff, 0xd8, 0xff]
const RTF_MAGIC = [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31] // {\rtf1

const hasMagic = (bytes: Uint8Array, magic: number[]): boolean => {
  if (bytes.length < magic.length) return false
  return magic.every((value, idx) => bytes[idx] === value)
}

const isTiff = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false
  const le = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a
  return le || be
}

const isWebp = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
}

const isBmp = (bytes: Uint8Array): boolean => {
  if (bytes.length < 2) return false
  return bytes[0] === 0x42 && bytes[1] === 0x4d
}

const isGif = (bytes: Uint8Array): boolean => {
  if (bytes.length < 6) return false
  const sig = String.fromCharCode(...Array.from(bytes.slice(0, 6)))
  return sig === 'GIF87a' || sig === 'GIF89a'
}

const isLit = (bytes: Uint8Array): boolean => {
  if (bytes.length < 8) return false
  const sig = String.fromCharCode(...Array.from(bytes.slice(0, 8)))
  return sig === 'ITOLITLS'
}

const isMobiOrAzw3 = (bytes: Uint8Array): 'mobi' | 'azw3' | null => {
  if (bytes.length < 68) return null
  // PalmDOC/MOBI: BOOKMOBI at offset 60
  const sig = String.fromCharCode(...Array.from(bytes.slice(60, 68)))
  if (sig !== 'BOOKMOBI') return null

  // Distinguish AZW3 (KF8) from MOBI by checking for KF8 magic in the first 4KB
  // KF8 uses 'SRCS' or 'FDST' or 'FLIS' markers, but the most reliable indicator
  // is the mobi type field at offset 96 (4 bytes, big-endian): 0x101 = AZW3
  if (bytes.length >= 100) {
    const mobi_type = (bytes[96]! << 24) | (bytes[97]! << 16) | (bytes[98]! << 8) | bytes[99]!
    if (mobi_type === 0x00000101) return 'azw3'
  }
  return 'mobi'
}

const isFb2 = (bytes: Uint8Array): boolean => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512))
  return text.includes('<FictionBook')
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif'])

const probeZipForFormat = (bytes: Uint8Array): DetectResult => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  // EPUB: must have mimetype file with epub+zip content
  if (text.includes('application/epub+zip')) return 'epub'

  // Office OOXML formats
  if (text.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) return 'docx'
  if (text.includes('application/vnd.openxmlformats-officedocument.presentationml')) return 'pptx'
  if (text.includes('application/vnd.openxmlformats-officedocument.spreadsheetml')) return 'xlsx'
  if (text.includes('application/vnd.oasis.opendocument')) return 'odf'

  // EPUB fallback: has mimetype entry
  if (text.includes('mimetype') && text.includes('epub')) return 'epub'

  // CBZ: ZIP containing only image entries (no OPF/content.opf/mimetype indicating ebook)
  // We detect CBZ by checking for image file entries in the local file header names
  const hasOPF = text.includes('.opf') || text.includes('content.xml') || text.includes('META-INF')
  if (!hasOPF) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff']
    const hasImages = imageExts.some(ext => text.toLowerCase().includes(ext))
    if (hasImages) return 'cbz'
  }

  return null
}

const isTextContent = (bytes: Uint8Array): boolean => {
  // Check for non-text bytes (> 5% non-printable, non-whitespace control chars)
  let nonText = 0
  const limit = Math.min(bytes.length, 4096)
  for (let i = 0; i < limit; i++) {
    const b = bytes[i]!
    if (b < 0x09 || (b > 0x0d && b < 0x20) || b === 0x7f) {
      nonText++
    }
  }
  return nonText / limit < 0.05
}

export const detectDocumentFormat = async (filePath: string): Promise<DetectResult> => {
  const ext = extname(filePath).toLowerCase()

  // Fast-path extension detection for unambiguous formats
  if (ext === '.mobi') return 'mobi'
  if (ext === '.azw3' || ext === '.azw') return 'azw3'
  if (ext === '.fb2') return 'fb2'
  if (ext === '.lit') return 'lit'
  if (ext === '.rtf') return 'rtf'

  // CSV: extension + content probe for binary rejection
  if (ext === '.csv') {
    const bytes = new Uint8Array(await Bun.file(filePath).slice(0, 4096).arrayBuffer())
    if (!isTextContent(bytes)) return null // binary content with .csv extension
    return 'csv'
  }

  const bytes = new Uint8Array(await Bun.file(filePath).slice(0, 4096).arrayBuffer())

  // Magic-byte detection takes precedence over extension

  // PDF
  if (hasMagic(bytes, PDF_MAGIC)) return 'pdf'

  // RTF
  if (hasMagic(bytes, RTF_MAGIC)) return 'rtf'

  // LIT ebook
  if (isLit(bytes)) return 'lit'

  // MOBI/AZW3 (PalmDOC with BOOKMOBI signature)
  const mobiKind = isMobiOrAzw3(bytes)
  if (mobiKind) return mobiKind

  // Images
  if (hasMagic(bytes, PNG_MAGIC)) return 'png'
  if (hasMagic(bytes, JPG_MAGIC)) return 'jpg'
  if (isTiff(bytes)) return 'tif'
  if (isWebp(bytes)) return 'webp'
  if (isBmp(bytes)) return 'bmp'
  if (isGif(bytes)) return 'gif'

  // ZIP-based formats (EPUB, CBZ, Office)
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (isZip) {
    const result = probeZipForFormat(bytes)
    if (result) return result
  }

  // FB2 (XML-based ebook)
  if (isFb2(bytes)) return 'fb2'

  // Extension-based fallback (after magic bytes failed)
  if (ext === '.pdf') return 'pdf'
  if (ext === '.epub') return 'epub'
  if (ext === '.docx') return 'docx'
  if (ext === '.pptx') return 'pptx'
  if (ext === '.xlsx') return 'xlsx'
  if (['.odt', '.ods', '.odp'].includes(ext)) return 'odf'
  if (ext === '.cbz') return 'cbz'
  if (IMAGE_EXTENSIONS.has(ext)) {
    if (ext === '.png') return 'png'
    if (ext === '.jpg' || ext === '.jpeg') return 'jpg'
    if (ext === '.tif' || ext === '.tiff') return 'tif'
    if (ext === '.webp') return 'webp'
    if (ext === '.bmp') return 'bmp'
    if (ext === '.gif') return 'gif'
  }

  return null
}

