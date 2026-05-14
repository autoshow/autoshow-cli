import { mkdir } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { ExtractionOptions, LocalExtractOcrEngine, PageResult } from '~/types'
import { exec, commandExists } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import { assertNever } from '~/utils/validate/assert-never'
import { runOcrmypdf } from './ocr-local/ocrmypdf/run-ocrmypdf'
import { runPaddleOcrOnImage } from './ocr-local/paddle-ocr/run-paddle-ocr'
import { ensureTesseractSetup, ocrImage } from './ocr-utils/tesseract-utils'
import { openZip, readZipEntryData } from '~/cli/commands/process-steps/step-1-download/document/zip-xml-utils'

export const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])

const IMAGE_ARCHIVE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'])

const sanitizeZipEntryPath = (entryName: string): string | null => {
  const parts = entryName
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
  return parts.length > 0 ? parts.join('/') : null
}

const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+)|(\D+)/g
  const partsA = a.match(re) ?? []
  const partsB = b.match(re) ?? []
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const partA = partsA[i] ?? ''
    const partB = partsB[i] ?? ''
    const numA = Number.parseInt(partA, 10)
    const numB = Number.parseInt(partB, 10)
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      if (numA !== numB) return numA - numB
    } else {
      const cmp = partA.localeCompare(partB)
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

export const extractCbzImages = async (
  filePath: string,
  tempDir: string
): Promise<string[]> => {
  const zip = await openZip(filePath)
  const imageEntries = [...zip.entries.values()]
    .filter((entry) => IMAGE_ARCHIVE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .sort((a, b) => naturalCompare(a.name, b.name))
  const images: string[] = []

  for (const entry of imageEntries) {
    const safePath = sanitizeZipEntryPath(entry.name)
    if (!safePath) continue

    const imagePath = join(tempDir, safePath)
    await mkdir(dirname(imagePath), { recursive: true })
    await Bun.write(imagePath, readZipEntryData(zip.buf, entry))
    images.push(imagePath)
  }

  images.sort((a, b) => naturalCompare(a, b))
  return images
}

const normalizeImageForOcr = async (
  imagePath: string,
  tempDir: string
): Promise<string> => {
  const ext = extname(imagePath).toLowerCase()
  if (ext === '.webp' || ext === '.bmp') {
    if (!commandExists('convert')) {
      l.warn(`ImageMagick not found; using ${ext} directly which may affect OCR quality`)
      return imagePath
    }
    const pngPath = join(tempDir, `${basename(imagePath, ext)}.png`)
    const result = await exec('convert', [imagePath, pngPath])
    if (result.exitCode !== 0) {
      l.warn(`ImageMagick conversion failed for ${imagePath}: ${result.stderr}`)
      return imagePath
    }
    return pngPath
  }
  return imagePath
}

export const ocrSingleImage = async (
  imagePath: string,
  pageNumber: number,
  opts: ExtractionOptions,
  engine: LocalExtractOcrEngine,
  tempDir: string
): Promise<PageResult> => {
  const normalizedPath = await normalizeImageForOcr(imagePath, tempDir)

  switch (engine) {
    case 'tesseract': {
      await ensureTesseractSetup()
      const extraConfig = opts.preserveInterwordSpaces ? { preserve_interword_spaces: 1 } : undefined
      const ocr = await ocrImage(normalizedPath, opts.languages, opts.oem, opts.psm, 'text', extraConfig)
      return {
        pageNumber,
        method: 'ocr',
        text: ocr.text,
        ...(ocr.confidence !== undefined ? { confidence: ocr.confidence } : {})
      }
    }
    case 'ocrmypdf': {
      const result = await runOcrmypdf(normalizedPath, opts, { pageCount: 1 })
      const combined = result.pages.map(page => page.text).join('\n').trim()
      return { pageNumber, method: 'ocr', text: combined }
    }
    case 'paddle-ocr': {
      const ocr = await runPaddleOcrOnImage(normalizedPath)
      return {
        pageNumber,
        method: 'ocr',
        text: ocr.text,
        ...(ocr.confidence !== undefined ? { confidence: ocr.confidence } : {})
      }
    }
    default:
      assertNever(engine)
  }
}
