import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { grokSpeechToText } from './cases'

defineSTTServiceTest({
  ...grokSpeechToText,
  models: ['speech-to-text'],
  sttService: 'grok',
})

