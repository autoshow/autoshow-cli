import type { SttTarget } from '~/types'
import { ensureProviderReady } from '~/features/bootstrap-broker'

export {
  downloadWhisperModel
} from './stt-local/whisper/whisper'

const toBootstrapProviderId = (
  target: Pick<SttTarget, 'service' | 'model'>
): string => {
  switch (target.service) {
    case 'whisper':
      return `whisper:${target.model}`
    case 'reverb':
      return 'reverb'
    case 'elevenlabs':
      return 'elevenlabs-stt'
    case 'deepgram':
      return 'deepgram-stt'
    case 'soniox':
      return 'soniox-stt'
    case 'speechmatics':
      return 'speechmatics-stt'
    case 'rev':
      return 'rev-stt'
    case 'groq':
      return 'groq-stt'
    case 'openai':
      return 'openai-stt'
    case 'mistral':
      return 'mistral-stt'
    case 'assemblyai':
      return 'assemblyai-stt'
    case 'gladia':
      return 'gladia-stt'
  }
}

export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> => {
  await ensureProviderReady(toBootstrapProviderId(target))
}
