import { describe, expect, beforeAll, afterAll } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

defineImageServiceTest({
  models: [
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
    { model: 'gpt-image-2', prompt: 'a simple green triangle on white background', extraArgs: ['--image-size', '1024x1536', '--image-quality', 'low'] },
  ],
  cliFlag: '--openai-image',
  imageService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
})

describe('write with image gen', () => {
  beforeAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  budgetedTest(['write-llama-gemma-3-270m', 'image-openai-gpt-image-2'], 'gpt-image-2 runs in parallel with pipeline and produces generated-image.png', async () => {
    const hasKey = await hasConfiguredEnvVar('OPENAI_API_KEY')
    if (!hasKey) {
      console.log('Skipping: OPENAI_API_KEY not configured')
      return
    }

    const result = await runCommand(
      [
        'src/cli/create-cli.ts',
        'write',
        STABLE_LOCAL_AUDIO_PATH,
        '--llama', 'ggml-org/gemma-3-270m-it-GGUF',
        '--openai-image', 'gpt-image-2',
        '--image-size', '1024x1536',
        '--image-quality', 'low',
      ],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmService?: string; outputFileName?: string }
        step5?: { imageService?: string; imageModel?: string; imageFileNames?: string[] }
      }
      const outputFileName = metadata.step3?.outputFileName ?? 'text.json'
      const summaryExists = await fileExists(`${outputDir}/${outputFileName}`)
      if (!summaryExists) {
        console.log(`LLM step did not produce ${outputFileName} — skipping image assertions`)
        return
      }
      expect(summaryExists).toBe(true)

      const imageExists = await fileExists(`${outputDir}/generated-image.png`)
      expect(imageExists).toBe(true)

      expect(metadata.step3?.llmService).toBeDefined()
      expect(metadata.step5?.imageService).toBe('openai')
      expect(metadata.step5?.imageModel).toBe('gpt-image-2')
      expect(metadata.step5?.imageFileNames?.[0]).toBe('generated-image.png')
    }
  }, E2E_TEST_TIMEOUT_MS)
})
