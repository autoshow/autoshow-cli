import type { KittenTtsModel, TtsOptions, TtsTarget } from '~/types'
import {
  validateKittenTtsModel,
  validateKittenTtsSpeaker
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { pathExists, kittenTtsUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { ensureKittenTtsSetup } from '../../tts-local/kitten/kitten-tts'
import { runKittenTts } from '../../tts-local/kitten/run-kitten-tts'
import type { TtsTargetSelection } from '../selection'
import * as l from '~/utils/logger'

const KITTEN_PYTHON_VERSION = '3.12'

export const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

const checkKittenTtsSetup = async (): Promise<boolean> => {
  if (!await pathExists(kittenTtsUvEnvDir)) {
    return false
  }
  if (!await pathExists(`${kittenTtsUvEnvDir}/bin/python`)) {
    return false
  }
  const required = [
    `${kittenTtsUvEnvDir}/lib/python${KITTEN_PYTHON_VERSION}/site-packages/kittentts`,
    `${kittenTtsUvEnvDir}/lib/python${KITTEN_PYTHON_VERSION}/site-packages/soundfile.py`
  ]
  for (const path of required) {
    if (!await pathExists(path)) {
      return false
    }
  }
  return true
}

const ensureKittenSetup = async (): Promise<void> => {
  l.write('info', 'Checking Kitten TTS setup')
  const isSetup = await checkKittenTtsSetup()
  if (!isSetup) {
    l.write('info', 'Kitten TTS not set up; running setup')
    await ensureKittenTtsSetup()
  } else {
    l.write('success', 'Kitten TTS setup verified')
  }
}

export const collectKittenTtsTargets = (
  options: TtsOptions,
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.kittenModels) {
    const model: KittenTtsModel = validateKittenTtsModel(rawModel)
    const rawSpeaker = options.ttsSpeaker ?? DEFAULT_KITTEN_TTS_SPEAKER
    const speaker = validateKittenTtsSpeaker(rawSpeaker)

    targets.push({
      service: 'kitten',
      model,
      voice: speaker,
      run: async (text, outputDir) => {
        await ensureKittenSetup()
        return await runKittenTts(text, outputDir, { model, speaker })
      }
    })
  }
  return targets
}
