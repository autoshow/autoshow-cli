import { defineCommand } from 'clerc'
import { imageGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
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
      ['bun as image "a product sketch of a travel mug" --openai-image gpt-image-2 --image-size 1024x1024 --image-quality low', 'Generate low-cost OpenAI drafts'],
      ['bun as image "a clean product photo of a red enamel camping mug" --glm-image glm-image', 'Generate with Z.AI GLM'],
      ['bun as image "a futuristic observatory at sunset" --grok-image grok-imagine-image --image-size 1K', 'Generate with Grok'],
      ['bun as image "a cinematic product photo of a red enamel camping mug" --runway-image gen4_image --image-size 720p', 'Generate with Runway'],
      ['bun as image "a cinematic product photo of a red enamel camping mug" --bfl-image flux-2-pro-preview --image-size 1024x1024', 'Generate with BFL'],
      ['bun as image "a cozy cabin at dusk" --deapi-image Flux1schnell --image-size 768x768', 'Generate with deAPI']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const imageMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const imageOpts = buildOptsFromFlags(true, flags as Record<string, unknown>, [], {}, explicitFlags, Bun.argv.slice(2))
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, --minimax-image, --glm-image, --grok-image, --runway-image, --bfl-image, or --deapi-image.')
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
    applyCostMultipliers: false,
    imageTargets: estimatedImageTargets,
    imageSize: imageOpts.imageSize,
    imageQuality: imageOpts.imageQuality
  })
  const actual = computeActualCosts({ step5: metadata })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      imageTargets: estimatedImageTargets,
    }),
    actual: computeActualProcessingTimes({ step5: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'image', metadata, cost, timing, {
    input: prompt,
    requestedProviders: imageTargets.map((t) => ({ service: t.service, model: t.model }))
  })

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
