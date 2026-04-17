import { defineCommand } from 'clerc'
import { videoGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runVideoGen } from './run-video-gen'
import { collectVideoTargets, buildVideoArtifactMap, getVideoArtifactFileName } from './video-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const videoCommand = defineCommand({
  name: 'video',
  description: 'Generate a video from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for video generation' }],
  flags: videoGenFlags,
  help: {
    examples: [
      ['bun as video "a cinematic mountain sunrise" --gemini-video veo-3.1-fast-generate-preview', 'Generate video with Gemini Veo'],
      ['bun as video "a cinematic mountain sunrise" --minimax-video MiniMax-Hailuo-2.3', 'Generate video with MiniMax Hailuo']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const videoMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const videoOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)
  const videoTargets = collectVideoTargets(videoOpts)
  if (videoTargets.length === 0) {
    throw CLIUsageError('Specify a video generation provider: --gemini-video <model>, or --minimax-video <model>')
  }

  const { shouldExit: videoShouldExit } = await runPreflight('video', prompt, videoOpts, videoMaxCents)
  if (videoShouldExit) {
    const singleTarget = videoTargets.length === 1
    l.report.expectedOutput('./output/<timestamp>_video-gen/', [
      ...videoTargets.map((t) => getVideoArtifactFileName(t, singleTarget)),
      'run.json'
    ])
    return
  }

  const outputDir = await createGenerationOutputDir('video-gen')

  const { metadata } = await runWithLogContext({ step: 'step-6-video' }, async () =>
    await runVideoGen(prompt, outputDir, videoOpts)
  )

  const estimatedVideoTargets = videoTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(videoOpts.videoDuration !== undefined ? { durationSeconds: videoOpts.videoDuration } : {})
  }))
  const estimated = computeEstimatedCosts({
    geminiVideoModel: videoOpts.geminiVideoModel,
    minimaxVideoModel: videoOpts.minimaxVideoModel,
    videoDuration: videoOpts.videoDuration,
    videoSize: videoOpts.videoSize,
    videoResolution: videoOpts.videoResolution
  })
  const actual = computeActualCosts({ step6: metadata })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      videoTargets: estimatedVideoTargets,
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'video', metadata, cost, timing)

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
