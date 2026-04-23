import { cpus } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import type { ExtractionOptions, PageResult } from '~/types'
import { ensureOcrmypdfSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/ocrmypdf/ocrmypdf'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.gif', '.webp'])

const isImageInputPath = (filePath: string): boolean => {
  const lower = filePath.toLowerCase()
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

export const runOcrmypdf = async (
  filePath: string,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  await ensureOcrmypdfSetup()

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocrmypdf-'))
  try {
    const sidecarPath = join(tempDir, 'sidecar.txt')
    const cores = Math.max(1, cpus().length)

    const args: string[] = [
      '--sidecar', sidecarPath,
      '--mode', 'force',
      '--output-type', 'none',
      '--jobs', String(cores)
    ]

    if (isImageInputPath(filePath)) {
      // OCRmyPDF requires explicit DPI when image metadata is missing.
      args.push('--image-dpi', String(opts.dpi ?? 300))
    }

    if (opts.languages && opts.languages !== 'eng') {
      args.push('-l', opts.languages)
    }

    args.push(filePath, '-')

    l.write('info', `Running OCRmyPDF on ${filePath}`)
    const result = await exec('ocrmypdf', args)
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
