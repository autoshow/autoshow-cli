import { defineCommand } from 'clerc'
import { videoGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runVideoGen } from './run-video-gen'
import { validateSoraVideoModel, validateGeminiVideoModel, validateMinimaxVideoModel } from '~/cli/commands/models/model-options'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const videoCommand = defineCommand({
  name: 'video',
  description: 'Generate a video from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for video generation' }],
  flags: videoGenFlags
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const soraModelRaw = typeof flags['sora-video'] === 'string' ? flags['sora-video'] : undefined
  const geminiModelRaw = typeof flags['gemini-video'] === 'string' ? flags['gemini-video'] : undefined
  const minimaxModelRaw = typeof flags['minimax-video'] === 'string' ? flags['minimax-video'] : undefined

  const providerCount = [soraModelRaw, geminiModelRaw, minimaxModelRaw].filter(Boolean).length
  if (providerCount > 1) {
    throw CLIUsageError('Cannot use more than one video provider at the same time (--sora-video, --gemini-video, --minimax-video)')
  }
  if (providerCount === 0) {
    throw CLIUsageError('Specify a video generation provider: --sora-video <model>, --gemini-video <model>, or --minimax-video <model>')
  }

  if (soraModelRaw) validateSoraVideoModel(soraModelRaw)
  if (geminiModelRaw) validateGeminiVideoModel(geminiModelRaw)
  if (minimaxModelRaw) validateMinimaxVideoModel(minimaxModelRaw)


  const videoDurationRaw = typeof flags['video-duration'] === 'string' ? parseInt(flags['video-duration'], 10) : undefined
  const videoDuration = Number.isFinite(videoDurationRaw) ? videoDurationRaw : undefined
  const videoSize = typeof flags['video-size'] === 'string' ? flags['video-size'] : undefined
  const videoAspectRatio = typeof flags['video-aspect-ratio'] === 'string' ? flags['video-aspect-ratio'] : undefined
  const videoResolution = typeof flags['video-resolution'] === 'string' ? flags['video-resolution'] : undefined

  const videoConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const videoConfigPath = await resolveConfigPath(videoConfigPathOverride)
  const videoConfig = await loadConfig(videoConfigPath)
  const videoMaxCents = videoConfig.pricing?.maxCents ?? (videoConfig.pricing?.maxUsd !== undefined ? videoConfig.pricing.maxUsd * 100 : undefined)
  const videoOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)
  const { shouldExit: videoShouldExit } = await runPreflight('video', prompt, videoOpts, videoMaxCents)
  if (videoShouldExit) {
    l.report.expectedOutput('./output/<timestamp>_video-gen/', ['Video file', 'metadata.json'])
    return
  }

  const uniqueDirName = createUniqueDirectoryName('video-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { videoPath, metadata } = await runWithLogContext({ step: 'step-6-video' }, async () =>
    await runVideoGen(prompt, outputDir, {
      soraVideoModel: soraModelRaw,
      geminiVideoModel: geminiModelRaw,
      minimaxVideoModel: minimaxModelRaw,
      videoDuration,
      videoSize,
      videoAspectRatio,
      videoResolution
    })
  )

  const estimated = computeEstimatedCosts({
    soraVideoModel: soraModelRaw,
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
      videoService: metadata.videoGenService,
      videoModel: metadata.videoGenModel,
      videoDurationSeconds: metadata.videoDuration,
    }),
    actual: computeActualProcessingTimes({ step6: metadata }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ video: metadata, cost, timing }, null, 2))

  l.report.complete(outputDir, { video: videoPath.split('/').pop() as string, metadata: 'metadata.json' })
})
