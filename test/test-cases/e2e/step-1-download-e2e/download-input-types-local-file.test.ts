import { expect } from 'bun:test'
import { fileExists } from '../../../test-utils/test-helpers'
import { defineSingleCaseTest, setupDownloadInputTypeLifecycle, type SingleCase } from './download-input-types.shared'

const singleCases: SingleCase[] = [
  {
    name: 'download local audio input',
    input: 'input/examples/audio/1-audio.mp3',
    suffix: '1-audio',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.slug).toBe('1-audio')
      expect(metadata.step1?.audioFileName?.endsWith('.mp3')).toBe(true)
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      expect(await fileExists(audioPath)).toBe(true)
    },
  },
  {
    name: 'download local document input',
    input: 'input/examples/document/1-document.pdf',
    suffix: '1-document',
    checks: async metadata => {
      expect(metadata.step1?.format).toBe('pdf')
      expect((metadata.step1?.pageCount ?? 0) > 0).toBe(true)
      expect((metadata.step1?.fileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.slug).toBe('1-document')
    },
  },
]

setupDownloadInputTypeLifecycle(['1-audio', '1-document'])

for (const tc of singleCases) {
  defineSingleCaseTest(tc)
}
