import { expect } from 'bun:test'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../test-utils/budget'
import { runCommand, fileExists } from '../../../../test-utils/test-helpers'
import { shouldSkipMissingEnv } from '../../../../test-utils/service-test-kit'

type ExtractMetadata = {
  step1?: { format?: string }
  step2?: { extractionMethod?: string }
}

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-glm-reader-url', 'bun as ocr https://ajcwebdev.com --url-backend glm-reader', async () => {
  if (await shouldSkipMissingEnv('GLM_API_KEY', 'GLM_API_KEY not configured')) {
    return
  }

  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'glm-reader'],
      { testName: 'bun as ocr https://ajcwebdev.com --url-backend glm-reader' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    expect(outputDir).not.toBeNull()
    if (!outputDir) return

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as ExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+glm-reader')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
