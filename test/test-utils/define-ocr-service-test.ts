import { expect } from 'bun:test'
import {
  cleanupTestOutput,
  ensurePageImageFixture,
} from './test-helpers'
import { budgetedTest } from './budget'
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
}: {
  models: readonly string[]
  cliFlag: string
  extractionMethod: string
  imageExtractionMethod?: string
  envVarKey: string
}): void => {
  const pdfInput = 'input/examples/document/1-document.pdf'
  const imageInput = 'input/examples/document/1-document.png'

  withOutputLifecycle('1-document', async () => {
    await ensurePageImageFixture(imageInput)
  })

  for (const model of models) {
    const service = extractServiceFromFlag(cliFlag)
    const budgetKey = `extract-${service}-${model}`

    budgetedTest(budgetKey, `extract PDF with ${cliFlag} ${model}`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      await cleanupTestOutput('1-document')

      const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'ocr', pdfInput, cliFlag, model])
      if (!outputDir) return

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        step2?: { extractionMethod?: string }
      }
      expect(metadata.step2?.extractionMethod).toBe(extractionMethod)
    })

    budgetedTest(budgetKey, `extract image with ${cliFlag} ${model}`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      await ensurePageImageFixture(imageInput)
      await cleanupTestOutput('1-document')

      const outputDir = await runCommandAndExpectOutputDir('1-document', ['src/cli/create-cli.ts', 'ocr', imageInput, cliFlag, model])
      if (!outputDir) return

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        step2?: { extractionMethod?: string; totalPages?: number }
      }
      expect(metadata.step2?.extractionMethod).toBe(imageExtractionMethod ?? extractionMethod)
      expect(metadata.step2?.totalPages).toBe(1)
    })
  }
}
