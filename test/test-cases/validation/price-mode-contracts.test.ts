import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { STABLE_LOCAL_AUDIO_PATH, STABLE_TTS_MD_PATH, runCommand } from '../../test-utils/test-helpers'

const priceCases: Array<{ label: string; args: string[]; expected: string }> = [
  {
    label: 'write',
    args: ['write', STABLE_LOCAL_AUDIO_PATH, '--openai', 'gpt-5.4-nano', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'Kimi write',
    args: ['write', STABLE_LOCAL_AUDIO_PATH, '--kimi', 'kimi-k2.6', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'extract',
    args: ['extract', STABLE_LOCAL_AUDIO_PATH, '--whisper-stt', 'tiny', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'Kimi OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--kimi-ocr', 'kimi-k2.6', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'tts',
    args: ['tts', STABLE_TTS_MD_PATH, '--openai-tts', 'gpt-4o-mini-tts', '--price'],
    expected: 'speech'
  },
  {
    label: 'Runway TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--runway-tts', 'eleven_multilingual_v2', '--price'],
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
  },
  {
    label: 'Gemini music',
    args: ['music', 'an ambient piano song', '--gemini-music', 'lyria-3-clip-preview', '--price'],
    expected: 'gemini'
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
    expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
    expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-1-mini')
    expect(resolveCheapestModelForFlag('bfl-image')).toBe('flux-2-klein-4b')
    expect(resolveCheapestModelForFlag('deapi-image')).toBe('Flux1schnell')
    expect(resolveCheapestModelForFlag('deapi-video')).toBe('Ltxv_13B_0_9_8_Distilled_FP8')
    expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3-clip-preview')
    expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
    expect(resolveCheapestModelForFlag('grok-stt')).toBe('speech-to-text')
    expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
    expect(resolveCheapestModelForFlag('runway-tts')).toBe('eleven_multilingual_v2')
    expect(resolveCheapestModelForFlag('openai-stt')).toBe('gpt-4o-mini-transcribe')
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3-flash-preview')
    expect(resolveCheapestModelForFlag('glm-stt')).toBe('glm-asr-2512')
    expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('allenai/olmOCR-2-7B-1025')
    expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
    expect(resolveCheapestModelForFlag('gemini-video')).toBe('veo-3.1-lite-generate-preview')
    expect(selectCheapestVideoSelection('gemini')).toMatchObject({
      provider: 'gemini',
      model: 'veo-3.1-lite-generate-preview'
    })
    expect(selectCheapestVideoSelection('deapi')).toMatchObject({
      provider: 'deapi',
      model: 'Ltxv_13B_0_9_8_Distilled_FP8'
    })
  })

  test('Runway TTS estimates use 50-character block billing', () => {
    const opts = {
      runwayTtsModels: ['eleven_multilingual_v2'],
      runwayTtsModel: 'eleven_multilingual_v2'
    } as Parameters<typeof estimateTtsCosts>[0]

    expect(estimateTtsCosts(opts, 1)[0]?.totalCost).toBe(1)
    expect(estimateTtsCosts(opts, 50)[0]?.totalCost).toBe(1)
    expect(estimateTtsCosts(opts, 51)[0]?.totalCost).toBe(2)
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

  test('Gemini music estimates use per-song Lyria 3 pricing', () => {
    const estimates = estimateMusicCosts({
      geminiMusicModels: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
      musicDuration: 90
    })

    expect(estimates.map((estimate) => ({
      provider: estimate.provider,
      model: estimate.model,
      totalCost: estimate.totalCost
    }))).toEqual([
      { provider: 'gemini', model: 'lyria-3-clip-preview', totalCost: 4 },
      { provider: 'gemini', model: 'lyria-3-pro-preview', totalCost: 8 }
    ])
  })

  test('Gemini music timing estimates use Lyria defaults', () => {
    const timing = computeEstimatedProcessingTimes({
      musicTargets: [
        { service: 'gemini', model: 'lyria-3-clip-preview' },
        { service: 'gemini', model: 'lyria-3-pro-preview' }
      ]
    })

    expect(timing.steps.map((step) => ({
      model: step.model,
      processingTimeMs: step.processingTimeMs,
      inputValue: step.inputValue
    }))).toEqual([
      { model: 'lyria-3-clip-preview', processingTimeMs: 30_000, inputValue: 30 },
      { model: 'lyria-3-pro-preview', processingTimeMs: 180_000, inputValue: 120 }
    ])
  })

  test('DeepInfra OCR estimates include token cost and page timing', () => {
    const extractTargets = [{
      provider: 'deepinfra' as const,
      model: 'allenai/olmOCR-2-7B-1025',
      pageCount: 2,
      promptTokens: 8000,
      completionTokens: 2000,
      estimateType: 'heuristic' as const
    }]
    const cost = computeEstimatedCosts({ extractTargets })
    const timing = computeEstimatedProcessingTimes({
      extractTargets: extractTargets.map(({ provider, model, pageCount }) => ({ provider, model, pageCount }))
    })

    expect(cost.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'deepinfra',
      model: 'allenai/olmOCR-2-7B-1025',
      promptTokens: 8000,
      completionTokens: 2000,
      pageCount: 2
    })
    expect(cost.totalCost).toBeGreaterThan(0)
    expect(timing.steps[0]).toMatchObject({
      provider: 'deepinfra',
      model: 'allenai/olmOCR-2-7B-1025',
      processingTimeMs: 12_000
    })
  })

  test('Kimi OCR estimates include token cost and page timing', () => {
    const extractTargets = [{
      provider: 'kimi' as const,
      model: 'kimi-k2.6',
      pageCount: 2,
      promptTokens: 8000,
      completionTokens: 2000,
      estimateType: 'heuristic' as const
    }]
    const cost = computeEstimatedCosts({ extractTargets })
    const timing = computeEstimatedProcessingTimes({
      extractTargets: extractTargets.map(({ provider, model, pageCount }) => ({ provider, model, pageCount }))
    })

    expect(cost.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'kimi',
      model: 'kimi-k2.6',
      promptTokens: 8000,
      completionTokens: 2000,
      pageCount: 2
    })
    expect(cost.totalCost).toBeGreaterThan(0)
    expect(timing.steps[0]).toMatchObject({
      provider: 'kimi',
      model: 'kimi-k2.6',
      processingTimeMs: 12_000
    })
  })
})
