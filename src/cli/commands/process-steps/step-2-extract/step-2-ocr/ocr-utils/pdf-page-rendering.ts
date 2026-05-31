import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OcrPreparationCache } from '~/types'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getCachedRenderedPageImage } from './preparation-cache'

export const runWithRenderedOcrPdfPages = async <T>(options: {
  filePath: string
  totalPages: number
  dpi: number
  password?: string | undefined
  ocrPreparationCache?: OcrPreparationCache | undefined
  tempDirPrefix: string
  providerLabel: string
  onPage: (input: { imagePath: string, page: number }) => Promise<T>
}): Promise<T[]> => {
  const results: T[] = []
  const tempDir = await mkdtemp(join(tmpdir(), options.tempDirPrefix))

  try {
    for (let page = 1; page <= options.totalPages; page++) {
      const imagePath = join(tempDir, `page-${String(page).padStart(3, '0')}.png`)
      let renderedImagePath = imagePath
      let removeRenderedImage = true

      if (options.ocrPreparationCache) {
        const rendered = await getCachedRenderedPageImage(
          options.ocrPreparationCache,
          {
            filePath: options.filePath,
            page,
            dpi: options.dpi,
            password: options.password
          },
          async (outputPath) => {
            const renderResult = await renderPageToImage(
              options.filePath,
              page,
              options.dpi,
              outputPath,
              options.password
            )
            if (renderResult.exitCode !== 0) {
              throw new Error(renderResult.stderr || `Failed rendering page ${page} for ${options.providerLabel}`)
            }
          }
        )
        renderedImagePath = rendered.imagePath
        removeRenderedImage = false
      } else {
        const renderResult = await renderPageToImage(
          options.filePath,
          page,
          options.dpi,
          imagePath,
          options.password
        )
        if (renderResult.exitCode !== 0) {
          throw new Error(renderResult.stderr || `Failed rendering page ${page} for ${options.providerLabel}`)
        }
      }

      try {
        results.push(await options.onPage({ imagePath: renderedImagePath, page }))
      } finally {
        if (removeRenderedImage) {
          await rm(imagePath, { force: true })
        }
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  return results
}
