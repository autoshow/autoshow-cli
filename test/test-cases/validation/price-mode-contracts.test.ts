import { describe, expect, test } from 'bun:test'
import {
  resolveCheapestModelForFlag,
  selectCheapestVideoSelection
} from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { estimateOcrTokenUsage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { buildOcrCostDiagnostics, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts, resolveExtractionProviderModel } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { buildStep3Metadata, runWithLLMInstrumentation } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { getExtractEstimation, getMusicEstimation, getTtsEstimation, getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildAggregateTiming } from '~/utils/pricing/aggregate-pricing/timing'
import { computeSttCost } from '~/utils/pricing/cost-helpers'
import { STABLE_EXAMPLE_AUDIO_URL, STABLE_TTS_MD_PATH, runCommand } from '../../test-utils/test-helpers'
import type { ExtractionMetadata, Step1Metadata, Step2Metadata, StepEstimate } from '~/types'

const priceCases: Array<{ label: string; args: string[]; expected: string | string[]; env?: Record<string, string | undefined> }> = [
  {
    label: 'write',
    args: ['write', STABLE_EXAMPLE_AUDIO_URL, '--llm', 'openai=gpt-5.4-nano', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'Kimi write',
    args: ['write', STABLE_EXAMPLE_AUDIO_URL, '--llm', 'kimi=kimi-k2.6', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'extract',
    args: ['extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'whisper=tiny', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'Kimi OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'kimi=kimi-k2.6', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'Grok OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'grok=grok-4.3', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'OpenAI GPT-5.5 OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-5.5', '--price'],
    expected: ['Total estimated cost', 'gpt-5.5']
  },
  {
    label: 'Anthropic Opus OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-opus-4-7', '--price'],
    expected: ['Total estimated cost', 'claude-opus-4-7']
  },
  {
    label: 'Anthropic Sonnet OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-sonnet-4-6', '--price'],
    expected: ['Total estimated cost', 'claude-sonnet-4-6']
  },
  {
    label: 'all URL article extraction',
    args: ['extract', 'https://example.com/articles/story.html', '--all-providers', '--price'],
    expected: 'providers/<backend>/result.json'
  },
  {
    label: 'GLM Reader URL article extraction',
    args: ['extract', 'https://ajcwebdev.com', '--provider', 'glm-reader', '--price'],
    expected: ['Total estimated cost', 'glm-reader']
  },
  {
    label: 'tts',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'openai=gpt-4o-mini-tts', '--price'],
    expected: 'speech'
  },
  {
    label: 'all TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--all-providers', '--price'],
    expected: 'speech'
  },
  {
    label: 'Speechify TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'speechify=simba-english', '--price'],
    expected: 'speech'
  },
  {
    label: 'Speechify custom voice TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'speechify=simba-english', '--tts-ref-audio', 'input/voices/my-voice-sample.mp3', '--tts-consent-name', 'Anthony Example', '--tts-consent-email', 'anthony@example.com', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'mistral=voxtral-mini-tts-2603', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral dialogue TTS',
    args: ['tts', 'input/examples/tts/tts-dialogue.txt', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker-ref-audio', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker-ref-audio', 'Guest=https://ajc.pics/autoshow/examples/1-audio.mp3', '--price'],
    expected: 'dialogue-normalized.txt'
  },
  {
    label: 'OpenAI custom voice TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'openai=gpt-4o-mini-tts', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--openai-tts-consent-id', 'cons_123', '--price'],
    expected: 'speech',
    env: { OPENAI_API_KEY: '', OPENAI_BASE_URL: '' }
  },
  {
    label: 'ElevenLabs IVC TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'elevenlabs=eleven_v3', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
    expected: 'speech',
    env: { ELEVENLABS_API_KEY: '', ELEVENLABS_BASE_URL: '' }
  },
  {
    label: 'image',
    args: ['image', 'a sunset over a lake', '--provider', 'openai=gpt-image-1.5', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'BFL image',
    args: ['image', 'a sunset over a lake', '--provider', 'bfl=flux-2-pro', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'video',
    args: ['video', 'a sunset over a lake', '--provider', 'gemini=veo-3.1-fast-generate-preview', '--price'],
    expected: 'video'
  },
  {
    label: 'music',
    args: ['music', 'an ambient piano song', '--provider', 'minimax=music-2.6', '--price'],
    expected: 'music'
  },
  {
    label: 'Gemini music',
    args: ['music', 'an ambient piano song', '--provider', 'gemini=lyria-3-clip-preview', '--price'],
    expected: 'gemini'
  }
]

const buildHostedStep1 = (overrides: Partial<Step1Metadata> = {}): Step1Metadata => ({
  title: 'Hosted audio',
  duration: 'Unknown',
  channel: 'Unknown',
  description: '',
  url: 'https://example.com/audio.mp3',
  slug: 'hosted-audio',
  audioFileName: 'audio.mp3',
  audioFileSize: 1234,
  ...overrides
})

const buildSttMetadata = (overrides: Partial<Step2Metadata> = {}): Step2Metadata => ({
  transcriptionService: 'deepgram',
  transcriptionModel: 'nova-3',
  processingTime: 1234,
  tokenCount: 0,
  ...overrides
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const findPricingNoteKeys = (value: unknown): string[] => {
  const keys: string[] = []
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }
    if (!isRecord(entry)) {
      return
    }
    for (const [key, child] of Object.entries(entry)) {
      if (key === 'note' || key === 'notes') {
        keys.push(key)
      }
      visit(child)
    }
  }

  visit(value)
  return keys
}

const parseJsonLines = (text: string): unknown[] =>
  text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('}'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        return []
      }
    })

describe('price mode contracts', () => {
  for (const priceCase of priceCases) {
    test(`${priceCase.label} accepts --price without producing an output directory`, async () => {
      const result = await runCommand(['src/cli/create-cli.ts', ...priceCase.args], {
        ...(priceCase.env ? { env: priceCase.env } : {})
      })

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).toBeNull()
      const output = `${result.stdout}\n${result.stderr}`
      for (const expected of Array.isArray(priceCase.expected) ? priceCase.expected : [priceCase.expected]) {
        expect(output).toContain(expected)
      }
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

  test('price JSON result omits estimate note fields', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      STABLE_EXAMPLE_AUDIO_URL,
      '--llm',
      'openai=gpt-5.4',
      '--llm',
      'groq=openai/gpt-oss-20b',
      '--tts',
      'kitten=kitten-tts-mini',
      '--price',
      '--json'
    ])

    expect(result.exitCode).toBe(0)
    const emittedResult = parseJsonLines(`${result.stdout}\n${result.stderr}`)
      .find((entry) => isRecord(entry) && entry['dryRun'] === true)

    expect(emittedResult).toBeDefined()
    expect(findPricingNoteKeys(emittedResult)).toEqual([])
    expect(JSON.stringify(emittedResult)).not.toContain('TTS estimate omitted')
  })

  test('URL article extraction methods resolve provider models consistently', () => {
    const base: Omit<ExtractionMetadata, 'extractionMethod'> = {
      totalPages: 1,
      ocrPages: 0,
      textPages: 1,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 100
    }

    expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+defuddle' })).toEqual({
      provider: 'defuddle',
      model: 'defuddle'
    })
    expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+glm-reader' })).toEqual({
      provider: 'glm-reader',
      model: 'glm-reader'
    })
    expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+spider' })).toEqual({
      provider: 'spider',
      model: 'spider'
    })
    expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+supadata' })).toEqual({
      provider: 'supadata',
      model: 'supadata'
    })
    expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+zyte' })).toEqual({
      provider: 'zyte',
      model: 'zyte'
    })
    expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+defuddle' } }).steps[0]).toMatchObject({
      step: 'extract',
      provider: 'defuddle',
      model: 'defuddle',
      cost: 0
    })
    expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+spider' } }).steps[0]).toMatchObject({
      step: 'extract',
      provider: 'spider',
      model: 'spider',
      cost: 0.12
    })
    expect(computeActualProcessingTimes({ step2: { ...base, extractionMethod: 'html+zyte' } }).steps[0]).toMatchObject({
      provider: 'zyte',
      model: 'zyte',
      processingTimeMs: 1234
    })
  })

  test('timing estimates include normalized rates and throughput fields', () => {
    const timing = computeEstimatedProcessingTimes({
      sttTargets: [{ service: 'deepgram', model: 'nova-3' }],
      audioDurationSeconds: 10,
      extractTargets: [{ provider: 'kimi', model: 'kimi-k2.6', pageCount: 2 }],
      llmTargets: [{ service: 'openai', model: 'gpt-5.4-nano', inputTokens: 600, outputTokens: 400 }],
      ttsTargets: [{ service: 'openai', model: 'gpt-4o-mini-tts' }],
      ttsCharacterCount: 1000,
      imageTargets: [{ service: 'openai', model: 'gpt-image-2', count: 2 }],
      videoTargets: [{ service: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4 }],
      musicTargets: [{ service: 'gemini', model: 'lyria-3-clip-preview' }]
    })

    const rows = new Map(timing.steps.map((step) => [step.step, step]))
    expect(rows.get('stt')).toMatchObject({
      rateBasis: 'durationSecond',
      throughputUnit: 'x',
      timingScope: 'estimated'
    })
    expect(rows.get('video')).toMatchObject({
      rateBasis: 'durationSecond',
      throughputUnit: 'x',
      msPerUnit: getVideoEstimation('gemini', 'veo-3.1-lite-generate-preview').msPerSecond
    })
    expect(rows.get('music')).toMatchObject({
      rateBasis: 'durationSecond',
      throughputUnit: 'x'
    })
    expect(rows.get('llm')).toMatchObject({
      rateBasis: '1KTokens',
      throughputUnit: 'tokensPerSecond'
    })
    expect(rows.get('tts')).toMatchObject({
      rateBasis: '1KCharacters',
      throughputUnit: 'charactersPerSecond'
    })
    expect(rows.get('extract')).toMatchObject({
      rateBasis: 'page',
      throughputUnit: 'pagesPerMinute'
    })
    expect(rows.get('image')).toMatchObject({
      rateBasis: 'image',
      throughputUnit: 'imagesPerMinute'
    })
  })

  test('actual STT timing preserves wall-clock scope and phase breakdowns', () => {
    const actual = computeActualProcessingTimes({
      audioDurationSeconds: 10,
      step2: buildSttMetadata({
        processingTime: 2500,
        timings: {
          uploadMs: 100,
          createMs: 200,
          pollMs: 300,
          pollSleepMs: 400,
          transcriptMs: 500,
          cleanupMs: 50,
          remoteProcessingMs: 950,
          requestCount: 3
        }
      })
    })

    expect(actual.steps[0]).toMatchObject({
      timingScope: 'wall',
      rateBasis: 'durationSecond',
      msPerUnit: 250,
      throughputValue: 4,
      timingBreakdown: {
        uploadMs: 100,
        createMs: 200,
        pollMs: 300,
        pollSleepMs: 400,
        transcriptMs: 500,
        cleanupMs: 50,
        remoteProcessingMs: 950
      }
    })
    expect(actual.steps[0]?.timingBreakdown).not.toHaveProperty('requestCount')
  })

  test('aggregate timing includes non-TTS step estimates when inputs are known', () => {
    const steps: StepEstimate[] = [
      { step: 'stt', provider: 'deepgram', model: 'nova-3', durationSeconds: 12, totalCost: 1 },
      {
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        inputCostPer1MCents: 5,
        outputCostPer1MCents: 40,
        estimatedInputTokens: 600,
        estimatedOutputTokens: 400,
        totalCost: 1
      },
      { step: 'image', provider: 'openai', model: 'gpt-image-2', imageCount: 2, totalCost: 1 },
      { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4, totalCost: 1 },
      { step: 'music', provider: 'gemini', model: 'lyria-3-clip-preview', durationSeconds: 30, lyricsSource: 'generated', totalCost: 1 }
    ]

    const timing = buildAggregateTiming(steps, undefined)
    expect(timing?.steps.map((step) => step.step)).toEqual(['stt', 'llm', 'image', 'video', 'music'])
    expect(timing?.steps.every((step) => typeof step.msPerUnit === 'number')).toBe(true)
  })

  test('video timing estimates use normalized provider defaults when duration is omitted', () => {
    const timing = computeEstimatedProcessingTimes({
      videoTargets: [
        { service: 'gemini', model: 'veo-3.1-lite-generate-preview' }
      ]
    })

    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      inputValue: step.inputValue,
      msPerUnit: step.msPerUnit
    }))).toEqual([
      {
        provider: 'gemini',
        model: 'veo-3.1-lite-generate-preview',
        inputValue: 4,
        msPerUnit: getVideoEstimation('gemini', 'veo-3.1-lite-generate-preview').msPerSecond
      }
    ])
  })

  test('music lyric-video mode rejects --price', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'music',
      '--audio',
      STABLE_EXAMPLE_AUDIO_URL,
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(result.outputDir).toBeNull()
    expect(`${result.stdout}\n${result.stderr}`).toContain('Do not combine hosted music flags')
  })

  test('cheapest-model helpers return stable model selections', () => {
    expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.4-nano')
    expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.20-non-reasoning')
    expect(resolveCheapestModelForFlag('glm')).toBe('glm-5.1')
    expect(resolveCheapestModelForFlag('kimi')).toBe('kimi-k2.6')
    expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-2')
    expect(resolveCheapestModelForFlag('bfl-image')).toBe('flux-2-pro')
    expect(resolveCheapestModelForFlag('reve-image')).toBe('latest')
    expect(resolveCheapestModelForFlag('gemini-music')).toBe('lyria-3-clip-preview')
    expect(resolveCheapestModelForFlag('deepgram-stt')).toBe('nova-3')
    expect(resolveCheapestModelForFlag('grok-stt')).toBe('speech-to-text')
    expect(resolveCheapestModelForFlag('grok-tts')).toBe('grok-tts')
    expect(resolveCheapestModelForFlag('mistral-tts')).toBe('voxtral-mini-tts-2603')
    expect(resolveCheapestModelForFlag('speechify-tts')).toBe('simba-english')
    expect(resolveCheapestModelForFlag('openai-stt')).toBe('gpt-4o-mini-transcribe')
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe('gemini-3-flash-preview')
    expect(resolveCheapestModelForFlag('glm-stt')).toBe('glm-asr-2512')
    expect(resolveCheapestModelForFlag('supadata-stt')).toBe('auto')
    expect(resolveCheapestModelForFlag('scrapecreators-stt')).toBe('youtube-transcript')
    expect(resolveCheapestModelForFlag('openai-ocr')).toBe('gpt-5.4-nano')
    expect(resolveCheapestModelForFlag('grok-ocr')).toBe('grok-4.3')
    expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
    expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(resolveCheapestModelForFlag('kimi-ocr')).toBe('kimi-k2.6')
    expect(resolveCheapestModelForFlag('unstructured-ocr')).toBe('hi_res_and_enrichment')
    expect(resolveCheapestModelForFlag('gemini-video')).toBe('veo-3.1-lite-generate-preview')
    expect(resolveCheapestModelForFlag('minimax-video')).toBe('T2V-01')
    expect(resolveCheapestModelForFlag('glm-video')).toBe('cogvideox-3')
    expect(selectCheapestVideoSelection('gemini')).toMatchObject({
      provider: 'gemini',
      model: 'veo-3.1-lite-generate-preview'
    })
    expect(selectCheapestVideoSelection('minimax')).toMatchObject({
      provider: 'minimax',
      model: 'T2V-01'
    })
    expect(selectCheapestVideoSelection('glm')).toMatchObject({
      provider: 'glm',
      model: 'cogvideox-3'
    })
  })

  test('Mistral TTS estimates use published output-character pricing and provisional speed', () => {
    const model = 'voxtral-mini-tts-2603'
    const opts = {
      mistralTtsModels: [model],
      mistralTtsModel: model
    } as Parameters<typeof estimateTtsCosts>[0]

    const cost = estimateTtsCosts(opts, 1000)[0]
    expect(cost?.inputCostPer1MCharactersCents).toBe(0)
    expect(cost?.outputCostPer1MCharactersCents).toBe(1600)
    expect(cost?.totalCost).toBe(1.6)

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [{ service: 'mistral', model }],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.find((step) => step.provider === 'mistral')?.processingTimeMs)
      .toBe(Math.round(getTtsEstimation('mistral', model).msPer1KChars))
  })

  test('Speechify TTS estimates use registry pricing and timing defaults', () => {
    const costs = [
      ...estimateTtsCosts({
        speechifyTtsModels: ['simba-english']
      } as Parameters<typeof estimateTtsCosts>[0], 1000),
      ...estimateTtsCosts({
        speechifyTtsModels: ['simba-multilingual'],
        speechifyTtsRefAudio: 'input/voices/my-voice-sample.mp3',
        speechifyTtsConsentName: 'Anthony Example',
        speechifyTtsConsentEmail: 'anthony@example.com'
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
      { provider: 'speechify', model: 'simba-multilingual', costPer1kCharactersCents: 1, setupCostCents: 0, setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS, totalCost: 1 }
    ])

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [
        { service: 'speechify', model: 'simba-english' }
      ],
      ttsCharacterCount: 1000
    })

    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { provider: 'speechify', model: 'simba-english', processingTimeMs: 4_500 }
    ])
  })

  test('ElevenLabs TTS estimates use current API rates and IVC setup timing', () => {
    const baseCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_v3']
    } as Parameters<typeof estimateTtsCosts>[0], 1000)

    expect(baseCosts.map((cost) => ({
      model: cost.model,
      costPer1kCharactersCents: cost.costPer1kCharactersCents,
      totalCost: cost.totalCost
    }))).toEqual([
      { model: 'eleven_v3', costPer1kCharactersCents: 10, totalCost: 10 }
    ])

    const cloneCosts = estimateTtsCosts({
      elevenlabsTtsModels: ['eleven_v3'],
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
        model: 'eleven_v3',
        setupCostCents: 0,
        setupTimeMs: 10_000,
        setupNote: 'ElevenLabs instant voice clone setup',
        totalCost: 10
      }
    ])

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [
        { service: 'elevenlabs', model: 'eleven_v3', setupTimeMs: 10_000 },
        { service: 'elevenlabs', model: 'eleven_v3' }
      ],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      { provider: 'elevenlabs', model: 'eleven_v3', processingTimeMs: 45_885 },
      { provider: 'elevenlabs', model: 'eleven_v3', processingTimeMs: 35_885 }
    ])

  })

  test('OpenAI custom voice TTS estimates include zero-cost setup and setup timing', () => {
    const model = 'gpt-4o-mini-tts'
    const opts = {
      openaiTtsModels: [model],
      openaiTtsRefAudio: 'input/examples/audio/anthony-voice.mp3',
      openaiTtsConsentId: 'cons_123'
    } as Parameters<typeof estimateTtsCosts>[0]

    const cost = estimateTtsCosts(opts, 1000)[0]
    expect(cost).toMatchObject({
      provider: 'openai',
      model,
      setupCostCents: 0,
      setupNote: 'OpenAI custom voice creation setup'
    })
    expect(cost?.totalCost).toBe(
      cost?.costPer1kCharactersCents
      ?? ((cost?.inputCostPer1MCharactersCents ?? 0) + (cost?.outputCostPer1MCharactersCents ?? 0)) / 1000
    )

    const timing = computeEstimatedProcessingTimes({
      ttsTargets: [{
        service: 'openai',
        model,
        ...(cost?.setupTimeMs !== undefined ? { setupTimeMs: cost.setupTimeMs } : {})
      }],
      ttsCharacterCount: 1000
    })
    expect(timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs
    }))).toEqual([
      {
        provider: 'openai',
        model,
        processingTimeMs: Math.round(getTtsEstimation('openai', model).msPer1KChars + (cost?.setupTimeMs ?? 0))
      }
    ])
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
        imageFormat: 'png',
        requestMode: 'generation'
      }
    })

    expect(cost.steps[0]).toMatchObject({
      step: 'image',
      provider: 'openai',
      model: 'gpt-image-2',
      cost: 0.6
    })
  })

  test('STT actual fallback costs use explicit audio duration when step1 duration is unknown', () => {
    const audioDurationSeconds = 59.585306
    const actual = computeActualCosts({
      step1: buildHostedStep1(),
      step2: buildSttMetadata(),
      audioDurationSeconds
    })
    const sttStep = actual.steps[0]

    expect(sttStep).toMatchObject({
      step: 'stt',
      provider: 'deepgram',
      model: 'nova-3',
      inputMetric: 'durationSeconds',
      inputValue: audioDurationSeconds
    })
    expect(sttStep?.cost).toBe(computeSttCost('deepgram', 'nova-3', audioDurationSeconds))
    expect(actual.totalCost).toBeGreaterThan(0)
  })

  test('STT provider billing metadata wins over duration fallback', () => {
    const audioDurationSeconds = 3600
    const providerCostCents = 1.23
    const actual = computeActualCosts({
      step1: buildHostedStep1(),
      step2: buildSttMetadata({
        transcriptionService: 'deepgram',
        transcriptionModel: 'nova-3',
        billing: {
          totalCost: providerCostCents,
          source: 'provider_quote',
          mode: 'duration'
        }
      }),
      audioDurationSeconds
    })
    const sttStep = actual.steps[0]

    expect(computeSttCost('deepgram', 'nova-3', audioDurationSeconds)).toBeGreaterThan(providerCostCents)
    expect(sttStep).toMatchObject({
      step: 'stt',
      provider: 'deepgram',
      model: 'nova-3',
      cost: providerCostCents,
      inputMetric: 'durationSeconds',
      inputValue: audioDurationSeconds
    })
    expect(actual.totalCost).toBe(providerCostCents)
  })

  test('Supadata STT estimates force generation pricing for direct media URLs', () => {
    const audioDurationSeconds = 2423.04
    const expectedCredits = (audioDurationSeconds / 60) * 2
    const estimated = computeEstimatedCosts({
      applyCostMultipliers: false,
      sourceUrl: 'https://ajc.pics/autoshow/benchmarks/stt/2022-09-30-widgets-fsjam-40-minutes.mp3',
      audioDurationSeconds,
      sttTargets: [
        { service: 'supadata', model: 'auto' }
      ]
    })

    expect(estimated.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      cost: Number(step.cost.toFixed(5))
    }))).toEqual([
      { provider: 'supadata', model: 'auto', cost: Number(expectedCredits.toFixed(5)) }
    ])
    expect(findPricingNoteKeys(estimated)).toEqual([])

    const platformAuto = computeEstimatedCosts({
      applyCostMultipliers: false,
      sourceUrl: 'https://www.youtube.com/watch?v=MORMZXEaONk',
      audioDurationSeconds,
      sttTargets: [{ service: 'supadata', model: 'auto' }]
    })
    expect(platformAuto.steps[0]?.cost).toBe(expectedCredits)
  })

  test('Supadata actual fallback forces generation pricing for direct media URLs', () => {
    const audioDurationSeconds = 2423.04
    const expectedCredits = (audioDurationSeconds / 60) * 2
    const actual = computeActualCosts({
      step1: buildHostedStep1(),
      step2: buildSttMetadata({
        transcriptionService: 'supadata',
        transcriptionModel: 'auto'
      }),
      audioDurationSeconds
    })

    expect(actual.steps[0]).toMatchObject({
      step: 'stt',
      provider: 'supadata',
      model: 'auto',
      inputMetric: 'credits'
    })
    expect(actual.steps[0]?.cost).toBeCloseTo(expectedCredits)
    expect(actual.steps[0]?.inputValue).toBeCloseTo(expectedCredits)
  })

  test('ScrapeCreators STT estimates and actuals use a fixed one-credit request', () => {
    const audioDurationSeconds = 9999
    const estimated = computeEstimatedCosts({
      applyCostMultipliers: false,
      audioDurationSeconds,
      sttTargets: [
        { service: 'scrapecreators', model: 'youtube-transcript' }
      ]
    })

    expect(estimated.steps[0]).toMatchObject({
      step: 'stt',
      provider: 'scrapecreators',
      model: 'youtube-transcript',
      cost: 0.188,
      durationSeconds: 0
    })
    expect(estimated.totalCost).toBe(0.188)

    const actual = computeActualCosts({
      step1: buildHostedStep1(),
      step2: buildSttMetadata({
        transcriptionService: 'scrapecreators',
        transcriptionModel: 'youtube-transcript',
        billing: {
          creditsUsed: 1,
          creditRateCents: 0.188,
          totalCost: 0.188,
          source: 'fallback-estimate',
          mode: 'url'
        }
      }),
      audioDurationSeconds
    })

    expect(actual.steps[0]).toMatchObject({
      step: 'stt',
      provider: 'scrapecreators',
      model: 'youtube-transcript',
      cost: 0.188,
      inputMetric: 'credits',
      inputValue: 1
    })
    expect(actual.totalCost).toBe(0.188)
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

    const rows = timing.steps.map((step) => ({
      model: step.model,
      processingTimeMs: step.processingTimeMs,
      inputValue: step.inputValue
    }))
    expect(rows).toEqual([
      {
        model: 'lyria-3-clip-preview',
        processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('gemini', 'lyria-3-clip-preview').msPerSecond),
        inputValue: rows[0]?.inputValue
      },
      {
        model: 'lyria-3-pro-preview',
        processingTimeMs: Math.round((rows[1]?.inputValue ?? 0) * getMusicEstimation('gemini', 'lyria-3-pro-preview').msPerSecond),
        inputValue: rows[1]?.inputValue
      }
    ])
  })

  test('MiniMax music timing estimates use the provider default duration', () => {
    const timing = computeEstimatedProcessingTimes({
      musicTargets: [
        { service: 'minimax', model: 'music-2.6' },
        { service: 'minimax', model: 'music-2.6', durationSeconds: 15 }
      ]
    })

    const rows = timing.steps.map((step) => ({
      provider: step.provider,
      model: step.model,
      processingTimeMs: step.processingTimeMs,
      inputValue: step.inputValue
    }))
    expect(rows).toEqual([
      {
        provider: 'minimax',
        model: 'music-2.6',
        processingTimeMs: Math.round((rows[0]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-2.6').msPerSecond),
        inputValue: rows[0]?.inputValue
      },
      {
        provider: 'minimax',
        model: 'music-2.6',
        processingTimeMs: Math.round((rows[1]?.inputValue ?? 0) * getMusicEstimation('minimax', 'music-2.6').msPerSecond),
        inputValue: rows[1]?.inputValue
      }
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

  test('LLM provider usage wins over local token counting and records source', async () => {
    const instrumentation = await runWithLLMInstrumentation(
      'short prompt',
      async () => ({
        text: 'short response',
        usage: {
          prompt_tokens: 123,
          completion_tokens: 45,
          total_tokens: 168
        },
        returnedModel: 'gpt-returned'
      })
    )
    const metadata = buildStep3Metadata('openai', 'gpt-5.4-nano', instrumentation)
    const actual = computeActualCosts({ step3: metadata })

    expect(metadata).toMatchObject({
      inputTokenCount: 123,
      outputTokenCount: 45,
      tokenCountSource: 'provider_usage',
      providerReturnedModel: 'gpt-returned',
      providerUsage: {
        inputTokenCount: 123,
        outputTokenCount: 45,
        totalTokenCount: 168
      }
    })
    expect(actual.steps[0]).toMatchObject({
      step: 'llm',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      inputValue: 168,
      promptTokens: 123,
      completionTokens: 45,
      costSource: 'provider_usage'
    })
  })

  test('LLM missing provider usage falls back to local token counts and records source', async () => {
    const instrumentation = await runWithLLMInstrumentation(
      'short prompt',
      async () => 'short response'
    )
    const metadata = buildStep3Metadata('openai', 'gpt-5.4-nano', instrumentation)
    const actual = computeActualCosts({ step3: metadata })

    expect(metadata.tokenCountSource).toBe('local_count')
    expect(metadata.inputTokenCount).toBeGreaterThan(0)
    expect(metadata.outputTokenCount).toBeGreaterThan(0)
    expect(actual.steps[0]?.costSource).toBe('computed_usage')
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
      processingTimeMs: Math.round(2 * getExtractEstimation('deepinfra', 'Qwen/Qwen3-VL-30B-A3B-Instruct').msPerPage)
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
    const pageCount = extractTargets[0]?.pageCount ?? 0
    expect(timing.steps[0]).toMatchObject({
      provider: 'kimi',
      model: 'kimi-k2.6',
      processingTimeMs: Math.round(pageCount * getExtractEstimation('kimi', 'kimi-k2.6').msPerPage)
    })
  })

  test('Grok OCR estimates and actuals use provisional token pricing', () => {
    const extractTargets = [{
      provider: 'grok' as const,
      model: 'grok-4.3',
      pageCount: 2,
      estimateType: 'heuristic' as const
    }]
    const cost = computeEstimatedCosts({ applyCostMultipliers: false, extractTargets })
    const timing = computeEstimatedProcessingTimes({ extractTargets })

    expect(cost.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'grok',
      model: 'grok-4.3',
      pageCount: 2,
      promptTokens: 8000,
      completionTokens: 2000,
      inputCostPer1MCents: 125,
      outputCostPer1MCents: 250,
      estimateType: 'heuristic'
    })
    expect(cost.totalCost).toBe(1.5)
    expect(timing.steps[0]).toMatchObject({
      provider: 'grok',
      model: 'grok-4.3',
      processingTimeMs: Math.round(2 * getExtractEstimation('grok', 'grok-4.3').msPerPage)
    })

    const actualMetadata: ExtractionMetadata = {
      extractionMethod: 'pdf+grok-ocr',
      totalPages: 1,
      ocrPages: 1,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 5000,
      ocrService: 'grok',
      ocrModel: 'grok-4.3',
      promptTokens: 4000,
      completionTokens: 1000
    }
    const actual = computeActualCosts({ step2: actualMetadata })

    expect(actual.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'grok',
      model: 'grok-4.3',
      cost: 0.75,
      promptTokens: 4000,
      completionTokens: 1000,
      costSource: 'provider_usage'
    })
    expect(actual.totalCost).toBe(0.75)
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
      promptTokens: 5972,
      completionTokens: 3688,
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
      promptTokens: 5972,
      completionTokens: 3688,
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

  test('OCR providerCostCents wins over page and token fallback for single extraction metadata', () => {
    const actualMetadata: ExtractionMetadata = {
      extractionMethod: 'pdf+openai-ocr',
      totalPages: 50,
      ocrPages: 50,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10_000,
      ocrService: 'openai',
      ocrModel: 'gpt-5.4-nano',
      promptTokens: 6000,
      completionTokens: 1500,
      providerCostCents: 0.42,
      providerCostSource: 'provider_usage',
      ocrProviderUsage: [{ prompt_tokens: 6000, completion_tokens: 1500 }]
    }
    const actual = computeActualCosts({ step2: actualMetadata })

    expect(actual.steps[0]).toMatchObject({
      step: 'extract',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      cost: 0.42,
      costSource: 'provider_usage',
      inputMetric: 'tokens',
      inputValue: 7500
    })
    expect(actual.totalCost).toBe(0.42)
  })

  test('OCR providerCostCents wins over fallback for multi-provider extraction metadata', () => {
    const base: Omit<ExtractionMetadata, 'extractionMethod'> = {
      totalPages: 10,
      ocrPages: 10,
      textPages: 0,
      processingTime: 1234,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10_000
    }
    const actual = computeActualCosts({
      step2: [
        {
          ...base,
          extractionMethod: 'pdf+openai-ocr',
          ocrService: 'openai',
          ocrModel: 'gpt-5.4-nano',
          promptTokens: 6000,
          completionTokens: 1500,
          providerCostCents: 0.42,
          providerCostSource: 'provider_usage'
        },
        {
          ...base,
          extractionMethod: 'pdf+unstructured-ocr',
          ocrService: 'unstructured',
          ocrModel: 'hi_res_and_enrichment',
          providerCostCents: 0.75,
          providerCostSource: 'provider_quote'
        }
      ] as ExtractionMetadata[]
    })

    expect(actual.steps.map((step) => ({
      provider: step.provider,
      cost: step.cost,
      costSource: step.costSource
    }))).toEqual([
      { provider: 'openai', cost: 0.42, costSource: 'provider_usage' },
      { provider: 'unstructured', cost: 0.75, costSource: 'provider_quote' }
    ])
    expect(actual.totalCost).toBe(1.17)
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
        estimateType: 'heuristic',
        note: 'Internal OCR estimate caveat.'
      }],
      notes: ['Internal aggregate estimate caveat.']
    }, actualMetadata)
    const observedEstimate = resolveExtractObservedEstimateCosts(actualMetadata)
    const fallbackEstimated = resolveExtractEstimatedCosts(undefined, actualMetadata)

    expect(preflightEstimated.totalCost).toBe(9)
    expect(preflightEstimated.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      promptTokens: 8000,
      completionTokens: 2000,
      cost: 9
    })
    expect(findPricingNoteKeys(preflightEstimated)).toEqual([])
    expect(fallbackEstimated.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      promptTokens: 5972,
      completionTokens: 3688
    })
    expect(observedEstimate.steps[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      promptTokens: 1,
      completionTokens: 1,
      estimateType: 'exact'
    })
    expect(observedEstimate.totalCost).not.toBe(preflightEstimated.totalCost)
    expect(findPricingNoteKeys(fallbackEstimated)).toEqual([])
  })

  test('OCR token heuristics feed registry pricing consistently', () => {
    const estimateOnePageCost = (
      target: NonNullable<Parameters<typeof computeEstimatedCosts>[0]['extractTargets']>[number]
    ): number => {
      const cost = computeEstimatedCosts({ applyCostMultipliers: false, extractTargets: [target] })
      const step = cost.steps[0]
      expect(step?.promptTokens).toBeGreaterThan(0)
      expect(step?.completionTokens).toBeGreaterThan(0)
      expect(cost.totalCost).toBe(
        ((step?.promptTokens ?? 0) / 1_000_000) * (step?.inputCostPer1MCents ?? 0)
        + ((step?.completionTokens ?? 0) / 1_000_000) * (step?.outputCostPer1MCents ?? 0)
      )
      return cost.totalCost
    }

    for (const target of [
      { provider: 'kimi' as const, model: 'kimi-k2.6', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'grok' as const, model: 'grok-4.3', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'anthropic' as const, model: 'claude-opus-4-7', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'anthropic' as const, model: 'claude-sonnet-4-6', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'anthropic' as const, model: 'claude-haiku-4-5', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'openai' as const, model: 'gpt-5.5', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'openai' as const, model: 'gpt-5.4', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'openai' as const, model: 'gpt-5.4-mini', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'openai' as const, model: 'gpt-5.4-nano', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'gemini' as const, model: 'gemini-3.1-pro-preview', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'gemini' as const, model: 'gemini-3.1-flash-lite-preview', pageCount: 1, estimateType: 'heuristic' as const },
      { provider: 'deepinfra' as const, model: 'Qwen/Qwen3-VL-235B-A22B-Instruct', pageCount: 1, estimateType: 'heuristic' as const }
    ]) {
      const usage = estimateOcrTokenUsage(target.provider, target.model, target.pageCount)
      expect(usage.promptTokens).toBeGreaterThan(0)
      expect(usage.completionTokens).toBeGreaterThan(0)
      expect(estimateOnePageCost(target)).toBeGreaterThan(0)
    }
  })
})
