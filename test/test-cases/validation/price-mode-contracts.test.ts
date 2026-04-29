import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
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
    label: 'deAPI image',
    args: ['image', 'a sunset over a lake', '--deapi-image', 'Flux1schnell', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'BFL image',
    args: ['image', 'a sunset over a lake', '--bfl-image', 'flux-2-pro-preview', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'video',
    args: ['video', 'a sunset over a lake', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price'],
    expected: 'video'
  },
  {
    label: 'deAPI video',
    args: ['video', 'a sunset over a lake', '--deapi-video', 'Ltxv_13B_0_9_8_Distilled_FP8', '--price'],
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
      ['metadata', 'https://example.com/audio.mp3', '--price']
    ]) {
      const result = await runCommand(['src/cli/create-cli.ts', ...args])

      expect(result.exitCode).toBe(2)
      expect(result.outputDir).toBeNull()
      expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: price')
    }
  })

  test('music lyric-video mode rejects --price', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'music',
      '--audio',
      STABLE_LOCAL_AUDIO_PATH,
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(result.outputDir).toBeNull()
    expect(`${result.stdout}\n${result.stderr}`).toContain('Do not combine hosted music flags')
  })

  test('cheapest-model helpers return stable model selections', () => {
    expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.4-nano')
    expect(resolveCheapestModelForFlag('glm')).toBe('glm-5.1')
    expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-1-mini')
    expect(resolveCheapestModelForFlag('bfl-image')).toBe('flux-2-klein-4b')
    expect(resolveCheapestModelForFlag('deapi-image')).toBe('Flux1schnell')
    expect(resolveCheapestModelForFlag('deapi-video')).toBe('Ltxv_13B_0_9_8_Distilled_FP8')
    expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
    expect(resolveCheapestModelForFlag('grok-stt')).toBe('speech-to-text')
    expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
    expect(resolveCheapestModelForFlag('openai-stt')).toBe('gpt-4o-mini-transcribe')
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3-flash-preview')
    expect(resolveCheapestModelForFlag('glm-stt')).toBe('glm-asr-2512')
    expect(selectCheapestVideoSelection('gemini')).toMatchObject({
      provider: 'gemini',
      model: 'veo-3.1-fast-generate-preview'
    })
    expect(selectCheapestVideoSelection('deapi')).toMatchObject({
      provider: 'deapi',
      model: 'Ltxv_13B_0_9_8_Distilled_FP8'
    })
  })

  test('gpt-image-2 image estimates use size and quality', () => {
    expect(estimateImageCosts({
      openaiImageModel: 'gpt-image-2',
      imageSize: '1024x1024',
      imageQuality: 'low'
    })[0]?.costPerImageCents).toBe(0.6)
    expect(estimateImageCosts({
      openaiImageModel: 'gpt-image-2',
      imageSize: '1536x1024',
      imageQuality: 'high'
    })[0]?.costPerImageCents).toBe(16.5)
    expect(estimateImageCosts({
      openaiImageModel: 'gpt-image-2',
      imageSize: 'auto',
      imageQuality: 'auto'
    })[0]?.costPerImageCents).toBe(5.3)
    expect(estimateImageCosts({
      openaiImageModel: 'gpt-image-2',
      imageSize: '2048x2048',
      imageQuality: 'high'
    })[0]?.note).toContain('OpenAI')
  })
})
