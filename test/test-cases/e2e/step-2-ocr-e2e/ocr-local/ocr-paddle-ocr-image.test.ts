import { expect, beforeAll, afterAll } from 'bun:test'
import { cleanupTestOutput, runCommand, fileExists, findLatestDirectory, ensurePageImageFixture } from '../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../test-utils/budget'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

type ExtractMetadata = {
  step1?: { format?: string }
  step2?: { extractionMethod?: string; totalPages?: number }
}

const imageInput = 'input/examples/document/1-document.png'
const paddleOcrPython = 'runtime/bin/paddle-ocr/bin/python'

beforeAll(async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')
})

afterAll(async () => {
  await cleanupTestOutput('1-document')
})

budgetedTest('extract-paddle-ocr-image', 'extract image with --paddle-ocr', async () => {
  if (!await fileExists(paddleOcrPython)) {
    return
  }

  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', imageInput, '--paddle-ocr'])
  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step1?.format).toBe('png')
  expect(metadata.step2?.extractionMethod).toBe('paddle-ocr')
  expect(metadata.step2?.totalPages).toBe(1)
})
