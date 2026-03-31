import { defineCommand } from 'clerc'
import { videoGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runVideoGen } from './run-video-gen'
import { collectVideoTargets, buildVideoArtifactMap, getVideoArtifactFileName } from './video-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { Step6VideoMetadata } from '~/types'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'

export const videoCommand = defineCommand({
  name: 'video',
  description: 'Generate a video from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for video generation' }],
  flags: videoGenFlags,
  help: {
    examples: [
      ['bun as video output/text.md --gemini-video', 'Generate video from summary with Gemini Veo'],
      ['bun as video output/text.md --minimax-video', 'Generate video with MiniMax Hailuo']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const geminiModelRaw = typeof flags['gemini-video'] === 'string' ? flags['gemini-video'] : undefined
  const minimaxModelRaw = typeof flags['minimax-video'] === 'string' ? flags['minimax-video'] : undefined

  const videoDurationRaw = typeof flags['video-duration'] === 'string' ? parseInt(flags['video-duration'], 10) : undefined
  const videoDuration = Number.isFinite(videoDurationRaw) ? videoDurationRaw : undefined
  const videoSize = typeof flags['video-size'] === 'string' ? flags['video-size'] : undefined
  const videoAspectRatio = typeof flags['video-aspect-ratio'] === 'string' ? flags['video-aspect-ratio'] : undefined
  const videoResolution = typeof flags['video-resolution'] === 'string' ? flags['video-resolution'] : undefined

  const videoConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const videoConfigPath = await resolveConfigPath(videoConfigPathOverride)
  const videoConfig = await loadConfig(videoConfigPath)
  const videoMaxCents = resolveMaxCents(videoConfig.pricing)
  const videoOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)

  const videoTargets = collectVideoTargets({
    geminiVideoModel: geminiModelRaw,
    minimaxVideoModel: minimaxModelRaw,
    videoDuration,
    videoSize,
    videoAspectRatio,
    videoResolution
  })
  if (videoTargets.length === 0) {
    throw CLIUsageError('Specify a video generation provider: --gemini-video <model>, or --minimax-video <model>')
  }

  const { shouldExit: videoShouldExit } = await runPreflight('video', prompt, videoOpts, videoMaxCents)
  if (videoShouldExit) {
    const singleTarget = videoTargets.length === 1
    l.report.expectedOutput('./output/<timestamp>_video-gen/', [
      ...videoTargets.map((t) => getVideoArtifactFileName(t, singleTarget)),
      'metadata.json'
    ])
    return
  }

  const uniqueDirName = createUniqueDirectoryName('video-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { metadata } = await runWithLogContext({ step: 'step-6-video' }, async () =>
    await runVideoGen(prompt, outputDir, {
      geminiVideoModel: geminiModelRaw,
      minimaxVideoModel: minimaxModelRaw,
      videoDuration,
      videoSize,
      videoAspectRatio,
      videoResolution
    })
  )

  const estimatedVideoTargets = videoTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(videoDuration !== undefined ? { durationSeconds: videoDuration } : {})
  }))
  const estimated = computeEstimatedCosts({
    geminiVideoModel: geminiModelRaw,
    minimaxVideoModel: minimaxModelRaw,
    videoDuration,
    videoSize,
    videoResolution
  })
  const actual = computeActualCosts({ step6: metadata })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      videoTargets: estimatedVideoTargets,
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ video: serializeOneOrMany(metadata), cost, timing }, null, 2))

  const videoSteps = actual.steps.filter((step) => step.step === 'video')
  l.report.complete(
    outputDir,
    {
      ...buildVideoArtifactMap(metadata),
      metadata: 'metadata.json'
    },
    {
      steps: metadata.map((entry: Step6VideoMetadata, index: number) => ({
        label: 'Video',
        providerModel: `${entry.videoGenService}/${entry.videoGenModel}`,
        processingTime: entry.processingTime,
        cost: videoSteps[index]?.cost ?? 0
      })),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
