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
    name: 'download direct audio URL input',
    input: 'https://ajc.pics/autoshow/1-audio.mp3',
    suffix: '1-audio',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.audioFileName?.endsWith('.mp3')).toBe(true)
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      expect(await fileExists(audioPath)).toBe(true)
    },
  },
  {
    name: 'download direct video URL input',
    input: 'https://ajc.pics/autoshow/2-video.mp4',
    suffix: '2-video',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.audioFileName?.endsWith('.wav')).toBe(false)
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      expect(await fileExists(audioPath)).toBe(true)
    },
  },
]

const batchCases: BatchCase[] = [
  {
    name: 'download URL list of direct URLs input',
    input: 'input/examples/batch/2-direct-urls.md',
    extraArgs: ['--batch-limit', '1'],
    expectedSourceKind: 'url_list',
    expectedSelectedCount: 1,
  },
]

setupDownloadInputTypeLifecycle(['1-audio', '2-video'])

for (const tc of singleCases) {
  defineSingleCaseTest(tc)
}

for (const tc of batchCases) {
  defineBatchCaseTest(tc)
}
