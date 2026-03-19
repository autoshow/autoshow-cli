import { cpus } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { ExtractionOptions, PageResult, InternalPage } from '~/types'
import * as l from '~/logger'
import { extractPageText, renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { ocrImage } from './tesseract-utils'
import { isTextUsable } from './page-triage'

export type OcrFn = (imagePath: string) => Promise<{ text: string, confidence?: number }>

const toPlainTextFromTsv = (tsv: string): string => {
  const lines = tsv.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) return ''
  return lines.slice(1)
    .map(line => line.split('\t'))
    .filter(cols => (cols[10] || '-1') !== '-1')
    .map(cols => cols[11] || '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const createPool = (limit: number) => {
  let active = 0
  const queue: Array<() => void> = []
  const acquire = async (): Promise<void> => {
    if (active < limit) {
      active++
      return
    }
    await new Promise<void>(resolve => queue.push(resolve))
  }
  const release = (): void => {
    active--
    const next = queue.shift()
    if (next) {
      active++
      next()
    }
  }
  return { acquire, release }
}

const buildTesseractOcrFn = (options: ExtractionOptions): OcrFn => async (imagePath) => {
  const extraConfig = options.preserveInterwordSpaces ? { preserve_interword_spaces: 1 } : undefined
  const textResult = await ocrImage(imagePath, options.languages, options.oem, options.psm, 'text', extraConfig)
  const tsvResult = await ocrImage(imagePath, options.languages, options.oem, options.psm, 'tsv', extraConfig)
  const tsvText = toPlainTextFromTsv(tsvResult.text)
  const text = textResult.text.trim().length > 0 ? textResult.text : tsvText
  if (tsvResult.confidence !== undefined) {
    return { text, confidence: tsvResult.confidence }
  }
  return { text }
}

const runOcrAttempt = async (
  filePath: string,
  page: number,
  dpi: number,
  tempDir: string,
  options: ExtractionOptions,
  ocrFn: OcrFn
): Promise<{ text: string, confidence?: number }> => {
  const imagePath = join(tempDir, `page-${String(page).padStart(3, '0')}-${dpi}dpi.png`)
  const renderResult = await renderPageToImage(
    filePath,
    page,
    dpi,
    imagePath,
    options.password,
    options.rotate
  )
  if (renderResult.exitCode !== 0) {
    throw new Error(renderResult.stderr || `Failed rendering page ${page}`)
  }
  const result = await ocrFn(imagePath)
  await rm(imagePath, { force: true })
  return result
}

export const processPages = async (
  filePath: string,
  totalPages: number,
  options: ExtractionOptions,
  ocrFn?: OcrFn
): Promise<PageResult[]> => {
  const effectiveOcrFn = ocrFn ?? buildTesseractOcrFn(options)
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-'))
  try {
    const cores = Math.max(1, cpus().length)
    const renderConcurrency = options.renderConcurrency ?? Math.min(cores, 4)
    const ocrConcurrency = options.ocrConcurrency ?? Math.min(cores, 2)
    const renderPool = createPool(renderConcurrency)
    const ocrPool = createPool(ocrConcurrency)

    const stageA = await Promise.all(Array.from({ length: totalPages }, async (_, idx): Promise<InternalPage> => {
      const pageNumber = idx + 1
      await renderPool.acquire()
      try {
        const extracted = await extractPageText(filePath, pageNumber, options.password)
        return {
          pageNumber,
          text: extracted.stdout,
          needsOcr: !isTextUsable(extracted.stdout)
        }
      } finally {
        renderPool.release()
      }
    }))

    const stageAByPage = new Map(stageA.map(page => [page.pageNumber, page]))
    const needingOcr = stageA.filter(p => p.needsOcr)
    if (needingOcr.length > 0) {
      l.info(`Running OCR for ${needingOcr.length}/${totalPages} pages`)
    }

    const ocrResults = await Promise.all(needingOcr.map(async page => {
      await ocrPool.acquire()
      try {
        let attempt = await runOcrAttempt(filePath, page.pageNumber, options.dpi, tempDir, options, effectiveOcrFn)
        if ((attempt.confidence ?? 100) < 40) {
          attempt = await runOcrAttempt(filePath, page.pageNumber, options.dpi + 100, tempDir, options, effectiveOcrFn)
        }
        return {
          pageNumber: page.pageNumber,
          text: attempt.text,
          confidence: attempt.confidence
        }
      } finally {
        ocrPool.release()
      }
    }))

    const ocrByPage = new Map(ocrResults.map(r => [r.pageNumber, r]))
    const finalPages: PageResult[] = []
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const stageAPage = stageAByPage.get(pageNumber)
      const ocrPage = ocrByPage.get(pageNumber)
      if (ocrPage) {
        finalPages.push({
          pageNumber,
          method: 'ocr',
          text: ocrPage.text,
          ...(ocrPage.confidence !== undefined ? { confidence: ocrPage.confidence } : {})
        })
        continue
      }
      if (stageAPage) {
        finalPages.push({
          pageNumber,
          method: stageAPage.text.trim().length > 0 ? 'text' : 'skipped',
          text: stageAPage.text
        })
      }
    }
    return finalPages
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
