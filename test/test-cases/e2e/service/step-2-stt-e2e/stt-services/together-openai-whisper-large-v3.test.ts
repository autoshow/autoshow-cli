import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { togetherWhisperLargeV3 } from './cases'

defineSTTServiceTest({
  ...togetherWhisperLargeV3,
  models: ['openai/whisper-large-v3'],
  sttService: 'together',
})

