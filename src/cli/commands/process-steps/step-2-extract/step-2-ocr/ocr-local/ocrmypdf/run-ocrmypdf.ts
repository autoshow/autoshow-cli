import { join } from 'node:path'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { cpus, tmpdir } from 'node:os'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import type { ExtractionOptions, PageResult } from '~/types'
import { ensureOcrmypdfSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/ocrmypdf/ocrmypdf'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.gif', '.webp'])
const DEFAULT_OCRMYPDF_MAX_JOBS = 2
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

const isImageInputPath = (filePath: string): boolean => {
  const lower = filePath.toLowerCase()
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

const positiveIntegerOrUndefined = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return undefined
  }
  return Math.floor(value)
}

export const resolveOcrmypdfJobs = (options: {
  pageCount?: number | undefined
  requestedConcurrency?: number | undefined
  cpuCount?: number | undefined
}): number => {
  const cpuLimit = positiveIntegerOrUndefined(options.cpuCount) ?? Math.max(1, cpus().length)
  const requestedLimit = positiveIntegerOrUndefined(options.requestedConcurrency) ?? DEFAULT_OCRMYPDF_MAX_JOBS
  const pageLimit = positiveIntegerOrUndefined(options.pageCount)
  const limits = [cpuLimit, requestedLimit]
  if (pageLimit !== undefined) {
    limits.push(pageLimit)
  }
  return Math.max(1, Math.min(...limits))
}

export const buildOcrmypdfArgs = (
  filePath: string,
  sidecarPath: string,
  opts: Partial<Pick<ExtractionOptions, 'dpi' | 'languages' | 'ocrConcurrency'>>,
  context: { pageCount?: number | undefined, cpuCount?: number | undefined } = {}
): string[] => {
  const args: string[] = [
    '--sidecar', sidecarPath,
    '--mode', 'force',
    '--output-type', 'none',
    '--optimize', '0',
    '--jobs', String(resolveOcrmypdfJobs({
      pageCount: context.pageCount,
      requestedConcurrency: opts.ocrConcurrency,
      cpuCount: context.cpuCount
    }))
  ]

  if (isImageInputPath(filePath)) {
    // OCRmyPDF requires explicit DPI when image metadata is missing.
    args.push('--image-dpi', String(opts.dpi ?? 300))
  }

  if (opts.languages && opts.languages !== 'eng') {
    args.push('-l', opts.languages)
  }

  args.push(filePath, '-')
  return args
}

const getOcrmypdfJobsArg = (args: string[]): string => {
  const jobsIndex = args.indexOf('--jobs')
  return jobsIndex >= 0 ? args[jobsIndex + 1] ?? 'unknown' : 'unknown'
}

const logOcrmypdfProgressLine = (streamName: 'stdout' | 'stderr') => (line: string): void => {
  const normalized = line.replace(ANSI_PATTERN, '').trim()
  if (normalized.length === 0) {
    return
  }
  l.write('info', `OCRmyPDF ${streamName}: ${normalized}`)
}

export const runOcrmypdf = async (
  filePath: string,
  opts: ExtractionOptions,
  context: { pageCount?: number | undefined } = {}
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  await ensureOcrmypdfSetup()

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocrmypdf-'))
  try {
    const sidecarPath = join(tempDir, 'sidecar.txt')
    const args = buildOcrmypdfArgs(filePath, sidecarPath, opts, context)

    l.write('info', `Running OCRmyPDF on ${filePath} with --jobs ${getOcrmypdfJobsArg(args)}`)
    const result = await exec('ocrmypdf', args, {
      progressLabel: 'OCRmyPDF',
      onStdoutLine: logOcrmypdfProgressLine('stdout'),
      onStderrLine: logOcrmypdfProgressLine('stderr')
    })
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'OCRmyPDF failed')
    }

    const sidecarText = await readFile(sidecarPath, 'utf-8')
    const rawPageTexts = sidecarText.split('\f').map(t => t.trim())

    while (rawPageTexts.length > 0 && rawPageTexts[rawPageTexts.length - 1] === '') {
      rawPageTexts.pop()
    }

    const pages: PageResult[] = rawPageTexts.map((text, idx) => ({
      pageNumber: idx + 1,
      method: 'ocr' as const,
      text
    }))

    return { pages, extractionMethod: 'ocrmypdf' }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
