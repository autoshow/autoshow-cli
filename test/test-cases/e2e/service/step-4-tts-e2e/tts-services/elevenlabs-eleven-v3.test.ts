import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { elevenlabsTts } from './cases'

defineTTSServiceTest({
  ...elevenlabsTts,
  models: ['eleven_v3'],
  ttsService: 'elevenlabs',
})

