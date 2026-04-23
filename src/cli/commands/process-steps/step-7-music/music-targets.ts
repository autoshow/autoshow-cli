import type { ElevenlabsMusicModel, MinimaxMusicModel, MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'
import { validateElevenlabsMusicModel, validateMinimaxMusicModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureElevenLabsMusicGenSetup } from '~/cli/commands/process-steps/step-7-music/music-services/elevenlabs/elevenlabs-music-gen'
import { ensureMinimaxMusicGenSetup } from '~/cli/commands/process-steps/step-7-music/music-services/minimax/minimax-music-gen'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import { runElevenLabsMusicGen } from './music-services/elevenlabs/run-elevenlabs-music-gen'
import { runMinimaxMusicGen } from './music-services/minimax/run-minimax-music-gen'

export const getMusicArtifactFileName = (
  target: Pick<MusicTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: 'generated-music.mp3',
    multiFilePrefix: 'generated-music',
    extension: 'mp3'
  })

export const buildMusicArtifactMap = (metadata: Step7MusicMetadata[]): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey: 'music',
    multiKeyPrefix: 'music',
    getService: (entry) => entry.musicService,
    getModel: (entry) => entry.musicModel,
    getFileName: (entry) => entry.musicFileName
  });

export const collectMusicTargets = (options: MusicGenOptions): MusicTarget[] => {
  const targets: MusicTarget[] = []
  const elevenlabsModels = options.elevenlabsMusicModels ?? (options.elevenlabsMusicModel ? [options.elevenlabsMusicModel] : [])
  const minimaxModels = options.minimaxMusicModels ?? (options.minimaxMusicModel ? [options.minimaxMusicModel] : [])

  for (const rawModel of elevenlabsModels) {
    const model: ElevenlabsMusicModel = validateElevenlabsMusicModel(rawModel)

    targets.push({
      service: 'elevenlabs',
      model,
      run: async (prompt, outputDir) => {
        await ensureElevenLabsMusicGenSetup()
        return await runElevenLabsMusicGen(prompt, outputDir, {
          model,
          durationSeconds: options.musicDuration,
          forceInstrumental: options.musicInstrumental
        })
      }
    })
  }

  for (const rawModel of minimaxModels) {
    const model: MinimaxMusicModel = validateMinimaxMusicModel(rawModel)

    targets.push({
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        await ensureMinimaxMusicGenSetup()
        return await runMinimaxMusicGen(prompt, outputDir, {
          model,
          durationSeconds: options.musicDuration,
          lyricsFile: options.musicLyricsFile,
          forceInstrumental: options.musicInstrumental
        })
      }
    })
  }

  return targets
}
