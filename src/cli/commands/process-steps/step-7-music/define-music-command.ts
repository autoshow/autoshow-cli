import { defineCommand } from 'clerc'
import { musicGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runMusicGen } from './run-music-gen'
import { validateElevenlabsMusicModel, validateMinimaxMusicModel } from '~/cli/commands/models/model-options'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const musicCommand = defineCommand({
  name: 'music',
  description: 'Generate music from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for music generation' }],
  flags: musicGenFlags
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const elevenlabsModelRaw = typeof flags['elevenlabs-music'] === 'string' ? flags['elevenlabs-music'] : undefined
  const minimaxModelRaw = typeof flags['minimax-music'] === 'string' ? flags['minimax-music'] : undefined

  const providerCount = [elevenlabsModelRaw, minimaxModelRaw].filter(Boolean).length
  if (providerCount > 1) {
    throw CLIUsageError('Cannot use more than one music provider at the same time (--elevenlabs-music, --minimax-music)')
  }
  if (providerCount === 0) {
    throw CLIUsageError('Specify a music generation provider: --elevenlabs-music <model> or --minimax-music <model>')
  }

  if (elevenlabsModelRaw) validateElevenlabsMusicModel(elevenlabsModelRaw)
  if (minimaxModelRaw) validateMinimaxMusicModel(minimaxModelRaw)


  const musicDurationRaw = typeof flags['music-duration'] === 'string' ? parseInt(flags['music-duration'], 10) : undefined
  const musicDuration = Number.isFinite(musicDurationRaw) ? musicDurationRaw : undefined
  const musicLyricsFile = typeof flags['music-lyrics-file'] === 'string' ? flags['music-lyrics-file'] : undefined
  const musicInstrumental = flags['music-instrumental'] === true

  const musicConfigPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const musicConfigPath = await resolveConfigPath(musicConfigPathOverride)
  const musicConfig = await loadConfig(musicConfigPath)
  const musicMaxCents = musicConfig.pricing?.maxCents ?? (musicConfig.pricing?.maxUsd !== undefined ? musicConfig.pricing.maxUsd * 100 : undefined)
  const musicOpts = buildOptsFromFlags(true, flags as Record<string, unknown>)
  const { shouldExit: musicShouldExit } = await runPreflight('music', prompt, musicOpts, musicMaxCents)
  if (musicShouldExit) {
    l.report.expectedOutput('./output/<timestamp>_music-gen/', ['Music file', 'metadata.json'])
    return
  }

  const uniqueDirName = createUniqueDirectoryName('music-gen')
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { musicPath, metadata } = await runWithLogContext({ step: 'step-7-music' }, async () =>
    await runMusicGen(prompt, outputDir, {
      elevenlabsMusicModel: elevenlabsModelRaw,
      minimaxMusicModel: minimaxModelRaw,
      musicDuration,
      musicLyricsFile,
      musicInstrumental
    })
  )

  const estimated = computeEstimatedCosts({
    elevenlabsMusicModel: elevenlabsModelRaw,
    minimaxMusicModel: minimaxModelRaw,
    musicDuration,
    musicLyricsFile,
    musicInstrumental
  })
  const actual = computeActualCosts({ step7: metadata })
  const cost = { estimated, actual }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ music: metadata, cost }, null, 2))

  l.report.complete(outputDir, { music: musicPath.split('/').pop() as string, metadata: 'metadata.json' })
})
