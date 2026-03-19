import { defineCommand } from 'clerc'
import { imageGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runImageGen } from './run-image-gen'
import {
  validateGeminiImageModel,
  validateOpenAIImageModel,
  validateMinimaxImageModel
} from '~/cli/commands/models/model-options'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const imageCommand = defineCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageGenFlags
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const geminiModelRaw = typeof flags['gemini-image'] === 'string' ? flags['gemini-image'] : undefined
  const openaiModelRaw = typeof flags['openai-image'] === 'string' ? flags['openai-image'] : undefined
  const minimaxModelRaw = typeof flags['minimax-image'] === 'string' ? flags['minimax-image'] : undefined

  const providerCount = [geminiModelRaw, openaiModelRaw, minimaxModelRaw].filter(Boolean).length
  if (providerCount > 1) {
    throw CLIUsageError('Cannot use more than one image provider at the same time (--gemini-image, --openai-image, --minimax-image)')
  }

  if (geminiModelRaw) validateGeminiImageModel(geminiModelRaw)
  if (openaiModelRaw) validateOpenAIImageModel(openaiModelRaw)
  if (minimaxModelRaw) validateMinimaxImageModel(minimaxModelRaw)


  const imageConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const imageConfigPath = await resolveConfigPath(imageConfigPathOverride)
  const imageConfig = await loadConfig(imageConfigPath)
  const imageMaxCents = imageConfig.pricing?.maxCents ?? (imageConfig.pricing?.maxUsd !== undefined ? imageConfig.pricing.maxUsd * 100 : undefined)
  const imageOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)
  const { shouldExit: imageShouldExit } = await runPreflight('image', prompt, imageOpts, imageMaxCents)
  if (imageShouldExit) {
    const countRaw = typeof flags['imagen-count'] === 'string' ? parseInt(flags['imagen-count'], 10) : 1
    const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 1
    const expectedFiles: string[] = []
    if (count === 1) {
      expectedFiles.push('generated-image.png')
    } else {
      for (let i = 0; i < count; i++) {
        expectedFiles.push(i === 0 ? 'generated-image.png' : `generated-image-${i + 1}.png`)
      }
    }
    expectedFiles.push('metadata.json')
    l.report.expectedOutput('./output/<timestamp>_image-gen/', expectedFiles)
    return
  }

  const uniqueDirName = createUniqueDirectoryName('image-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const imagenCountRaw = typeof flags['imagen-count'] === 'string' ? parseInt(flags['imagen-count'], 10) : undefined

  const { imagePaths, metadata } = await runWithLogContext({ step: 'step-5-image' }, async () =>
    await runImageGen(prompt, outputDir, {
      geminiImageModel: geminiModelRaw,
      openaiImageModel: openaiModelRaw,
      minimaxImageModel: minimaxModelRaw,
      imageAspectRatio: typeof flags['image-aspect-ratio'] === 'string' ? flags['image-aspect-ratio'] : undefined,
      imageSize: typeof flags['image-size'] === 'string' ? flags['image-size'] : undefined,
      imageQuality: typeof flags['image-quality'] === 'string' ? flags['image-quality'] : undefined,
      imageFormat: typeof flags['image-format'] === 'string' ? flags['image-format'] : undefined,
      imageBackground: typeof flags['image-background'] === 'string' ? flags['image-background'] : undefined,
      imagenCount: Number.isFinite(imagenCountRaw) ? imagenCountRaw : undefined
    })
  )

  const estimated = computeEstimatedCosts({
    geminiImageModel: geminiModelRaw,
    openaiImageModel: openaiModelRaw,
    minimaxImageModel: minimaxModelRaw,
    imagenCount: Number.isFinite(imagenCountRaw) ? imagenCountRaw : undefined
  })
  const actual = computeActualCosts({ step5: metadata })
  const cost = { estimated, actual }
  const imageService = metadata.imageService
  const imageModel = metadata.imageModel
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      imageService,
      imageModel,
      imageCount: Number.isFinite(imagenCountRaw) ? imagenCountRaw : 1,
    }),
    actual: computeActualProcessingTimes({ step5: metadata }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ image: metadata, cost, timing }, null, 2))

  const imageFiles: Record<string, string> = {}
  for (const p of imagePaths) {
    const fileName = p.split('/').pop() as string
    const fileSize = Bun.file(p).size
    imageFiles[fileName] = `${(fileSize / 1024).toFixed(1)} KB`
  }
  imageFiles['metadata'] = 'metadata.json'
  l.report.complete(outputDir, imageFiles)
})
