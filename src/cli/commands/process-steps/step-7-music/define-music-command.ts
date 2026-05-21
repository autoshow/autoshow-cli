import { defineCliCommand } from '~/cli/native'
import { musicCommandFlags } from '~/cli/flags'
import { MUSIC_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/music-flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags as extractConfigExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeCommandSelectorArgs, normalizeCommandSelectorFlags } from '~/cli/commands/process-steps/service-selector-normalization'
import { runMusicGen } from './run-music-gen'
import { runMusicLyricVideo } from './lyrics-video/run-lyrics-video'
import { buildMusicArtifactMap, collectMusicTargets, getMusicArtifactFileName } from './music-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { fileExists } from '~/utils/cli-utils'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'

const HOSTED_MUSIC_FLAGS = [
  'all-music',
  'elevenlabs',
  'minimax',
  'gemini',
  'music-duration',
  'music-lyrics-file',
  'music-instrumental',
  'output-dir',
  'out',
  'price'
] as const

const LYRIC_VIDEO_FLAGS = [
  'audio',
  'captions',
  'batch',
  'model',
  'font',
  'keep-tmp'
] as const

const hasExplicitFlag = (argv: string[], flag: string): boolean =>
  argv.some((token) => token === `--${flag}` || token.startsWith(`--${flag}=`))

const getMusicArgv = (): string[] => {
  const argv = Bun.argv.slice(2)
  return argv[0] === 'music' ? argv.slice(1) : argv
}

const collectExplicitFlags = (
  argv: string[],
  flagNames: readonly string[]
): string[] => flagNames.filter((flag) => hasExplicitFlag(argv, flag)).map((flag) => `--${flag}`)

const runHostedMusicGeneration = async (
  input: string,
  flags: Record<string, unknown>
): Promise<void> => {
  const prompt = isTextInputPath(input) && await fileExists(input)
    ? await Bun.file(input).text()
    : input

  const musicDurationRaw = typeof flags['music-duration'] === 'string' ? parseInt(flags['music-duration'], 10) : undefined
  const musicDuration = Number.isFinite(musicDurationRaw) ? musicDurationRaw : undefined
  const musicLyricsFile = typeof flags['music-lyrics-file'] === 'string' ? flags['music-lyrics-file'] : undefined
  const musicInstrumental = flags['music-instrumental'] === true

  const musicMaxCents = await resolveMaxCentsFromFlags(flags)
  const explicitRuntimeFlags = extractConfigExplicitFlags(Bun.argv.slice(2))
  const normalized = normalizeCommandSelectorFlags(flags, explicitRuntimeFlags, MUSIC_COMMAND_SELECTOR_FLAGS)
  const normalizedArgs = normalizeCommandSelectorArgs(Bun.argv.slice(2), MUSIC_COMMAND_SELECTOR_FLAGS)
  const musicOpts = buildOptsFromFlags(true, normalized.flags, [], {}, normalized.explicitFlags, normalizedArgs)

  const musicTargets = collectMusicTargets(musicOpts)
  if (musicTargets.length === 0) {
    throw CLIUsageError('Specify a music generation provider: --elevenlabs <model>, --minimax <model>, or --gemini <model>')
  }

  const { estimate: preflightEstimate, shouldExit: musicShouldExit } = await runPreflight('music', prompt, musicOpts, musicMaxCents)
  if (musicShouldExit) {
    const singleTarget = musicTargets.length === 1
    const expectedFiles = [
      ...musicTargets.map((target) => getMusicArtifactFileName(target, singleTarget)),
      'run.json'
    ]
    l.report.expectedOutput(getGenerationExpectedOutputDir(flags, './output/<timestamp>_music-gen/'), expectedFiles)
    return
  }

  const outputDir = await createGenerationOutputDir('music-gen', flags)

  const { metadata } = await runWithLogContext({ step: 'step-7-music' }, async () =>
    await runMusicGen(prompt, outputDir, musicOpts)
  )

  const estimatedMusicTargets = musicTargets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(musicDuration !== undefined ? { durationSeconds: musicDuration } : {})
  }))
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    musicTargets: estimatedMusicTargets,
    musicDuration,
    musicLyricsFile,
    musicInstrumental
  })
  const actual = computeActualCosts({ step7: metadata })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      musicTargets: estimatedMusicTargets,
    }),
    actual: computeActualProcessingTimes({ step7: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'music', metadata, cost, timing, {
    input: prompt,
    requestedProviders: musicTargets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildMusicArtifactMap(metadata),
      run: 'run.json'
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
}

export const musicCommand = defineCliCommand({
  name: 'music',
  description: 'Generate hosted music or render lyric videos from local audio',
  parameters: [{ key: '[input]', description: 'Hosted music prompt or path to a local .md/.txt file' }],
  flags: musicCommandFlags,
  help: {
    examples: [
      ['bun as music "cinematic orchestral trailer, dramatic strings and percussion" --elevenlabs music_v1', 'Generate music with ElevenLabs'],
      ['bun as music "an ambient piano instrumental" --minimax music-2.6 --music-instrumental', 'Generate instrumental music with MiniMax'],
      ['bun as music "bright 90s pop rock with a huge chorus" --gemini lyria-3-clip-preview', 'Generate a 30s Lyria 3 clip with Gemini'],
      ['bun as music input/examples/tts/1-tts.md --minimax music-2.6', 'Use a local markdown file as the prompt body'],
      ['bun as music --audio input/examples/lyrics/01-example-song.mp3', 'Render a lyric video from local audio'],
      ['bun as music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt', 'Rerender from edited captions without rerunning Whisper'],
      ['bun as music --batch --model small', 'Render lyric videos for every supported audio file under input']
    ]
  }
}, async (ctx) => {
  const input = typeof ctx.parameters.input === 'string' ? ctx.parameters.input : undefined
  const flags = ctx.flags as Record<string, unknown>
  const musicArgv = getMusicArgv()
  const hostedFlags = collectExplicitFlags(musicArgv, HOSTED_MUSIC_FLAGS)
  const lyricVideoFlags = collectExplicitFlags(musicArgv, LYRIC_VIDEO_FLAGS)

  if (input && lyricVideoFlags.length > 0) {
    throw CLIUsageError(`Do not combine lyric-video flags (${lyricVideoFlags.join(', ')}) with a hosted music prompt`)
  }

  if (lyricVideoFlags.length > 0 && hostedFlags.length > 0) {
    throw CLIUsageError(`Do not combine hosted music flags (${hostedFlags.join(', ')}) with lyric-video flags (${lyricVideoFlags.join(', ')})`)
  }

  if (lyricVideoFlags.length > 0) {
    await runMusicLyricVideo(flags)
    return
  }

  if (!input) {
    throw CLIUsageError(
      hostedFlags.length > 0
        ? 'Missing hosted music prompt input'
        : 'Missing music mode: provide a prompt with --elevenlabs/--minimax/--gemini, or use --audio/--batch for lyric-video rendering'
    )
  }

  await runHostedMusicGeneration(input, flags)
})
