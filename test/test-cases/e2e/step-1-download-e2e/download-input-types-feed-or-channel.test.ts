import {
  defineBatchCaseTest,
  setupDownloadInputTypeLifecycle,
  type BatchCase,
} from './download-input-types.shared'

const batchCases: BatchCase[] = [
  {
    name: 'download RSS feed input',
    input: 'https://ajcwebdev.substack.com/feed',
    extraArgs: ['--batch-limit', '1'],
    expectedSourceKind: 'podcast_rss',
  },
  {
    name: 'download YouTube channel input',
    input: 'https://www.youtube.com/@fireship',
    extraArgs: ['--batch-limit', '1'],
    expectedSourceKind: 'youtube_channel',
  },
]

setupDownloadInputTypeLifecycle([])

for (const tc of batchCases) {
  defineBatchCaseTest(tc)
}
