import { expect } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../test-utils/service-test-kit'

budgetedTest(['write-llama-gemma-3-270m', 'image-openai-gpt-image-2'], 'gpt-image-2 runs in parallel with pipeline and produces generated-image.png', async () => {
  await requireConfiguredEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY not configured')

  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'write',
      STABLE_EXAMPLE_AUDIO_URL,
      '--llm', 'llama=ggml-org/gemma-3-270m-it-GGUF',
      '--image', 'openai=gpt-image-2',
      '--image-size', '1024x1536',
      '--image-quality', 'low',
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${STABLE_EXAMPLE_AUDIO_TITLE}`)
  }

  const metadata = await readRunMetadata(outputDir) as {
    step3?: { llmService?: string; outputFileName?: string }
    step5?: { imageService?: string; imageModel?: string; imageFileNames?: string[] }
  }
  const outputFileName = metadata.step3?.outputFileName ?? 'text.json'
  const summaryExists = await fileExists(`${outputDir}/${outputFileName}`)
  if (!summaryExists) {
    throw new Error(`LLM step did not produce ${outputFileName}`)
  }

  const imageExists = await fileExists(`${outputDir}/generated-image.png`)
  expect(imageExists).toBe(true)

  expect(metadata.step3?.llmService).toBeDefined()
  expect(metadata.step5?.imageService).toBe('openai')
  expect(metadata.step5?.imageModel).toBe('gpt-image-2')
  expect(metadata.step5?.imageFileNames?.[0]).toBe('generated-image.png')
}, E2E_TEST_TIMEOUT_MS)

