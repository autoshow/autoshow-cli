import { defineUrlTranscriptServiceTest } from './define-url-transcript-service-test'
import { supadataUrlTranscript } from './cases'

const budgetKey = 'transcribe-supadata-auto'
void budgetKey

defineUrlTranscriptServiceTest({
  ...supadataUrlTranscript,
})
