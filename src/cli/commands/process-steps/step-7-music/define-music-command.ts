import { defineCommand } from 'clerc'
import { musicGenFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runMusicGen } from './run-music-gen'
import { buildMusicArtifactMap, collectMusicTargets, getMusicArtifactFileName } from './music-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const musicCommand = defineCommand({
  name: 'music',
  description: 'Generate music from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for music generation' }],
  flags: musicGenFlags,
  help: {
    examples: [
      ['bun as music output/text.md --elevenlabs-music', 'Generate music from summary'],
      ['bun as music output/text.md --minimax-music --music-duration 30', 'Generate 30s music with MiniMax']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const musicDurationRaw = typeof flags['music-duration'] === 'string' ? parseInt(flags['music-duration'], 10) : undefined
  const musicDuration = Number.isFinite(musicDurationRaw) ? musicDurationRaw : undefined
  const musicLyricsFile = typeof flags['music-lyrics-file'] === 'string' ? flags['music-lyrics-file'] : undefined
  const musicInstrumental = flags['music-instrumental'] === true

  const musicMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
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

  const outputDir = await createGenerationOutputDir('music-gen')

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

  await writeGenerationMetadata(outputDir, 'music', metadata, cost, timing)

  l.report.complete(
    outputDir,
    {
      ...buildMusicArtifactMap(metadata),
      metadata: 'metadata.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Music',
        'music',
        metadata,
        actual.steps,
        (entry) => `${entry.musicService}/${entry.musicModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
