import { defineCliCommand } from '~/cli/native'
import { imageCommandFlags } from '~/cli/flags'
import { IMAGE_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/image-flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeCommandSelectorArgs, normalizeCommandSelectorFlags } from '~/cli/commands/process-steps/service-selector-normalization'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'

export const imageCommand = defineCliCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageCommandFlags,
  help: {
    examples: [
      ['bun as image "a clean studio product photo of a red enamel camping mug on white seamless" --openai gpt-image-1.5 --image-size 1024x1024 --image-format png --out output/mug-base', 'Generate a base product image'],
      ['bun as image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --openai gpt-image-1.5 --image-input output/mug-base/generated-image.png --image-format webp --image-compression 80 --out output/mug-edit', 'Edit the generated image with OpenAI'],
      ['bun as image "restyle this product image as a 1960s travel poster" --gemini gemini-3.1-flash-image-preview --image-input output/mug-base/generated-image.png --out output/mug-gemini', 'Use the generated image as a Gemini reference'],
      ['bun as image "a clean product photo of a red enamel camping mug" --minimax image-01 --image-aspect-ratio 16:9', 'Generate with MiniMax'],
      ['bun as image "a clean product photo of a red enamel camping mug" --glm glm-image', 'Generate with Z.AI GLM'],
      ['bun as image "a futuristic observatory at sunset" --grok grok-imagine-image-quality --image-size 1K --image-count 4', 'Generate multiple Grok outputs'],
      ['bun as image "a cinematic product photo of a red enamel camping mug" --runway gen4_image --image-size 720p', 'Generate with Runway'],
      ['bun as image "a cinematic product photo of a red enamel camping mug" --bfl flux-2-pro-preview --image-size 1024x1024', 'Generate with BFL'],
      ['bun as image "a cozy cabin at dusk" --deapi Flux1schnell --image-size 768x768', 'Generate with deAPI']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const imageMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const normalized = normalizeCommandSelectorFlags(flags as Record<string, unknown>, explicitFlags, IMAGE_COMMAND_SELECTOR_FLAGS)
  const normalizedArgs = normalizeCommandSelectorArgs(Bun.argv.slice(2), IMAGE_COMMAND_SELECTOR_FLAGS)
  const imageOpts = buildOptsFromFlags(true, normalized.flags, [], {}, normalized.explicitFlags, normalizedArgs)
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --gemini, --openai, --minimax, --glm, --grok, --runway, --bfl, or --deapi.')
  }

  const { shouldExit: imageShouldExit } = await runPreflight('image', prompt, imageOpts, imageMaxCents)
  if (imageShouldExit) {
    const expectedFiles = [
      ...imageTargets.flatMap((target) =>
        getExpectedImageArtifactFileNames(target, imageOpts, imageTargets.length === 1)
      ),
      'run.json'
    ]
    l.report.expectedOutput(getGenerationExpectedOutputDir(flags as Record<string, unknown>, './output/<timestamp>_image-gen/'), expectedFiles)
    return
  }

  const outputDir = await createGenerationOutputDir('image-gen', flags as Record<string, unknown>)

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
