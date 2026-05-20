import { expect } from 'bun:test'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../test-utils/budget'
import { runCommand, fileExists } from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import {
  classifyLiveProviderAvailabilityFailure,
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar
} from '../../../../test-utils/service-test-kit'

type ExtractMetadata = {
  step1?: { format?: string }
  step2?: { extractionMethod?: string }
}

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-glm-reader-url', 'bun as extract https://ajcwebdev.com --url-backend glm-reader', async () => {
  await requireConfiguredEnvVar('GLM_API_KEY', 'GLM_API_KEY not configured')

  let outputDir: string | null = null

  try {
    const args = ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-backend', 'glm-reader']
    const result = await runCommand(
      args,
      { testName: 'bun as extract https://ajcwebdev.com --url-backend glm-reader' }
    )
    if (result.exitCode !== 0) {
      const availabilityReason = classifyLiveProviderAvailabilityFailure(`${result.stdout}\n${result.stderr}`)
      if (availabilityReason) {
        throw new Error(`Live provider availability failure: ${availabilityReason}\n${formatCommandFailureDiagnostics(args, result)}`)
      }
      throw new Error(formatCommandFailureDiagnostics(args, result))
    }
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    if (!outputDir) {
      throw new Error('Expected output directory for GLM Reader URL extraction')
    }

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as ExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+glm-reader')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
