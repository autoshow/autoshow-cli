import type { ProcessingOptions, Step7MusicMetadata } from '~/types'
import type { MusicProvider } from '~/types'
import { type ElevenlabsMusicModel, type MinimaxMusicModel, validateElevenlabsMusicModel, validateMinimaxMusicModel } from '~/cli/commands/models/model-options'
import { assertNever } from '~/utils/validate/assert-never'
import { ensureElevenLabsMusicGenSetup } from '~/cli/commands/process-steps/step-7-music/music-services/elevenlabs/elevenlabs-music-gen'
import { ensureMinimaxMusicGenSetup } from '~/cli/commands/process-steps/step-7-music/music-services/minimax/minimax-music-gen'
import { runElevenLabsMusicGen } from './music-services/elevenlabs/run-elevenlabs-music-gen'
import { runMinimaxMusicGen } from './music-services/minimax/run-minimax-music-gen'

type MusicGenOptions = Pick<
  ProcessingOptions,
  'elevenlabsMusicModel' | 'minimaxMusicModel' | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>

const resolveMusicProvider = (options: MusicGenOptions): MusicProvider => {
  const hasElevenlabs = typeof options.elevenlabsMusicModel === 'string' && options.elevenlabsMusicModel.length > 0
  const hasMinimax = typeof options.minimaxMusicModel === 'string' && options.minimaxMusicModel.length > 0

  const providerCount = [hasElevenlabs, hasMinimax].filter(Boolean).length
  if (providerCount > 1) {
    throw new Error('Cannot use more than one music provider at the same time (--elevenlabs-music, --minimax-music)')
  }
  if (providerCount === 0) {
    throw new Error('Specify a music generation provider: --elevenlabs-music <model> or --minimax-music <model>')
  }

  if (hasElevenlabs) return 'elevenlabs'
  return 'minimax'
}

export const runMusicGen = async (
  prompt: string,
  outputDir: string,
  options: MusicGenOptions
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {

  const provider = resolveMusicProvider(options)

  if (provider === 'elevenlabs') {
    const model: ElevenlabsMusicModel = validateElevenlabsMusicModel(options.elevenlabsMusicModel as string)
    await ensureElevenLabsMusicGenSetup()
    return await runElevenLabsMusicGen(prompt, outputDir, {
      model,
      durationSeconds: options.musicDuration,
      forceInstrumental: options.musicInstrumental
    })
  }

  if (provider === 'minimax') {
    const model: MinimaxMusicModel = validateMinimaxMusicModel(options.minimaxMusicModel as string)
    await ensureMinimaxMusicGenSetup()
    return await runMinimaxMusicGen(prompt, outputDir, {
      model,
      durationSeconds: options.musicDuration,
      lyricsFile: options.musicLyricsFile,
      forceInstrumental: options.musicInstrumental
    })
  }

  assertNever(provider)
}
