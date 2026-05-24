import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { glmTranscription } from './cases'

defineSTTServiceTest({
  ...glmTranscription,
  models: ['glm-asr-2512'],
  sttService: 'glm-stt',
})

