import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { ExtractionOptions, LocalExtractOcrEngine, PageResult } from '~/types'
import { exec, commandExists } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import { assertNever } from '~/utils/validate/assert-never'
import { runOcrmypdf } from './ocr-local/ocrmypdf/run-ocrmypdf'
import { runPaddleOcrOnImage } from './ocr-local/paddle-ocr/run-paddle-ocr'
import { ensureTesseractSetup, ocrImage } from './ocr-utils/tesseract-utils'

export const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])

const IMAGE_ARCHIVE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'])

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
  const result = await exec('unzip', ['-o', filePath, '-d', tempDir])
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to extract CBZ archive ${filePath}: ${result.stderr || result.stdout}`
    )
  }

  const collectImages = async (dir: string): Promise<string[]> => {
    const images: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        images.push(...await collectImages(fullPath))
      } else if (IMAGE_ARCHIVE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        images.push(fullPath)
      }
    }
    return images
  }

  const images = await collectImages(tempDir)
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
