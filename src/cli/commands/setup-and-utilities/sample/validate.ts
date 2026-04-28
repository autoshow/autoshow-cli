import { join } from 'node:path'
import type { FixtureDef, ValidateResult } from '~/types'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const JPG_MAGIC = [0xff, 0xd8, 0xff]
const ZIP_MAGIC = [0x50, 0x4b]
const RTF_MAGIC = [0x7b, 0x5c, 0x72, 0x74, 0x66] // {\rtf

const hasMagic = (bytes: Uint8Array, magic: number[]): boolean => {
  if (bytes.length < magic.length) return false
  return magic.every((v, i) => bytes[i] === v)
}

const validateByFormat = async (filePath: string, format: string): Promise<ValidateResult> => {
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    return { valid: false, reason: 'file-not-found' }
  }

  const size = file.size
  if (size === 0) {
    return { valid: false, reason: 'empty-file' }
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  switch (format) {
    case 'pdf':
      return hasMagic(bytes, PDF_MAGIC)
        ? { valid: true }
        : { valid: false, reason: 'missing-pdf-magic' }

    case 'epub':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'odt':
    case 'ods':
    case 'odp':
    case 'cbz':
    case 'zip':
      return hasMagic(bytes, ZIP_MAGIC)
        ? { valid: true }
        : { valid: false, reason: 'missing-zip-magic' }

    case 'png':
      return hasMagic(bytes, PNG_MAGIC)
        ? { valid: true }
        : { valid: false, reason: 'missing-png-magic' }

    case 'jpg':
    case 'jpeg':
      return hasMagic(bytes, JPG_MAGIC)
        ? { valid: true }
        : { valid: false, reason: 'missing-jpg-magic' }

    case 'rtf':
      return hasMagic(bytes, RTF_MAGIC)
        ? { valid: true }
        : { valid: false, reason: 'missing-rtf-magic' }

    case 'wav':
    case 'mp3':
    case 'm4a':
    case 'mp4':
    case 'webm':
    case 'mkv':
    case 'opus':
    case 'ogg':
    case 'aac':
    case 'mov':
    case 'flac':
      // For media: just check size > 0 (already checked above)
      return { valid: true }

    case 'csv':
    case 'md':
    case 'txt':
      // Text formats: check it's readable as UTF-8
      try {
        await file.text()
        return { valid: true }
      } catch {
        return { valid: false, reason: 'not-readable-as-text' }
      }

    default:
      // Unknown format - just check existence and non-empty
      return size > 0 ? { valid: true } : { valid: false, reason: 'empty-file' }
  }
}

export const validateFixture = async (
  outDir: string,
  fixture: FixtureDef
): Promise<ValidateResult> => {
  const filePath = join(outDir, fixture.path)

  if (fixture.validity === 'invalid') {
    // Invalid fixtures: just check that the file exists (they are intentionally corrupt)
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      return { valid: false, reason: 'invalid-fixture-file-not-found' }
    }
    return { valid: true }
  }

  return validateByFormat(filePath, fixture.format)
}
