import { join, basename, resolve } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import type { ExtractionOptions, OcrFn } from '~/types'
import { chandraOcrUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { ensureChandraOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/chandra-ocr/chandra-ocr'

const runChandra = async (inputPath: string): Promise<{ text: string }> => {
  const chandraBin = `${chandraOcrUvEnvDir}/bin/chandra`
  const outputDir = await mkdtemp(join(tmpdir(), 'chandra-ocr-'))

  try {
    const result = await exec(chandraBin, [resolve(inputPath), outputDir, '--method', 'hf'])
    if (result.exitCode !== 0) {
      const details = [result.stderr.trim(), result.stdout.trim()]
        .filter((v) => v.length > 0)
        .join('\n')
      throw new Error(
        details.length > 0
          ? details
          : `Chandra OCR failed for ${inputPath} with exit code ${result.exitCode}`
      )
    }

    const files = await readdir(outputDir, { recursive: true })
    const mdFile = files.find((f) => typeof f === 'string' && f.endsWith('.md'))
    if (!mdFile) {
      throw new Error(`Chandra OCR produced no markdown output for ${inputPath}`)
    }

    const text = await readFile(join(outputDir, mdFile), 'utf-8')
    return { text: text.trim() }
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

export const runChandraOcrOnImage = async (imagePath: string): Promise<{ text: string }> => {
  await ensureChandraOcrSetup()
  l.write('info', `Running Chandra OCR on ${basename(imagePath)}`)
  return await runChandra(imagePath)
}

export const buildChandraOcrPageFn = async (_opts: ExtractionOptions): Promise<OcrFn> => {
  await ensureChandraOcrSetup()
  return async (imagePath: string) => {
    return await runChandra(imagePath)
  }
}
