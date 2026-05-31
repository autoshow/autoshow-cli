import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { groqWhisper } from './cases'

defineSTTServiceTest({
  ...groqWhisper,
  models: ['whisper-large-v3-turbo'],
  sttService: 'groq',
})

