import { defineUrlTranscriptServiceTest } from './define-url-transcript-service-test'
import { scrapecreatorsUrlTranscript } from './cases'

const budgetKey = 'transcribe-scrapecreators-youtube-transcript'
void budgetKey

defineUrlTranscriptServiceTest({
  ...scrapecreatorsUrlTranscript,
})
