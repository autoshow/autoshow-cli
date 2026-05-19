import { expect, test } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
  runCommand,
} from './test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineInvalidModelTest,
  runCommandAndExpectOutputDir,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'

const IMAGE_GEN_TITLE = 'image-gen'

export const defineImageServiceTest = ({
  models,
  cliFlag,
  imageService,
  envVarKey,
  imageExtension,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[], expectedExtension?: string }>
  cliFlag: string
  imageService: string
  envVarKey: string
  imageExtension?: string
}): void => {
  const ext = imageExtension ?? 'png'

  defineInvalidModelTest(`rejects invalid ${imageService} image model`, [
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    cliFlag,
    'invalid-model'
  ])

  withOutputLifecycle(IMAGE_GEN_TITLE)

  for (const { model, prompt, extraArgs, expectedExtension } of models) {
    const modelExt = expectedExtension ?? ext
    const budgetKey = `image-${imageService}-${model}`
    budgetedTest(budgetKey, `${model} generates image and metadata`, async () => {
      await cleanupTestOutput(IMAGE_GEN_TITLE)

      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} not configured`)) {
        return
      }

      const outputDir = await runCommandAndExpectOutputDir(IMAGE_GEN_TITLE, [
        'src/cli/create-cli.ts',
        'image',
        prompt,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      if (outputDir) {
        const imageExists = await fileExists(`${outputDir}/generated-image.${modelExt}`)
        expect(imageExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as {
          image?: Array<{ imageService?: string; imageModel?: string; imageFileNames?: string[] }>
        }
        expect(metadata.image?.[0]?.imageService).toBe(imageService)
        expect(metadata.image?.[0]?.imageModel).toBe(model)
        expect(metadata.image?.[0]?.imageFileNames?.[0]).toBe(`generated-image.${modelExt}`)
      }
    }, E2E_TEST_TIMEOUT_MS)
  }
}

export const defineImageServicePriceTests = ({
  models,
  cliFlag,
  imageService,
}: {
  models: Array<{ model: string, prompt: string, extraArgs?: string[], expectedExtension?: string }>
  cliFlag: string
  imageService: string
}): void => {
  for (const { model, extraArgs } of models) {
    test(`${imageService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'image',
        'a sunset',
        cliFlag,
        model,
        ...(extraArgs ?? []),
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
