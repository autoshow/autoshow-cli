import { expect, test } from 'bun:test'
import {
  fileExists,
  runCommand,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

const IMAGE_GEN_TITLE = 'image-gen'

export const defineImageServiceTest = ({
  models,
  provider,
  imageService,
  envVarKey,
  imageExtension,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[], expectedExtension?: string }>
  provider: string
  imageService: string
  envVarKey: string
  imageExtension?: string
}): void => {
  const ext = imageExtension ?? 'png'

  defineInvalidModelTest(`rejects invalid ${imageService} image model`, [
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    `${provider}=invalid-model`
  ])

  withOutputLifecycle(IMAGE_GEN_TITLE)

  for (const { model, prompt, extraArgs, expectedExtension } of models) {
    const modelExt = expectedExtension ?? ext
    const imageFileName = `generated-image.${modelExt}`
    const budgetKey = `image-${imageService}-${model}`
    budgetedTest(budgetKey, `${model} generates image and metadata`, async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} not configured`)

      const outputDir = await runCommandAndExpectOutputDir(IMAGE_GEN_TITLE, [
        'src/cli/create-cli.ts',
        'image',
        prompt,
        '--provider',
        `${provider}=${model}`,
        ...(extraArgs ?? [])
      ])

      const imagePath = `${outputDir}/${imageFileName}`
      const imageExists = await fileExists(imagePath)
      expect(imageExists).toBe(true)

      const imageFile = Bun.file(imagePath)
      expect(imageFile.size).toBeGreaterThan(0)

      const metadata = await readRunMetadata(outputDir) as {
        image?: Array<{ imageService?: string; imageModel?: string; imageFileNames?: string[] }>
      }
      expect(metadata.image?.[0]?.imageService).toBe(imageService)
      expect(metadata.image?.[0]?.imageModel).toBe(model)
      expect(metadata.image?.[0]?.imageFileNames?.[0]).toBe(imageFileName)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

export const defineImageServicePriceTests = ({
  models,
  provider,
  imageService,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[], expectedExtension?: string }>
  provider: string
  imageService: string
}): void => {
  for (const { model, extraArgs } of models) {
    test(`${imageService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'image',
        'a sunset',
        '--provider',
        `${provider}=${model}`,
        ...(extraArgs ?? []),
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
