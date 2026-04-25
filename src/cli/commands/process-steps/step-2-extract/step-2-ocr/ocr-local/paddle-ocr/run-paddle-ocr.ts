import { join, resolve } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import type { ExtractionOptions, OcrFn } from '~/types'
import { paddleOcrUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { ensurePaddleOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/paddle-ocr'

const SCRIPT_PATH = join(import.meta.dir, 'scripts/run-paddle-ocr.py')

const PaddleOcrOutputSchema = v.object({
  text: v.string(),
  confidence: v.optional(v.number(), undefined)
})

const summarizePaddleFailure = (
  imagePath: string,
  result: { stdout: string, stderr: string, exitCode: number }
): string => {
  const details = [
    result.stderr.trim(),
    result.stdout.trim()
  ].filter((value) => value.length > 0).join('\n')

  return details.length > 0
    ? details
    : `PaddleOCR failed for ${imagePath} with exit code ${result.exitCode}`
}

const runScript = async (imagePath: string): Promise<{ text: string, confidence?: number }> => {
  const pythonBin = `${paddleOcrUvEnvDir}/bin/python`
  const result = await exec(pythonBin, [SCRIPT_PATH, resolve(imagePath)], {
    env: {
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True'
    }
  })
  if (result.exitCode !== 0) {
    throw new Error(summarizePaddleFailure(imagePath, result))
  }
  const lines = result.stdout.trim().split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  const lastLine = lines[lines.length - 1]
  if (!lastLine) {
    throw new Error(`PaddleOCR returned no JSON output for ${imagePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(lastLine)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`PaddleOCR returned invalid JSON for ${imagePath}: ${detail}`)
  }

  const validated = validateData(PaddleOcrOutputSchema, parsed, 'paddle-ocr output')
  if (validated.confidence !== undefined) {
    return { text: validated.text, confidence: validated.confidence }
  }
  return { text: validated.text }
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
