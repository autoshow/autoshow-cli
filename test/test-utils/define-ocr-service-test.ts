import { expect } from 'bun:test'
import {
  ensurePageImageFixture,
  fileExists,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import { readProviderResult, readRunMetadata } from './manifest-helpers'
import { requireConfiguredEnvVar, runCommandAndExpectOutputDir, withOutputLifecycle } from './service-test-kit'

const extractServiceFromProvider = (provider: string): string => {
  return provider
}

const requireServiceRunPrerequisites = async (
  envVarKey: string | undefined,
  shouldSkipReadiness: (() => Promise<boolean>) | undefined
): Promise<void> => {
  if (envVarKey) {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} not configured`)
  }

  if (!shouldSkipReadiness) {
    return
  }

  try {
    if (await shouldSkipReadiness()) {
      throw new Error('readiness prerequisite did not pass')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`readiness check failed: ${message}`)
  }
}

const assertOcrArtifacts = async ({
  outputDir,
  expectedExtractionMethod,
  expectedTotalPages,
  service,
  model,
  assertProviderMetadata,
  assertProviderResult,
  assertUsageMetadata,
}: {
  outputDir: string
  expectedExtractionMethod: string
  expectedTotalPages?: number
  service: string
  model: string
  assertProviderMetadata: boolean
  assertProviderResult: boolean
  assertUsageMetadata: boolean
}): Promise<void> => {
  expect(await fileExists(`${outputDir}/run.json`)).toBe(true)

  if (assertProviderResult) {
    expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
    const providerResult = await readProviderResult(outputDir)
    expect(providerResult.provider).toBe(service)
    expect(providerResult.model).toBe(model)
  }

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
  expect(metadata.step2?.extractionMethod).toBe(expectedExtractionMethod)
  if (expectedTotalPages !== undefined) {
    expect(metadata.step2?.totalPages).toBe(expectedTotalPages)
  }
  if (assertProviderMetadata || assertUsageMetadata) {
    expect(metadata.step2?.ocrService).toBe(service)
    expect(metadata.step2?.ocrModel).toBe(model)
  }
  if (assertUsageMetadata) {
    expect(metadata.step2?.promptTokens).toBeGreaterThan(0)
    expect(metadata.step2?.completionTokens).toBeGreaterThan(0)
  }
}

export const defineOCRServiceTest = ({
  models,
  provider,
  expectedService,
  extractionMethod,
  imageExtractionMethod,
  envVarKey,
  inputMode = 'pdf-and-image',
  imageInput = 'input/examples/document/1-document.png',
  shouldSkipReadiness,
  assertProviderMetadata = false,
  assertProviderResult = false,
  assertUsageMetadata = false,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: readonly string[]
  provider: string
  expectedService?: string
  extractionMethod: string
  imageExtractionMethod?: string
  envVarKey?: string
  inputMode?: 'pdf-and-image' | 'image-only'
  imageInput?: string
  shouldSkipReadiness?: () => Promise<boolean>
  assertProviderMetadata?: boolean
  assertProviderResult?: boolean
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
    const service = expectedService ?? extractServiceFromProvider(provider)
    const budgetKey = `extract-${service}-${model}`

    if (inputMode === 'pdf-and-image') {
      budgetedTest(budgetKey, `extract PDF with --provider ${provider}=${model}`, async () => {
        await requireServiceRunPrerequisites(envVarKey, shouldSkipReadiness)

        const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'extract', pdfInput, '--provider', `${provider}=${model}`])

        await assertOcrArtifacts({
          outputDir,
          expectedExtractionMethod: extractionMethod,
          service,
          model,
          assertProviderMetadata,
          assertProviderResult,
          assertUsageMetadata,
        })
      }, timeoutMs)
    }

    budgetedTest(budgetKey, `extract image with --provider ${provider}=${model}`, async () => {
      await requireServiceRunPrerequisites(envVarKey, shouldSkipReadiness)

      if (usesGeneratedPngFixture) {
        await ensurePageImageFixture(imageInput)
      }
      const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'extract', imageInput, '--provider', `${provider}=${model}`])

      await assertOcrArtifacts({
        outputDir,
        expectedExtractionMethod: imageExtractionMethod ?? extractionMethod,
        expectedTotalPages: 1,
        service,
        model,
        assertProviderMetadata,
        assertProviderResult,
        assertUsageMetadata,
      })
    }, timeoutMs)
  }
}
