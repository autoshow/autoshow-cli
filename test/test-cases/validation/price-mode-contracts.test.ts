import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { STABLE_LOCAL_AUDIO_PATH, STABLE_TTS_MD_PATH, runCommand } from '../../test-utils/test-helpers'

const priceCases: Array<{ label: string; args: string[]; expected: string }> = [
  {
    label: 'write',
    args: ['write', STABLE_LOCAL_AUDIO_PATH, '--openai', 'gpt-5.4-nano', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'extract',
    args: ['extract', STABLE_LOCAL_AUDIO_PATH, '--whisper-stt', 'tiny', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'tts',
    args: ['tts', STABLE_TTS_MD_PATH, '--openai-tts', 'gpt-4o-mini-tts', '--price'],
    expected: 'speech'
  },
  {
    label: 'image',
    args: ['image', 'a sunset over a lake', '--openai-image', 'gpt-image-1-mini', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'video',
    args: ['video', 'a sunset over a lake', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price'],
    expected: 'video'
  },
  {
    label: 'music',
    args: ['music', 'an ambient piano song', '--minimax-music', 'music-2.5', '--price'],
    expected: 'music'
  }
]

describe('price mode contracts', () => {
  for (const priceCase of priceCases) {
    test(`${priceCase.label} accepts --price without producing an output directory`, async () => {
      const result = await runCommand(['src/cli/create-cli.ts', ...priceCase.args])

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).toBeNull()
      expect(`${result.stdout}\n${result.stderr}`).toContain(priceCase.expected)
    })
  }

  test('commands without price support reject --price', async () => {
    for (const args of [
      ['metadata', 'https://example.com/audio.mp3', '--price'],
      ['lyrics', '--price']
    ]) {
      const result = await runCommand(['src/cli/create-cli.ts', ...args])

      expect(result.exitCode).toBe(2)
      expect(result.outputDir).toBeNull()
      expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: price')
    }
  })

  test('cheapest-model helpers return stable model selections', () => {
    expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.4-nano')
    expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
    expect(selectCheapestVideoSelection('gemini')).toMatchObject({
      provider: 'gemini',
      model: 'veo-3.1-fast-generate-preview'
    })
  })
})
