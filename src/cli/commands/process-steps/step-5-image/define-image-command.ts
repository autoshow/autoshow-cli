import { defineCommand } from 'clerc'
import { imageGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'

export const imageCommand = defineCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageGenFlags,
  help: {
    examples: [
      ['bun as image "a dramatic fox portrait in snow" --gemini-image imagen-4.0-fast-generate-001', 'Generate with Gemini'],
      ['bun as image "an oil painting of a lighthouse" --openai-image gpt-image-1 --image-size 1024x1024', 'Generate with OpenAI'],
      ['bun as image "a clean product photo of a red enamel camping mug" --glm-image glm-image', 'Generate with Z.AI GLM'],
      ['bun as image "a futuristic observatory at sunset" --grok-image grok-imagine-image --image-size 1K', 'Generate with Grok'],
      ['bun as image "a cinematic product photo of a red enamel camping mug" --runway-image gen4_image --image-size 720p', 'Generate with Runway']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const imageMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const imageOpts = buildOptsFromFlags(true, flags as Record<string, unknown>, [], {}, new Set(), Bun.argv.slice(2))
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, --minimax-image, --glm-image, --grok-image, or --runway-image.')
  }

  const { shouldExit: imageShouldExit } = await runPreflight('image', prompt, imageOpts, imageMaxCents)
  if (imageShouldExit) {
    const expectedFiles = [
      ...imageTargets.flatMap((target) =>
        getExpectedImageArtifactFileNames(target, imageOpts, imageTargets.length === 1)
      ),
      'run.json'
    ]
    l.report.expectedOutput('./output/<timestamp>_image-gen/', expectedFiles)
    return
  }

  const outputDir = await createGenerationOutputDir('image-gen')

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

  await writeGenerationMetadata(outputDir, 'image', metadata, cost, timing)

  l.report.complete(
    outputDir,
    {
      ...buildImageArtifactMap(metadata),
      run: 'run.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Image',
        'image',
        metadata,
        actual.steps,
        (entry) => `${entry.imageService}/${entry.imageModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
