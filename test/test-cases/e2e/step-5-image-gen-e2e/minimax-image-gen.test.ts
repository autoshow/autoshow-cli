import { test, expect } from 'bun:test'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

defineImageServiceTest({
  models: [
    { model: 'image-01', prompt: 'a simple red circle on white background' },
  ],
  cliFlag: '--minimax-image',
  imageService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  imageExtension: 'jpeg',
})

test('image-01 generates dramatic fox portrait with aspect ratio', async () => {
  const IMAGE_GEN_TITLE = 'image-gen'

  await cleanupTestOutput(IMAGE_GEN_TITLE)

  const hasApiKey = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasApiKey) {
    console.log('Skipping: MINIMAX_API_KEY not configured')
    return
  }

  const result = await runCommand(
    [
      'src/cli/create-cli.ts', 'image',
      'a dramatic fox portrait in snow',
      '--minimax-image', 'image-01',
      '--image-aspect-ratio', '16:9'
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(IMAGE_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const imageExists = await fileExists(`${outputDir}/generated-image.jpeg`)
    expect(imageExists).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      image?: Array<{ imageService?: string; imageModel?: string }>
    }
    expect(metadata.image?.[0]?.imageService).toBe('minimax')
    expect(metadata.image?.[0]?.imageModel).toBe('image-01')
  }
})
