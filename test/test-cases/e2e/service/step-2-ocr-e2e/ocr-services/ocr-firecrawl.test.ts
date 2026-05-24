import { expect } from 'bun:test'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../../test-utils/budget'
import { runCommand, fileExists } from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'

type ExtractMetadata = {
  step1?: { format?: string }
  step2?: { extractionMethod?: string }
}

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-firecrawl-url', 'bun as extract https://ajcwebdev.com --url-provider firecrawl', async () => {
  await requireConfiguredEnvVar('FIRECRAWL_API_KEY', 'FIRECRAWL_API_KEY not configured')

  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'firecrawl'],
      { testName: 'bun as extract https://ajcwebdev.com --url-provider firecrawl' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    if (!outputDir) {
      throw new Error('Expected output directory for firecrawl URL extraction')
    }

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as ExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+firecrawl')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
