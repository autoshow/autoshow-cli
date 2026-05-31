import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepinfraWhisper } from './cases'

defineSTTServiceTest({
  ...deepinfraWhisper,
  models: ['openai/whisper-large-v3'],
  sttService: 'deepinfra',
})

