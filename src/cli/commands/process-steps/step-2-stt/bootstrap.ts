import type { SttTarget } from '~/types'
import { ensureProviderReady } from '~/features/bootstrap-broker'
import { ensureAwsSttSetup } from './stt-services/aws/aws'

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
    case 'gcloud':
      return 'gcloud-stt'
    case 'aws':
      return 'aws-stt'
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
    case 'mistral':
      return 'mistral-stt'
    case 'assemblyai':
      return 'assemblyai-stt'
    case 'gladia':
      return 'gladia-stt'
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
