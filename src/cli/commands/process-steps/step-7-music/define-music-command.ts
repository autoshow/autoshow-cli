import { defineCommand } from 'clerc'
import { musicGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runMusicGen } from './run-music-gen'
import { buildMusicArtifactMap, collectMusicTargets, getMusicArtifactFileName } from './music-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { Step7MusicMetadata } from '~/types'

const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items

export const musicCommand = defineCommand({
  name: 'music',
  description: 'Generate music from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for music generation' }],
  flags: musicGenFlags
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const musicDurationRaw = typeof flags['music-duration'] === 'string' ? parseInt(flags['music-duration'], 10) : undefined
  const musicDuration = Number.isFinite(musicDurationRaw) ? musicDurationRaw : undefined
  const musicLyricsFile = typeof flags['music-lyrics-file'] === 'string' ? flags['music-lyrics-file'] : undefined
  const musicInstrumental = flags['music-instrumental'] === true

  const musicConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const musicConfigPath = await resolveConfigPath(musicConfigPathOverride)
  const musicConfig = await loadConfig(musicConfigPath)
  const musicMaxCents = musicConfig.pricing?.maxCents ?? (musicConfig.pricing?.maxUsd !== undefined ? musicConfig.pricing.maxUsd * 100 : undefined)
  const musicOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)

  const musicTargets = collectMusicTargets(musicOpts)
  if (musicTargets.length === 0) {
    throw CLIUsageError('Specify a music generation provider: --elevenlabs-music <model> or --minimax-music <model>')
  }

  const { shouldExit: musicShouldExit } = await runPreflight('music', prompt, musicOpts, musicMaxCents)
  if (musicShouldExit) {
    const singleTarget = musicTargets.length === 1
    const expectedFiles = [
      ...musicTargets.map((target) => getMusicArtifactFileName(target, singleTarget)),
      'metadata.json'
    ]
    l.report.expectedOutput('./output/<timestamp>_music-gen/', expectedFiles)
    return
  }

  const uniqueDirName = createUniqueDirectoryName('music-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { metadata } = await runWithLogContext({ step: 'step-7-music' }, async () =>
    await runMusicGen(prompt, outputDir, musicOpts)
  )

  const estimatedMusicTargets = musicTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(musicDuration !== undefined ? { durationSeconds: musicDuration } : {})
  }))
  const estimated = computeEstimatedCosts({
    elevenlabsMusicModel: musicOpts.elevenlabsMusicModel,
    minimaxMusicModel: musicOpts.minimaxMusicModel,
    musicDuration,
    musicLyricsFile,
    musicInstrumental
  })
  const actual = computeActualCosts({ step7: metadata })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      musicTargets: estimatedMusicTargets,
    }),
    actual: computeActualProcessingTimes({ step7: metadata }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ music: serializeOneOrMany(metadata), cost, timing }, null, 2))

  const musicSteps = actual.steps.filter((step) => step.step === 'music')
  l.report.complete(
    outputDir,
    {
      ...buildMusicArtifactMap(metadata),
      metadata: 'metadata.json'
    },
    {
      steps: metadata.map((entry: Step7MusicMetadata, index: number) => ({
        label: 'Music',
        providerModel: `${entry.musicService}/${entry.musicModel}`,
        processingTime: entry.processingTime,
        cost: musicSteps[index]?.cost ?? 0
      })),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
