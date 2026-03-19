import { expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  findLatestDirectory,
  cleanupTestOutput,
  ensurePageImageFixture,
  hasConfiguredEnvVar
} from './test-helpers'
import { budgetedTest } from './budget'

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
  const pdfInput = 'input/1-document.pdf'
  const imageInput = 'input/1-document.png'

  beforeAll(async () => {
    await ensurePageImageFixture(imageInput)
    await cleanupTestOutput('1-document')
  })

  afterAll(async () => {
    await cleanupTestOutput('1-document')
  })

  for (const model of models) {
    const service = extractServiceFromFlag(cliFlag)
    const budgetKey = `extract-${service}-${model}`

    budgetedTest(budgetKey, `extract PDF with ${cliFlag} ${model}`, async () => {
      if (!await hasConfiguredEnvVar(envVarKey)) {
        return
      }

      await cleanupTestOutput('1-document')

      const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, cliFlag, model])
      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory('1-document')
      expect(outputDir).not.toBeNull()
      if (!outputDir) return

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        step2?: { extractionMethod?: string }
      }
      expect(metadata.step2?.extractionMethod).toBe(extractionMethod)
    })

    budgetedTest(budgetKey, `extract image with ${cliFlag} ${model}`, async () => {
      if (!await hasConfiguredEnvVar(envVarKey)) {
        return
      }

      await ensurePageImageFixture(imageInput)
      await cleanupTestOutput('1-document')

      const result = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, cliFlag, model])
      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory('1-document')
      expect(outputDir).not.toBeNull()
      if (!outputDir) return

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        step2?: { extractionMethod?: string; totalPages?: number }
      }
      expect(metadata.step2?.extractionMethod).toBe(imageExtractionMethod ?? extractionMethod)
      expect(metadata.step2?.totalPages).toBe(1)
    })
  }
}
