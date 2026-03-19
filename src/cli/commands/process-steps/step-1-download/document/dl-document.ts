import { basename, extname, join } from 'node:path'
import { stat } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { ensureDirectory, exec } from '~/utils/cli-utils'
import { calibreBin } from '~/cli/commands/process-steps/step-1-download/setup-download/dl-document/calibre'
import { validateData } from '~/utils/validate/validation'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { DocumentMetadataSchema, type PreparedDocument } from '~/types'
import { detectDocumentFormat } from './detect-format'
import { getDocumentInfo } from './mutool-utils'
import type { DocFormat } from '~/types'
import * as l from '~/logger'

const EBOOK_FORMATS = new Set(['mobi', 'azw3', 'fb2', 'lit'])

const normalizeEbookToEpub = async (
  filePath: string,
  tempDir: string
): Promise<{ epubPath: string }> => {
  const ebookConvert = calibreBin('ebook-convert')
  if (ebookConvert === 'ebook-convert' && !Bun.which('ebook-convert')) {
    throw new Error(
      'Calibre is required to convert ebook files (MOBI/AZW3/FB2/LIT) to EPUB. ' +
      'Install it with: bun as setup'
    )
  }

  const epubPath = join(tempDir, 'converted.epub')
  const result = await exec(ebookConvert, [filePath, epubPath])
  if (result.exitCode !== 0) {
    throw new Error(
      `Calibre ebook-convert failed for ${filePath}: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`
    )
  }

  return { epubPath }
}

const mapFormat = (detected: NonNullable<import('~/types/process-types').DetectResult>, filePath: string): DocFormat => {
  if (detected === 'pdf') return 'pdf'
  if (detected === 'epub') return 'epub'
  if (detected === 'docx') return 'docx'
  if (detected === 'pptx') return 'pptx'
  if (detected === 'xlsx') return 'xlsx'
  if (detected === 'odf') return 'odf'
  if (detected === 'mobi') return 'mobi'
  if (detected === 'azw3') return 'azw3'
  if (detected === 'fb2') return 'fb2'
  if (detected === 'lit') return 'lit'
  if (detected === 'cbz') return 'cbz'
  if (detected === 'rtf') return 'rtf'
  if (detected === 'csv') return 'csv'
  if (detected === 'png') return 'png'
  if (detected === 'jpg') return 'jpg'
  if (detected === 'tif') return 'tif'
  if (detected === 'webp') return 'webp'
  if (detected === 'bmp') return 'bmp'
  if (detected === 'gif') return 'gif'

  // fallback for legacy 'image' type - infer from extension
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'png'
  if (ext === '.jpg' || ext === '.jpeg') return 'jpg'
  if (ext === '.webp') return 'webp'
  if (ext === '.bmp') return 'bmp'
  if (ext === '.gif') return 'gif'
  return 'tif'
}

const defaultOutputDir = (baseDir: string, filePath: string): string => {
  const title = basename(filePath).replace(/\.[^.]+$/, '')
  return `${baseDir}/${createUniqueDirectoryName(title)}`
}

export const downloadDocument = async (
  filePath: string,
  baseOutputDir: string,
  password?: string
): Promise<PreparedDocument> => {

  const source = Bun.file(filePath)
  if (!(await source.exists())) {
    throw new Error(`File does not exist: ${filePath}`)
  }

  const sourceStats = await stat(filePath)
  if (sourceStats.size <= 0) {
    throw new Error(`Document is empty: ${filePath}`)
  }

  const detectedFormat = await detectDocumentFormat(filePath)
  if (!detectedFormat) {
    throw new Error(`Unsupported document format: ${filePath}`)
  }

  const sourceFormat = mapFormat(detectedFormat, filePath)
  const baseTitle = basename(filePath).replace(/\.[^.]+$/, '')
  let pageCount = 1
  let title = baseTitle
  let author: string | undefined

  // Ebook normalization: MOBI/AZW3/FB2/LIT -> EPUB via Calibre
  let effectiveFilePath: string | undefined
  let tempDir: string | undefined
  let tempCleanup: (() => Promise<void>) | undefined
  let effectiveFormat: DocFormat = sourceFormat
  let conversionChain: string[] | undefined

  if (EBOOK_FORMATS.has(detectedFormat)) {
    l.info(`Normalizing ${detectedFormat.toUpperCase()} to EPUB via Calibre`)
    tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ebook-norm-'))
    tempCleanup = async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
      }
    }

    const convResult = await normalizeEbookToEpub(filePath, tempDir).catch(async (err) => {
      // cleanup on failure
      if (tempDir) await rm(tempDir, { recursive: true, force: true })
      throw err
    })

    effectiveFilePath = convResult.epubPath
    effectiveFormat = 'epub'
    conversionChain = ['calibre']
  }

  const resolvedFilePath = effectiveFilePath ?? filePath

  if (effectiveFormat === 'pdf' || effectiveFormat === 'epub') {
    const info = await getDocumentInfo(resolvedFilePath, password)
    pageCount = Math.max(1, info.pageCount)
    if (info.title && info.title.length > 0) title = info.title
    if (info.author && info.author.length > 0) author = info.author
  }

  const step1MetadataPayload: {
    title?: string
    author?: string
    pageCount: number
    format: DocFormat
    fileSize: number
    sourceFormat?: string
    normalizedFormat?: string
    conversionChain?: string[]
  } = {
    pageCount,
    format: effectiveFormat,
    fileSize: sourceStats.size
  }

  if (title) step1MetadataPayload.title = title
  if (author) step1MetadataPayload.author = author
  if (conversionChain) {
    step1MetadataPayload.sourceFormat = sourceFormat
    step1MetadataPayload.normalizedFormat = effectiveFormat
    step1MetadataPayload.conversionChain = conversionChain
  }

  const step1Metadata = validateData(DocumentMetadataSchema, step1MetadataPayload, 'document metadata')

  const outputDir = defaultOutputDir(baseOutputDir, filePath)
  await ensureDirectory(outputDir)

  return {
    outputDir,
    step1Metadata,
    ...(effectiveFilePath ? { effectiveFilePath } : {}),
    ...(tempCleanup ? { tempCleanup } : {})
  }
}
