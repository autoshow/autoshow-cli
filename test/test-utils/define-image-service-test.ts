import { test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from './test-helpers'
import { budgetedTest } from './budget'

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

  test(`rejects invalid ${imageService} image model`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'image',
      'a sunset',
      cliFlag,
      'invalid-model'
    ])
    expect(result.exitCode).not.toBe(0)
  })

  for (const { model } of models) {
    const budgetKey = `image-${imageService}-${model}`
    budgetedTest(budgetKey, `--price prints estimate for ${model}`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'image',
        'a sunset',
        cliFlag,
        model,
        '--price'
      ])
      expect(result.exitCode).toBe(0)
    })
  }

  beforeAll(async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(IMAGE_GEN_TITLE)
  })

  for (const { model, prompt, extraArgs } of models) {
    const budgetKey = `image-${imageService}-${model}`
    budgetedTest(budgetKey, `${model} generates image and metadata`, async () => {
      await cleanupTestOutput(IMAGE_GEN_TITLE)

      const hasKey = await hasConfiguredEnvVar(envVarKey)
      if (!hasKey) {
        console.log(`Skipping: ${envVarKey} not configured`)
        return
      }

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'image',
        prompt,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(IMAGE_GEN_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const imageExists = await fileExists(`${outputDir}/generated-image.${ext}`)
        expect(imageExists).toBe(true)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          image?: { imageService?: string; imageModel?: string; imageFileName?: string }
        }
        expect(metadata.image?.imageService).toBe(imageService)
        expect(metadata.image?.imageModel).toBe(model)
        expect(metadata.image?.imageFileName).toBe(`generated-image.${ext}`)
      }
    })
  }
}
