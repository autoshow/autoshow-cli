import { defineCliCommand } from '~/cli/native'
import { videoCommandFlags } from '~/cli/flags'
import { VIDEO_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/video-flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeCommandSelectorArgs, normalizeCommandSelectorFlags } from '~/cli/commands/process-steps/service-selector-normalization'
import { runVideoGen } from './run-video-gen'
import { collectVideoTargets, buildVideoArtifactMap, getVideoArtifactFileName } from './video-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'

export const videoCommand = defineCliCommand({
  name: 'video',
  description: 'Generate a video from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for video generation' }],
  flags: videoCommandFlags,
  help: {
    examples: [
      ['bun as video "a cinematic mountain sunrise" --gemini veo-3.1-lite-generate-preview', 'Generate video with Gemini Veo'],
      ['bun as video "a cinematic mountain sunrise" --minimax MiniMax-Hailuo-2.3', 'Generate video with MiniMax Hailuo'],
      ['bun as video "a cat playing with yarn" --glm cogvideox-3', 'Generate video with GLM CogVideoX'],
      ['bun as video "a cat playing piano" --grok grok-imagine-video', 'Generate video with Grok'],
      ['bun as video "a cinematic mountain sunrise" --runway gen4.5', 'Generate video with Runway Gen-4.5']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const videoMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const normalized = normalizeCommandSelectorFlags(flags as Record<string, unknown>, explicitFlags, VIDEO_COMMAND_SELECTOR_FLAGS)
  const normalizedArgs = normalizeCommandSelectorArgs(Bun.argv.slice(2), VIDEO_COMMAND_SELECTOR_FLAGS)
  const videoOpts = buildOptsFromFlags(true, normalized.flags, [], {}, normalized.explicitFlags, normalizedArgs)
  const videoTargets = collectVideoTargets(videoOpts)
  if (videoTargets.length === 0) {
    throw CLIUsageError('Specify a video generation provider: --gemini <model>, --minimax <model>, --glm <model>, --grok <model>, or --runway <model>')
  }

  const { estimate: preflightEstimate, shouldExit: videoShouldExit } = await runPreflight('video', prompt, videoOpts, videoMaxCents)
  if (videoShouldExit) {
    const singleTarget = videoTargets.length === 1
    l.report.expectedOutput(getGenerationExpectedOutputDir(flags as Record<string, unknown>, './output/<timestamp>_video-gen/'), [
      ...videoTargets.map((t) => getVideoArtifactFileName(t, singleTarget)),
      'run.json'
    ])
    return
  }

  const outputDir = await createGenerationOutputDir('video-gen', flags as Record<string, unknown>)

  const { metadata } = await runWithLogContext({ step: 'step-6-video' }, async () =>
    await runVideoGen(prompt, outputDir, videoOpts)
  )

  const estimatedVideoTargets = videoTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(videoOpts.videoDuration !== undefined ? { durationSeconds: videoOpts.videoDuration } : {})
  }))
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    videoTargets: estimatedVideoTargets,
    videoDuration: videoOpts.videoDuration,
    videoSize: videoOpts.videoSize,
    videoAspectRatio: videoOpts.videoAspectRatio,
    videoResolution: videoOpts.videoResolution,
    videoMode: videoOpts.videoMode
  })
  const actual = computeActualCosts({ step6: metadata })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      videoTargets: estimatedVideoTargets,
      ...(videoOpts.videoResolution !== undefined ? { videoResolution: videoOpts.videoResolution } : {}),
      ...(videoOpts.videoMode !== undefined ? { videoMode: videoOpts.videoMode } : {}),
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'video', metadata, cost, timing, {
    input: prompt,
    requestedProviders: videoTargets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildVideoArtifactMap(metadata),
      run: 'run.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Video',
        'video',
        metadata,
        actual.steps,
        (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
