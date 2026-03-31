import { defineCommand } from 'clerc'
import { imageGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { Step5Metadata } from '~/types'

const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items

export const imageCommand = defineCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageGenFlags,
  help: {
    examples: [
      ['bun as image output/text.md --gemini-image', 'Generate image from summary with Gemini'],
      ['bun as image output/text.md --openai-image --image-size 1024x1024', 'Generate with OpenAI']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const imageConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const imageConfigPath = await resolveConfigPath(imageConfigPathOverride)
  const imageConfig = await loadConfig(imageConfigPath)
  const imageMaxCents = imageConfig.pricing?.maxCents ?? (imageConfig.pricing?.maxUsd !== undefined ? imageConfig.pricing.maxUsd * 100 : undefined)
  const imageOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, or --minimax-image.')
  }

  const { shouldExit: imageShouldExit } = await runPreflight('image', prompt, imageOpts, imageMaxCents)
  if (imageShouldExit) {
    const expectedFiles = [
      ...imageTargets.flatMap((target) =>
        getExpectedImageArtifactFileNames(target, imageOpts, imageTargets.length === 1)
      ),
      'metadata.json'
    ]
    l.report.expectedOutput('./output/<timestamp>_image-gen/', expectedFiles)
    return
  }

  const uniqueDirName = createUniqueDirectoryName('image-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { metadata } = await runWithLogContext({ step: 'step-5-image' }, async () =>
    await runImageGen(prompt, outputDir, imageOpts)
  )

  const estimatedImageTargets = imageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, imageOpts)
  }))
  const estimated = computeEstimatedCosts({
    imageTargets: estimatedImageTargets
  })
  const actual = computeActualCosts({ step5: metadata })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      imageTargets: estimatedImageTargets,
    }),
    actual: computeActualProcessingTimes({ step5: metadata }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ image: serializeOneOrMany(metadata), cost, timing }, null, 2))

  const imageSteps = actual.steps.filter((step) => step.step === 'image')
  l.report.complete(
    outputDir,
    {
      ...buildImageArtifactMap(metadata),
      metadata: 'metadata.json'
    },
    {
      steps: metadata.map((entry: Step5Metadata, index: number) => ({
        label: 'Image',
        providerModel: `${entry.imageService}/${entry.imageModel}`,
        processingTime: entry.processingTime,
        cost: imageSteps[index]?.cost ?? 0
      })),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
