import { expect } from 'bun:test'
import { fileExists } from '../../../test-utils/test-helpers'
import {
  defineBatchCaseTest,
  defineSingleCaseTest,
  setupDownloadInputTypeLifecycle,
  type BatchCase,
  type SingleCase,
} from './download-input-types.shared'

const singleCases: SingleCase[] = [
  {
    name: 'download YouTube video URL input',
    input: 'https://www.youtube.com/watch?v=u1-WHqATSQU',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.videoTitle).toBeDefined()
      expect(metadata.step1?.channelTitle).toBeDefined()
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      expect(await fileExists(audioPath)).toBe(true)
    },
  },
  {
    name: 'download Twitch video URL input',
    input: 'https://www.twitch.tv/videos/1844440442',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      expect(await fileExists(audioPath)).toBe(true)
    },
  },
]

const batchCases: BatchCase[] = [
  {
    name: 'download URL list of streaming URLs input',
    input: 'input/2-urls.md',
    extraArgs: ['--batch-limit', '1'],
    expectedSourceKind: 'url_list',
    expectedSelectedCount: 1,
  },
]

setupDownloadInputTypeLifecycle([])

for (const tc of singleCases) {
  defineSingleCaseTest(tc)
}

for (const tc of batchCases) {
  defineBatchCaseTest(tc)
}
