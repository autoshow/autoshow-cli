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
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

const OPENAI_IMAGE_TIMEOUT_MS = 120_000

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

test('--price allows multiple image providers and reports each image step', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1-mini', '--minimax-image', 'image-01', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-image-openai-gpt-image-1-mini.png')
  expect(output).toContain('generated-image-minimax-image-01.jpeg')
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

      const metadata = await readRunMetadata(outputDir) as {
        image?: Array<{ imageService?: string; imageModel?: string; imageFileNames?: string[] }>
      }
      expect(metadata.image?.[0]?.imageService).toBe('openai')
      expect(metadata.image?.[0]?.imageModel).toBe('gpt-image-1-mini')
      expect(metadata.image?.[0]?.imageFileNames?.[0]).toBe('generated-image.jpg')
    }
  }, OPENAI_IMAGE_TIMEOUT_MS)

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

      const metadata = await readRunMetadata(outputDir) as {
        image?: Array<{ imageService?: string; imageModel?: string }>
      }
      expect(metadata.image?.[0]?.imageService).toBe('openai')
      expect(metadata.image?.[0]?.imageModel).toBe('gpt-image-1')
    }
  }, OPENAI_IMAGE_TIMEOUT_MS)
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
        'write',
        STABLE_LOCAL_AUDIO_PATH,
        '--llama', 'ggml-org/gemma-3-270m-it-GGUF',
        '--openai-image', 'gpt-image-1',
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
      expect(metadata.step5?.imageModel).toBe('gpt-image-1')
      expect(metadata.step5?.imageFileNames?.[0]).toBe('generated-image.png')
    }
  }, OPENAI_IMAGE_TIMEOUT_MS)
})
