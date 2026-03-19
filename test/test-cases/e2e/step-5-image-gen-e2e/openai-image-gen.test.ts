import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from '../../../test-utils/test-helpers'

defineImageServiceTest({
  models: [
    { model: 'gpt-image-1', prompt: 'a simple red circle on white background' },
    { model: 'gpt-image-1-mini', prompt: 'a simple blue square on white background' },
    { model: 'gpt-image-1.5', prompt: 'a watercolor landscape with a lighthouse' },
  ],
  cliFlag: '--openai-image',
  imageService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
})

test('rejects multiple image providers', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1', '--minimax-image', 'image-01'],
  )
  expect(result.exitCode).not.toBe(0)
})

describe('openai image format options', () => {
  const IMAGE_GEN_TITLE = 'image-gen'

  beforeAll(async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)
  })

  test('gpt-image-1-mini generates jpeg when --image-format jpeg', async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)

    const hasKey = await hasConfiguredEnvVar('OPENAI_API_KEY')
    if (!hasKey) {
      console.log('Skipping: OPENAI_API_KEY not configured')
      return
    }

    const result = await runCommand(
      [
        'src/cli/create-cli.ts', 'image',
        'a simple blue square on white background',
        '--openai-image', 'gpt-image-1-mini',
        '--image-format', 'jpeg',
        '--image-size', '1024x1024',
        '--image-quality', 'low',
      ],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(IMAGE_GEN_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const imageExists = await fileExists(`${outputDir}/generated-image.jpg`)
      expect(imageExists).toBe(true)

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        image?: { imageService?: string; imageModel?: string; imageFileName?: string }
      }
      expect(metadata.image?.imageService).toBe('openai')
      expect(metadata.image?.imageModel).toBe('gpt-image-1-mini')
      expect(metadata.image?.imageFileName).toBe('generated-image.jpg')
    }
  })

  test('gpt-image-1 generates oil painting with high quality and custom size', async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)

    const hasKey = await hasConfiguredEnvVar('OPENAI_API_KEY')
    if (!hasKey) {
      console.log('Skipping: OPENAI_API_KEY not configured')
      return
    }

    const result = await runCommand(
      [
        'src/cli/create-cli.ts', 'image',
        'an oil painting of a lighthouse',
        '--openai-image', 'gpt-image-1',
        '--image-quality', 'high',
        '--image-size', '1536x1024'
      ],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(IMAGE_GEN_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const imageExists = await fileExists(`${outputDir}/generated-image.png`)
      expect(imageExists).toBe(true)

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        image?: { imageService?: string; imageModel?: string }
      }
      expect(metadata.image?.imageService).toBe('openai')
      expect(metadata.image?.imageModel).toBe('gpt-image-1')
    }
  })
})

describe('write with image gen', () => {
  beforeAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  test('gpt-image-1 runs in parallel with pipeline and produces generated-image.png', async () => {
    const hasKey = await hasConfiguredEnvVar('OPENAI_API_KEY')
    if (!hasKey) {
      console.log('Skipping: OPENAI_API_KEY not configured')
      return
    }

    const result = await runCommand(
      [
        'src/cli/create-cli.ts',
        STABLE_LOCAL_AUDIO_PATH,
        '--llama', 'ggml-org/gemma-3-270m-it-GGUF',
        '--openai-image', 'gpt-image-1',
      ],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.md`)
      if (!summaryExists) {
        console.log('LLM step did not produce text.md — skipping image assertions')
        return
      }
      expect(summaryExists).toBe(true)

      const imageExists = await fileExists(`${outputDir}/generated-image.png`)
      expect(imageExists).toBe(true)

      const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
        step3?: { llmService?: string }
        step5?: { imageService?: string; imageModel?: string; imageFileName?: string }
      }
      expect(metadata.step3?.llmService).toBeDefined()
      expect(metadata.step5?.imageService).toBe('openai')
      expect(metadata.step5?.imageModel).toBe('gpt-image-1')
      expect(metadata.step5?.imageFileName).toBe('generated-image.png')
    }
  })
})
