import type { SttTarget } from '~/types'
import { ensureProviderReady } from '~/utils/bootstrap-broker'
import { ensureAwsSttSetup } from './stt-services/aws/aws'
import { getStep2BootstrapProviderId } from '../step-2-shared/provider-registry'

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
    case 'gcloud':
    case 'aws':
    case 'deepinfra':
    case 'deapi':
    case 'elevenlabs':
    case 'deepgram':
    case 'soniox':
    case 'speechmatics':
    case 'rev':
    case 'groq':
    case 'grok':
    case 'mistral':
    case 'assemblyai':
    case 'gladia':
    case 'happyscribe':
    case 'supadata':
    case 'openai-stt':
    case 'gemini-stt':
    case 'glm-stt':
    case 'together':
    case 'fireworks':
    case 'cloudflare':
      return getStep2BootstrapProviderId('stt', target.service) ?? ''
    case 'youtube-captions':
      return ''
  }
}

export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model' | 'awsRegion' | 'awsBucket'>
): Promise<void> => {
  if (target.service === 'youtube-captions') {
    return
  }

  if (target.service === 'aws') {
    await ensureAwsSttSetup({
      preferredRegion: target.awsRegion,
      preferredBucket: target.awsBucket
    })
    return
  }

  await ensureProviderReady(toBootstrapProviderId(target))
}
