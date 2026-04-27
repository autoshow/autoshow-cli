import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import * as l from '~/utils/logger'
import { commandExists, exec } from '~/utils/cli-utils'
import type { ExtractionOptions, OcrFn } from '~/types'
import { paddleOcrUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { ensurePaddleOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/paddle-ocr'
import { stripAnsi } from '../../ocr-run-state'

const SCRIPT_PATH = join(import.meta.dir, 'scripts/run-paddle-ocr.py')
type PaddleModelProfile = 'auto' | 'mobile'
type PaddleRunAttempt = {
  maxImageSidePx: number
  modelProfile: PaddleModelProfile
}
const PADDLE_RUN_ATTEMPTS: PaddleRunAttempt[] = [
  { maxImageSidePx: 1000, modelProfile: 'auto' },
  { maxImageSidePx: 800, modelProfile: 'auto' },
  { maxImageSidePx: 1000, modelProfile: 'mobile' },
  { maxImageSidePx: 800, modelProfile: 'mobile' }
]

const PaddleOcrOutputSchema = v.object({
  text: v.string(),
  confidence: v.optional(v.number(), undefined)
})

export const parsePaddleImageDimensions = (output: string): { width: number, height: number } | undefined => {
  const match = output.trim().match(/^(\d+)\s+(\d+)$/)
  if (!match) {
    return undefined
  }

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined
  }

  return { width, height }
}

const signalNameForExitCode = (exitCode: number): string | undefined => {
  const signalNumber = exitCode - 128
  if (signalNumber <= 0) {
    return undefined
  }

  switch (signalNumber) {
    case 7: return 'SIGBUS'
    case 10: return 'SIGBUS'
    case 9: return 'SIGKILL'
    case 11: return 'SIGSEGV'
    case 15: return 'SIGTERM'
    default: return `signal ${signalNumber}`
  }
}

export const isPaddleNativeCrashExitCode = (exitCode: number): boolean => {
  const signalName = signalNameForExitCode(exitCode)
  return signalName === 'SIGBUS' || signalName === 'SIGKILL' || signalName === 'SIGSEGV'
}

export const summarizePaddleFailure = (
  imagePath: string,
  result: { stdout: string, stderr: string, exitCode: number }
): string => {
  const details = [
    stripAnsi(result.stderr).trim(),
    stripAnsi(result.stdout).trim()
  ].filter((value) => value.length > 0).join('\n')

  const signalName = signalNameForExitCode(result.exitCode)
  const signalSummary = signalName
    ? `PaddleOCR exited with code ${result.exitCode} (${signalName}) for ${imagePath}. This usually means the PaddleOCR subprocess was terminated by the OS, often due to native runtime or memory pressure.`
    : `PaddleOCR exited with code ${result.exitCode} for ${imagePath}`

  return details.length > 0
    ? `${signalSummary}\n${details}`
    : signalSummary
}

export const extractPaddleOcrJsonLine = (stdout: string): string | undefined => {
  const lines = stripAnsi(stdout).trim().split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]
    if (line !== undefined && line.startsWith('{') && line.endsWith('}')) {
      return line
    }
  }
  return undefined
}

export const buildPaddlePreparedImagePath = (
  inputPath: string,
  workDir: string,
  maxImageSidePx: number
): string => {
  const ext = extname(inputPath).toLowerCase()
  return join(workDir, `${basename(inputPath, ext || undefined)}-paddle-${maxImageSidePx}.jpg`)
}

const preparePaddleImage = async (inputPath: string, workDir: string, maxImageSidePx: number): Promise<string> => {
  if (!commandExists('identify') || !commandExists('convert')) {
    l.warn('ImageMagick not found; using original image for PaddleOCR which may increase memory pressure')
    return inputPath
  }

  const imageFramePath = `${inputPath}[0]`
  const dimensionsResult = await exec('identify', ['-format', '%w %h', imageFramePath])
  if (dimensionsResult.exitCode !== 0) {
    l.warn(`Failed to inspect ${basename(inputPath)} for PaddleOCR; using original image. ${dimensionsResult.stderr || dimensionsResult.stdout || 'ImageMagick identify failed.'}`)
    return inputPath
  }

  const dimensions = parsePaddleImageDimensions(dimensionsResult.stdout)
  if (!dimensions) {
    return inputPath
  }

  const maxSide = Math.max(dimensions.width, dimensions.height)
  const ext = extname(inputPath).toLowerCase()
  if (maxSide <= maxImageSidePx && ['.jpg', '.jpeg', '.png'].includes(ext)) {
    return inputPath
  }

  const preparedPath = buildPaddlePreparedImagePath(inputPath, workDir, maxImageSidePx)
  const resize = `${maxImageSidePx}x${maxImageSidePx}>`
  const result = await exec('convert', [
    imageFramePath,
    '-auto-orient',
    '-colorspace', 'RGB',
    '-background', 'white',
    '-alpha', 'remove',
    '-alpha', 'off',
    '-resize', resize,
    '-quality', '92',
    preparedPath
  ])

  if (result.exitCode !== 0) {
    l.warn(`Failed to prepare ${basename(inputPath)} for PaddleOCR; using original image. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
    return inputPath
  }

  if (maxSide > maxImageSidePx) {
    l.write('info', `Downsampled ${basename(inputPath)} for PaddleOCR (${dimensions.width}x${dimensions.height} -> max ${maxImageSidePx}px)`)
  }

  return preparedPath
}

type PaddleAttemptFailure = {
  maxImageSidePx: number
  modelProfile: PaddleModelProfile
  result: { stdout: string, stderr: string, exitCode: number }
}

const summarizePaddleAttemptFailures = (imagePath: string, failures: PaddleAttemptFailure[]): string => {
  const attempts = failures.map((failure) => `${failure.modelProfile}/${failure.maxImageSidePx}px`).join(', ')
  const lastFailure = failures[failures.length - 1]
  if (!lastFailure) {
    return `PaddleOCR failed for ${imagePath}`
  }

  return [
    `PaddleOCR failed for ${imagePath} after attempts: ${attempts}.`,
    summarizePaddleFailure(imagePath, lastFailure.result)
  ].join('\n')
}

const runScript = async (imagePath: string): Promise<{ text: string, confidence?: number }> => {
  const pythonBin = `${paddleOcrUvEnvDir}/bin/python`
  const workDir = await mkdtemp(join(tmpdir(), 'autoshow-paddle-ocr-'))
  const failures: PaddleAttemptFailure[] = []

  try {
    const resolvedImagePath = resolve(imagePath)
    for (const [attemptIndex, attempt] of PADDLE_RUN_ATTEMPTS.entries()) {
      const { maxImageSidePx, modelProfile } = attempt
      const preparedImagePath = await preparePaddleImage(resolvedImagePath, workDir, maxImageSidePx)
      const result = await exec(pythonBin, [SCRIPT_PATH, preparedImagePath], {
        env: {
          PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
          AUTOSHOW_PADDLE_OCR_MAX_SIDE: String(maxImageSidePx),
          AUTOSHOW_PADDLE_OCR_MODEL_PROFILE: modelProfile
        }
      })
      if (result.exitCode !== 0) {
        failures.push({ maxImageSidePx, modelProfile, result })
        if (isPaddleNativeCrashExitCode(result.exitCode) && attemptIndex < PADDLE_RUN_ATTEMPTS.length - 1) {
          const nextAttempt = PADDLE_RUN_ATTEMPTS[attemptIndex + 1]
          l.warn(`PaddleOCR exited with a native signal using ${modelProfile} at max ${maxImageSidePx}px; retrying with ${nextAttempt?.modelProfile ?? 'auto'} at max ${nextAttempt?.maxImageSidePx ?? maxImageSidePx}px`)
          continue
        }
        throw new Error(summarizePaddleAttemptFailures(imagePath, failures))
      }
      const jsonLine = extractPaddleOcrJsonLine(result.stdout)
      if (!jsonLine) {
        throw new Error(`PaddleOCR returned no JSON output for ${imagePath}: ${summarizePaddleFailure(imagePath, result)}`)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(jsonLine)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`PaddleOCR returned invalid JSON for ${imagePath}: ${detail}\n${summarizePaddleFailure(imagePath, result)}`)
      }

      const validated = validateData(PaddleOcrOutputSchema, parsed, 'paddle-ocr output')
      if (validated.confidence !== undefined) {
        return { text: validated.text, confidence: validated.confidence }
      }
      return { text: validated.text }
    }
    throw new Error(summarizePaddleAttemptFailures(imagePath, failures))
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const runPaddleOcrOnImage = async (imagePath: string): Promise<{ text: string, confidence?: number }> => {
  await ensurePaddleOcrSetup()
  l.write('info', `Running PaddleOCR on ${imagePath}`)
  return await runScript(imagePath)
}

export const buildPaddleOcrPageFn = async (_opts: ExtractionOptions): Promise<OcrFn> => {
  await ensurePaddleOcrSetup()
  return async (imagePath: string) => {
    return await runScript(imagePath)
  }
}
