import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import {
  ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
  ELEVENLABS_TTS_PVC_MULTILINGUAL_SETUP_MS
} from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-pvc'
import { buildOcrCostDiagnostics, resolveExtractEstimatedCosts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { resolveDeapiTtsPrice } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/deapi-tts-pricing'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { STABLE_LOCAL_AUDIO_PATH, STABLE_TTS_MD_PATH, runCommand } from '../../test-utils/test-helpers'
import type { ExtractionMetadata } from '~/types'

const priceCases: Array<{ label: string; args: string[]; expected: string; env?: Record<string, string | undefined> }> = [
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
    label: 'Speechify TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--speechify-tts', 'simba-english', '--price'],
    expected: 'speech'
  },
  {
    label: 'Speechify custom voice TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--speechify-tts', 'simba-english', '--speechify-tts-ref-audio', 'input/voices/my-voice-sample.mp3', '--speechify-tts-consent-name', 'Anthony Example', '--speechify-tts-consent-email', 'anthony@example.com', '--price'],
    expected: 'speech'
  },
  {
    label: 'Google Cloud TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--gcloud-tts', 'standard', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--mistral-tts', 'voxtral-mini-tts-2603', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral dialogue TTS',
    args: ['tts', 'input/examples/tts/tts-dialogue.txt', '--mistral-tts', 'voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker-ref-audio', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker-ref-audio', 'Guest=input/examples/audio/1-audio.mp3', '--price'],
    expected: 'dialogue-normalized.txt'
  },
  {
    label: 'MiniMax voice clone TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--minimax-tts', 'speech-2.8-turbo', '--minimax-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
    expected: 'speech',
    env: { MINIMAX_API_KEY: '', MINIMAX_BASE_URL: '' }
  },
  {
    label: 'OpenAI custom voice TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--openai-tts', 'gpt-4o-mini-tts', '--openai-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--openai-tts-consent-id', 'cons_123', '--price'],
    expected: 'speech',
    env: { OPENAI_API_KEY: '', OPENAI_BASE_URL: '' }
  },
  {
    label: 'ElevenLabs IVC TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--elevenlabs-tts', 'eleven_flash_v2_5', '--elevenlabs-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
    expected: 'speech',
    env: { ELEVENLABS_API_KEY: '', ELEVENLABS_BASE_URL: '' }
  },
  {
    label: 'ElevenLabs PVC setup TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--elevenlabs-tts', 'eleven_flash_v2_5', '--elevenlabs-tts-pvc-sample', 'input/examples/audio/anthony-voice.mp3', '--price'],
    expected: 'elevenlabs-pvc-status.json',
    env: { ELEVENLABS_API_KEY: '', ELEVENLABS_BASE_URL: '' }
  },
  {
    label: 'deAPI voice clone TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--deapi-tts', 'Qwen3_TTS_12Hz_1_7B_Base', '--deapi-tts-ref-audio', 'input/examples/audio/0-audio-short.mp3', '--price'],
    expected: 'speech',
    env: { DEAPI_API_KEY: '', DEAPI_BASE_URL: '' }
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
      const result = await runCommand(['src/cli/create-cli.ts', ...priceCase.args], {
        ...(priceCase.env ? { env: priceCase.env } : {})
      })

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
    expect(resolveCheapestModelForFlag('mistral-tts')).toBe('voxtral-mini-tts-2603')
    expect(resolveCheapestModelForFlag('runway-tts')).toBe('eleven_multilingual_v2')
    expect(resolveCheapestModelForFlag('speechify-tts')).toBe('simba-english')
    expect(resolveCheapestModelForFlag('gcloud-tts')).toBe('standard')
    expect(resolveCheapestModelForFlag('openai-stt')).toBe('gpt-4o-mini-transcribe')
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3-flash-preview')
    expect(resolveCheapestModelForFlag('glm-stt')).toBe('glm-asr-2512')
    expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('PaddlePaddle/PaddleOCR-VL-0.9B')
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

  test('Mistral TTS estimates use published output-character pricing and provisional speed', () => {
    const opts = {
      mistralTtsModels: ['voxtral-mini-tts-2603'],
      mistralTtsModel: 'voxtral-mini-tts-2603'
    } as Parameters<typeof estimateTtsCosts>[0]

    const cost = estimateTtsCosts(opts, 1000)[0]
    expect(cost?.inputCostPer1MCharactersCents).toBe(0)
    expect(cost?.outputCostPer1MCharactersCents).toBe(1600)
    expect(cost?.totalCost).toBe(1.6)

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [{ service: 'mistral', model: 'voxtral-mini-tts-2603' }],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.find((step) => step.provider === 'mistral')?.processingTimeMs).toBe(9000)
  })

  test('Speechify and Google Cloud TTS estimates use registry pricing and timing defaults', () => {
    const costs = [
      ...estimateTtsCosts({
        speechifyTtsModels: ['simba-english'],
        gcloudTtsModels: ['standard', 'chirp3-hd']
      } as Parameters<typeof estimateTtsCosts>[0], 1000),
      ...estimateTtsCosts({
        speechifyTtsModels: ['simba-multilingual'],
        speechifyTtsRefAudio: 'input/voices/my-voice-sample.mp3',
        speechifyTtsConsentName: 'Anthony Example',
        speechifyTtsConsentEmail: 'anthony@example.com'
      } as Parameters<typeof estimateTtsCosts>[0], 1000),
      ...estimateTtsCosts({
        gcloudTtsModels: ['instant-custom-voice'],
        gcloudTtsVoiceCloningKey: 'existing-key'
      } as Parameters<typeof estimateTtsCosts>[0], 1000)
    ]

    expect(costs.map((cost) => ({
      provider: cost.provider,
      model: cost.model,
      costPer1kCharactersCents: cost.costPer1kCharactersCents,
      setupCostCents: cost.setupCostCents,
      setupTimeMs: cost.setupTimeMs,
      totalCost: cost.totalCost
    }))).toEqual([
      { provider: 'speechify', model: 'simba-english', costPer1kCharactersCents: 1, setupCostCents: undefined, setupTimeMs: undefined, totalCost: 1 },
      { provider: 'gcloud', model: 'standard', costPer1kCharactersCents: 0.4, setupCostCents: undefined, setupTimeMs: undefined, totalCost: 0.4 },
      { provider: 'gcloud', model: 'chirp3-hd', costPer1kCharactersCents: 3, setupCostCents: undefined, setupTimeMs: undefined, totalCost: 3 },
      { provider: 'speechify', model: 'simba-multilingual', costPer1kCharactersCents: 1, setupCostCents: 0, setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS, totalCost: 1 },
      { provider: 'gcloud', model: 'instant-custom-voice', costPer1kCharactersCents: 6, setupCostCents: undefined, setupTimeMs: undefined, totalCost: 6 }
    ])

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [
        { service: 'speechify', model: 'simba-english' },
        { service: 'gcloud', model: 'standard' }
      ],
      ttsCharacterCount: 1000
    })

    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { provider: 'speechify', model: 'simba-english', processingTimeMs: 3_000 },
      { provider: 'gcloud', model: 'standard', processingTimeMs: 6_000 }
    ])
  })

  test('ElevenLabs TTS estimates use current API rates and IVC setup timing', () => {
    const baseCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3']
    } as Parameters<typeof estimateTtsCosts>[0], 1000)

    expect(baseCosts.map((cost) => ({
      model: cost.model,
      costPer1kCharactersCents: cost.costPer1kCharactersCents,
      totalCost: cost.totalCost
    }))).toEqual([
      { model: 'eleven_flash_v2_5', costPer1kCharactersCents: 5, totalCost: 5 },
      { model: 'eleven_turbo_v2_5', costPer1kCharactersCents: 5, totalCost: 5 },
      { model: 'eleven_v3', costPer1kCharactersCents: 10, totalCost: 10 }
    ])

    const cloneCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_flash_v2_5', 'eleven_v3'],
      elevenlabsTtsRefAudio: 'input/examples/audio/anthony-voice.mp3'
    } as Parameters<typeof estimateTtsCosts>[0], 1000)
    expect(cloneCosts.map((cost) => ({
      model: cost.model,
      setupCostCents: cost.setupCostCents,
      setupTimeMs: cost.setupTimeMs,
      setupNote: cost.setupNote,
      totalCost: cost.totalCost
    }))).toEqual([
      {
        model: 'eleven_flash_v2_5',
        setupCostCents: 0,
        setupTimeMs: 10_000,
        setupNote: 'ElevenLabs instant voice clone setup',
        totalCost: 5
      },
      {
        model: 'eleven_v3',
        setupCostCents: undefined,
        setupTimeMs: undefined,
        setupNote: undefined,
        totalCost: 10
      }
    ])

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [
        { service: 'elevenlabs', model: 'eleven_flash_v2_5', setupTimeMs: 10_000 },
        { service: 'elevenlabs', model: 'eleven_v3' }
      ],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { provider: 'elevenlabs', model: 'eleven_flash_v2_5', processingTimeMs: 20_240 },
      { provider: 'elevenlabs', model: 'eleven_v3', processingTimeMs: 31_952 }
    ])

    const pvcReadyCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_flash_v2_5'],
      elevenlabsTtsPvcVoice: 'pvc_voice_123'
    } as Parameters<typeof estimateTtsCosts>[0], 1000)
    expect(pvcReadyCosts[0]).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      totalCost: 5
    })
    expect(pvcReadyCosts[0]?.setupCostCents).toBeUndefined()

    const pvcEnglishSetupCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_flash_v2_5'],
      elevenlabsTtsPvcSamples: ['input/examples/audio/anthony-voice.mp3'],
      elevenlabsTtsPvcLanguage: 'en',
      elevenlabsTtsPvcWait: true
    } as Parameters<typeof estimateTtsCosts>[0], 1000)
    expect(pvcEnglishSetupCosts[0]).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      setupCostCents: 0,
      setupTimeMs: ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
      setupNote: 'ElevenLabs professional voice clone training',
      totalCost: 5
    })

    const pvcMultilingualSetupCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_flash_v2_5'],
      elevenlabsTtsPvcSamples: ['input/examples/audio/anthony-voice.mp3'],
      elevenlabsTtsPvcLanguage: 'es',
      elevenlabsTtsPvcWait: true
    } as Parameters<typeof estimateTtsCosts>[0], 1000)
    expect(pvcMultilingualSetupCosts[0]?.setupTimeMs).toBe(ELEVENLABS_TTS_PVC_MULTILINGUAL_SETUP_MS)
  })

  test('MiniMax voice clone TTS estimates include one-time clone fee and setup timing', () => {
    const opts = {
      minimaxTtsModels: ['speech-2.8-turbo', 'speech-2.8-hd'],
      minimaxTtsRefAudio: 'input/examples/audio/anthony-voice.mp3'
    } as Parameters<typeof estimateTtsCosts>[0]

    const costs = estimateTtsCosts(opts, 1000)
    expect(costs.map((cost) => ({
      model: cost.model,
      setupCostCents: cost.setupCostCents,
      totalCost: cost.totalCost
    }))).toEqual([
      { model: 'speech-2.8-turbo', setupCostCents: 150, totalCost: 156 },
      { model: 'speech-2.8-hd', setupCostCents: undefined, totalCost: 10 }
    ])
    expect(estimateTtsCosts({
      minimaxTtsModels: ['speech-2.8-turbo'],
      minimaxTtsRefAudio: 'input/examples/audio/anthony-voice.mp3'
    } as Parameters<typeof estimateTtsCosts>[0], 10_000)[0]?.totalCost).toBe(210)

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [
        { service: 'minimax', model: 'speech-2.8-turbo', setupTimeMs: 15_000 },
        { service: 'minimax', model: 'speech-2.8-hd' }
      ],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.map((step) => ({
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { model: 'speech-2.8-turbo', processingTimeMs: 133_008 },
      { model: 'speech-2.8-hd', processingTimeMs: 94_592 }
    ])
  })

  test('OpenAI custom voice TTS estimates include zero-cost setup and setup timing', () => {
    const opts = {
      openaiTtsModels: ['gpt-4o-mini-tts'],
      openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
      openaiTtsConsentId: 'cons_123'
    } as Parameters<typeof estimateTtsCosts>[0]

    const cost = estimateTtsCosts(opts, 1000)[0]
    expect(cost).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini-tts',
      setupCostCents: 0,
      setupTimeMs: 15_000,
      setupNote: 'OpenAI custom voice creation setup',
      totalCost: 1.26
    })

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [{ service: 'openai', model: 'gpt-4o-mini-tts', setupTimeMs: 15_000 }],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { provider: 'openai', model: 'gpt-4o-mini-tts', processingTimeMs: 34_655 }
    ])
  })

  test('deAPI voice clone TTS falls back to registry pricing without an API key', async () => {
    const previousKey = process.env['DEAPI_API_KEY']
    const previousBaseUrl = process.env['DEAPI_BASE_URL']
    delete process.env['DEAPI_API_KEY']
    delete process.env['DEAPI_BASE_URL']

    try {
      const price = await resolveDeapiTtsPrice({
        model: 'Qwen3_TTS_12Hz_1_7B_Base',
        characterCount: 1000,
        mode: 'voice_clone'
      })

      expect(price).toMatchObject({
        source: 'registry_fallback',
        estimateType: 'heuristic',
        totalCost: 0.077
      })
    } finally {
      if (previousKey === undefined) delete process.env['DEAPI_API_KEY']
      else process.env['DEAPI_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['DEAPI_BASE_URL']
      else process.env['DEAPI_BASE_URL'] = previousBaseUrl
    }
  })

  test('deAPI voice clone TTS price request sends voice_clone without voice', async () => {
    const previousKey = process.env['DEAPI_API_KEY']
    const previousBaseUrl = process.env['DEAPI_BASE_URL']
    const previousFetch = globalThis.fetch
    const bodies: unknown[] = []
    const urls: string[] = []

    try {
      process.env['DEAPI_API_KEY'] = 'test-key'
      process.env['DEAPI_BASE_URL'] = 'https://mock.deapi.local'
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        urls.push(String(input))
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as unknown)
        return new Response(JSON.stringify({ data: { price: 0.00123 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }) as typeof fetch

      const price = await resolveDeapiTtsPrice({
        model: 'Qwen3_TTS_12Hz_1_7B_Base',
        characterCount: 5000,
        mode: 'voice_clone'
      })

      expect(price).toMatchObject({
        source: 'provider_quote',
        estimateType: 'exact',
        totalCost: 0.123
      })
      expect(urls).toEqual(['https://mock.deapi.local/api/v2/audio/speech/price'])
      expect(bodies).toEqual([{
        model: 'Qwen3_TTS_12Hz_1_7B_Base',
        mode: 'voice_clone',
        count_text: 5000,
        lang: 'English',
        speed: 1,
        format: 'mp3',
        sample_rate: 24000
      }])
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['DEAPI_API_KEY']
      else process.env['DEAPI_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['DEAPI_BASE_URL']
      else process.env['DEAPI_BASE_URL'] = previousBaseUrl
    }
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

  test('gpt-image-2 actual fallback cost preserves OpenAI image options', () => {
    const cost = computeActualCosts({
      step5: {
        imageService: 'openai',
        imageModel: 'gpt-image-2',
        processingTime: 10_000,
        imageFileNames: ['generated-image.png'],
        imageCount: 1,
        imageFileSize: 1234,
        imageWidth: 1024,
        imageHeight: 1024,
        imageSize: '1024x1024',
        imageQuality: 'low',
        imageFormat: 'png'
      }
    })

    expect(cost.steps[0]).toMatchObject({
      step: 'image',
      provider: 'openai',
      model: 'gpt-image-2',
      cost: 0.6
    })
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
      { model: 'lyria-3-clip-preview', processingTimeMs: 23_220, inputValue: 30 },
      { model: 'lyria-3-pro-preview', processingTimeMs: 128_760, inputValue: 120 }
    ])
  })

  test('MiniMax music timing estimates use the provider default duration', () => {
    const timing = computeEstimatedProcessingTimes({
      musicTargets: [
        { service: 'minimax', model: 'music-2.5' },
        { service: 'minimax', model: 'music-2.5', durationSeconds: 15 }
      ]
    })

    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs,
      inputValue: step.inputValue
    }))).toEqual([
      { provider: 'minimax', model: 'music-2.5', processingTimeMs: 241_800, inputValue: 120 },
      { provider: 'minimax', model: 'music-2.5', processingTimeMs: 241_800, inputValue: 120 }
    ])
  })

  test('post-run exact LLM estimates can bypass calibration multipliers', () => {
    const cost = computeEstimatedCosts({
      applyCostMultipliers: false,
      llmTargets: [{
        service: 'openai',
        model: 'gpt-5.4',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      }]
    })

    expect(cost.steps[0]).toMatchObject({
      step: 'llm',
      provider: 'openai',
      model: 'gpt-5.4',
      costMultiplier: 1,
      cost: 1750
    })
    expect(cost.totalCost).toBe(1750)
  })

  test('DeepInfra OCR estimates include token cost and page timing', () => {
    const extractTargets = [{
      provider: 'deepinfra' as const,
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
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
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      promptTokens: 8000,
      completionTokens: 2000,
      pageCount: 2
    })
    expect(cost.totalCost).toBeGreaterThan(0)
    expect(timing.steps[0]).toMatchObject({
      provider: 'deepinfra',
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      processingTimeMs: 28_856
    })

    const actualMetadata: ExtractionMetadata = {
      extractionMethod: 'pdf+deepinfra-ocr',
      totalPages: 2,
      ocrPages: 2,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10_000,
      ocrService: 'deepinfra',
      ocrModel: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      promptTokens: 8000,
      completionTokens: 2000
    }
    const actual = computeActualCosts({ step2: actualMetadata })
    const actualTiming = computeActualProcessingTimes({ step2: actualMetadata })

    expect(actual.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'deepinfra',
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      promptTokens: 8000,
      completionTokens: 2000
    })
    expect(actual.totalCost).toBeGreaterThan(0)
    expect(actualTiming.steps[0]).toMatchObject({
      provider: 'deepinfra',
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      processingTimeMs: 1234
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
      processingTimeMs: 28_600
    })
  })

  test('hosted token OCR estimates include output tokens when usage is not exact', () => {
    const cost = computeEstimatedCosts({
      applyCostMultipliers: false,
      extractTargets: [{
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pageCount: 2,
        estimateType: 'heuristic'
      }]
    })
    const step = cost.steps[0]

    expect(step).toMatchObject({
      step: 'extract',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      pageCount: 2,
      promptTokens: 6152,
      completionTokens: 579,
      estimateType: 'heuristic'
    })
    expect(cost.totalCost).toBe(
      ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
      + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
    )
  })

  test('OCR diagnostics compare page-based estimates with actual token usage', () => {
    const estimated = computeEstimatedCosts({
      applyCostMultipliers: false,
      extractTargets: [{
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pageCount: 2,
        estimateType: 'heuristic'
      }]
    })
    const actualMetadata: ExtractionMetadata = {
      extractionMethod: 'pdf+openai-ocr',
      totalPages: 2,
      ocrPages: 2,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10_000,
      ocrService: 'openai',
      ocrModel: 'gpt-5.4-nano',
      promptTokens: 6000,
      completionTokens: 1500,
      ocrProviderUsage: [{
        unit: 'document',
        pages: 2,
        promptTokens: 6000,
        completionTokens: 1500
      }]
    }
    const actual = computeActualCosts({ step2: actualMetadata })
    const diagnostics = buildOcrCostDiagnostics(actualMetadata, estimated, actual)
    const diagnostic = diagnostics[0] as Record<string, unknown>
    const predicted = diagnostic['predictedCostInputs'] as Record<string, unknown>
    const actualInputs = diagnostic['actualCostInputs'] as Record<string, unknown>
    const delta = diagnostic['delta'] as Record<string, unknown>

    expect(diagnostics).toHaveLength(1)
    expect(diagnostic).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      pages: 2
    })
    expect(predicted).toMatchObject({
      pageCount: 2,
      promptTokens: 6152,
      completionTokens: 579,
      estimateType: 'heuristic'
    })
    expect(actualInputs).toMatchObject({
      pageCount: 2,
      inputMetric: 'tokens',
      inputValue: 7500,
      promptTokens: 6000,
      completionTokens: 1500
    })
    expect(actualInputs['usageDetails']).toEqual(actualMetadata.ocrProviderUsage)
    expect(delta['costCents']).toBe((actual.steps[0]?.cost ?? 0) - (estimated.steps[0]?.cost ?? 0))
  })

  test('OCR manifest estimates preserve preflight values and fallback avoids actual usage tokens', () => {
    const actualMetadata: ExtractionMetadata = {
      extractionMethod: 'pdf+openai-ocr',
      totalPages: 2,
      ocrPages: 2,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10_000,
      ocrService: 'openai',
      ocrModel: 'gpt-5.4-nano',
      promptTokens: 1,
      completionTokens: 1
    }
    const preflightEstimated = resolveExtractEstimatedCosts({
      totalEstimatedCost: 9,
      steps: [{
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pageCount: 2,
        promptTokens: 8000,
        completionTokens: 2000,
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125,
        totalCost: 9,
        estimateType: 'heuristic'
      }]
    }, actualMetadata)
    const fallbackEstimated = resolveExtractEstimatedCosts(undefined, actualMetadata)

    expect(preflightEstimated.totalCost).toBe(9)
    expect(preflightEstimated.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      promptTokens: 8000,
      completionTokens: 2000,
      cost: 9
    })
    expect(fallbackEstimated.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      promptTokens: 6152,
      completionTokens: 579
    })
  })
})
