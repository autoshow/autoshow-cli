import { expect } from 'bun:test'
import {
  cleanupTestOutput,
  ensurePageImageFixture,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import { readRunMetadata } from './manifest-helpers'
import { runCommandAndExpectOutputDir, shouldSkipMissingEnv, withOutputLifecycle } from './service-test-kit'

const extractServiceFromFlag = (cliFlag: string): string => {
  return cliFlag.replace(/^--/, '').replace(/-ocr$/, '')
}

export const defineOCRServiceTest = ({
  models,
  cliFlag,
  extractionMethod,
  imageExtractionMethod,
  envVarKey,
  imageInput = 'input/examples/document/1-document.png',
  assertUsageMetadata = false,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: readonly string[]
  cliFlag: string
  extractionMethod: string
  imageExtractionMethod?: string
  envVarKey: string
  imageInput?: string
  assertUsageMetadata?: boolean
  timeoutMs?: number
}): void => {
  const pdfInput = 'input/examples/document/1-document.pdf'
  const usesGeneratedPngFixture = imageInput === 'input/examples/document/1-document.png'

  withOutputLifecycle('1-document', async () => {
    if (usesGeneratedPngFixture) {
      await ensurePageImageFixture(imageInput)
    }
  })

  for (const model of models) {
    const service = extractServiceFromFlag(cliFlag)
    const budgetKey = `extract-${service}-${model}`

    budgetedTest(budgetKey, `extract PDF with ${cliFlag} ${model}`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      await cleanupTestOutput('1-document')

      const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'extract', pdfInput, cliFlag, model])
      if (!outputDir) return

      const metadata = await readRunMetadata(outputDir) as {
        step2?: {
          extractionMethod?: string
          ocrService?: string
          ocrModel?: string
          promptTokens?: number
          completionTokens?: number
        }
      }
      expect(metadata.step2?.extractionMethod).toBe(extractionMethod)
      if (assertUsageMetadata) {
        expect(metadata.step2?.ocrService).toBe(service)
        expect(metadata.step2?.ocrModel).toBe(model)
        expect(metadata.step2?.promptTokens).toBeGreaterThan(0)
        expect(metadata.step2?.completionTokens).toBeGreaterThan(0)
      }
    }, timeoutMs)

    budgetedTest(budgetKey, `extract image with ${cliFlag} ${model}`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      if (usesGeneratedPngFixture) {
        await ensurePageImageFixture(imageInput)
      }
      await cleanupTestOutput('1-document')

      const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'extract', imageInput, cliFlag, model])
      if (!outputDir) return

      const metadata = await readRunMetadata(outputDir) as {
        step2?: {
          extractionMethod?: string
          totalPages?: number
          ocrService?: string
          ocrModel?: string
          promptTokens?: number
          completionTokens?: number
        }
      }
      expect(metadata.step2?.extractionMethod).toBe(imageExtractionMethod ?? extractionMethod)
      expect(metadata.step2?.totalPages).toBe(1)
      if (assertUsageMetadata) {
        expect(metadata.step2?.ocrService).toBe(service)
        expect(metadata.step2?.ocrModel).toBe(model)
        expect(metadata.step2?.promptTokens).toBeGreaterThan(0)
        expect(metadata.step2?.completionTokens).toBeGreaterThan(0)
      }
    }, timeoutMs)
  }
}
