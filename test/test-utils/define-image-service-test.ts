import { expect } from 'bun:test'
import {
  fileExists,
  cleanupTestOutput,
} from './test-helpers'
import { budgetedTest } from './budget'
import {
  defineInvalidModelTest,
  definePriceEstimateTest,
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
  models: Array<{ model: string, prompt: string, extraArgs?: string[] }>
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

  for (const { model } of models) {
    const budgetKey = `image-${imageService}-${model}`

    definePriceEstimateTest(budgetKey, `--price prints estimate for ${model}`, [
      'src/cli/create-cli.ts',
      'image',
      'a sunset',
      cliFlag,
      model,
      '--price'
    ])
  }

  withOutputLifecycle(IMAGE_GEN_TITLE)

  for (const { model, prompt, extraArgs } of models) {
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
        const imageExists = await fileExists(`${outputDir}/generated-image.${ext}`)
        expect(imageExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as {
          image?: Array<{ imageService?: string; imageModel?: string; imageFileNames?: string[] }>
        }
        expect(metadata.image?.[0]?.imageService).toBe(imageService)
        expect(metadata.image?.[0]?.imageModel).toBe(model)
        expect(metadata.image?.[0]?.imageFileNames?.[0]).toBe(`generated-image.${ext}`)
      }
    })
  }
}
