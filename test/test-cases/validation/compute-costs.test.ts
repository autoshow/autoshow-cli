import { describe, expect, test } from 'bun:test'
import { parseDurationToSeconds, computeEstimatedCosts, computeActualCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'

describe('parseDurationToSeconds', () => {
  test('returns 0 for empty string', () => {
    expect(parseDurationToSeconds('')).toBe(0)
  })

  test('returns 0 for Unknown', () => {
    expect(parseDurationToSeconds('Unknown')).toBe(0)
  })

  test('parses MM:SS format', () => {
    expect(parseDurationToSeconds('1:30')).toBe(90)
  })

  test('parses HH:MM:SS format', () => {
    expect(parseDurationToSeconds('1:01:30')).toBe(3690)
  })

  test('parses zero minutes', () => {
    expect(parseDurationToSeconds('0:45')).toBe(45)
  })
})

describe('computeEstimatedCosts STT routing', () => {
  test('useReverb produces reverb step with zero cost', () => {
    const result = computeEstimatedCosts({ useReverb: true, audioDurationSeconds: 60 })
    expect(result.steps[0]?.step).toBe('stt')
    expect(result.steps[0]?.provider).toBe('reverb')
    expect(result.steps[0]?.model).toBe('reverb')
    expect(result.steps[0]?.cost).toBe(0)
  })

  test('elevenlabsSttModel routes to elevenlabs', () => {
    const result = computeEstimatedCosts({ elevenlabsSttModel: 'scribe_v1', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('elevenlabs')
    expect(result.steps[0]?.model).toBe('scribe_v1')
  })

  test('groqSttModel routes to groq', () => {
    const result = computeEstimatedCosts({ groqSttModel: 'whisper-large-v3-turbo', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('groq')
    expect(result.steps[0]?.model).toBe('whisper-large-v3-turbo')
  })

  test('deepgramSttModel routes to deepgram', () => {
    const result = computeEstimatedCosts({ deepgramSttModel: 'nova-3', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('deepgram')
    expect(result.steps[0]?.model).toBe('nova-3')
  })

  test('speechmaticsSttModel routes to speechmatics', () => {
    const result = computeEstimatedCosts({ speechmaticsSttModel: 'enhanced', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('speechmatics')
    expect(result.steps[0]?.model).toBe('enhanced')
  })

  test('revSttModel routes to rev', () => {
    const result = computeEstimatedCosts({ revSttModel: 'machine', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('rev')
    expect(result.steps[0]?.model).toBe('machine')
    expect(result.steps[0]?.cost).toBeCloseTo(20 / 60, 8)
  })

  test('rev machine estimate applies 15 second minimum billing', () => {
    const result = computeEstimatedCosts({ revSttModel: 'machine', audioDurationSeconds: 3 })
    expect(result.steps[0]?.provider).toBe('rev')
    expect(result.steps[0]?.model).toBe('machine')
    expect(result.steps[0]?.cost).toBeCloseTo((15 / 3600) * 20, 8)
  })

  test('rev low_cost estimate applies 15 second minimum billing', () => {
    const result = computeEstimatedCosts({ revSttModel: 'low_cost', audioDurationSeconds: 3 })
    expect(result.steps[0]?.provider).toBe('rev')
    expect(result.steps[0]?.model).toBe('low_cost')
    expect(result.steps[0]?.cost).toBeCloseTo((15 / 3600) * 10, 8)
  })

  test('mistralSttModel routes to mistral', () => {
    const result = computeEstimatedCosts({ mistralSttModel: 'voxtral-mini-2507', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('mistral')
    expect(result.steps[0]?.model).toBe('voxtral-mini-2507')
  })

  test('assemblyaiSttModel routes to assemblyai', () => {
    const result = computeEstimatedCosts({ assemblyaiSttModel: 'best', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('assemblyai')
    expect(result.steps[0]?.model).toBe('best')
  })

  test('gladiaSttModel routes to gladia', () => {
    const result = computeEstimatedCosts({ gladiaSttModel: 'default', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('gladia')
    expect(result.steps[0]?.model).toBe('default')
  })

  test('whisperModel routes to whisper', () => {
    const result = computeEstimatedCosts({ whisperModel: 'large-v3-turbo', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('whisper')
    expect(result.steps[0]?.model).toBe('large-v3-turbo')
  })

  test('only first matched provider is used when multiple are set', () => {
    const result = computeEstimatedCosts({
      elevenlabsSttModel: 'scribe_v1',
      groqSttModel: 'whisper-large-v3-turbo',
      audioDurationSeconds: 60
    })
    const sttSteps = result.steps.filter(s => s.step === 'stt')
    expect(sttSteps).toHaveLength(1)
    expect(sttSteps[0]?.provider).toBe('elevenlabs')
  })

  test('sttTargets emits one STT step per selected provider', () => {
    const result = computeEstimatedCosts({
      sttTargets: [
        { service: 'elevenlabs', model: 'scribe_v2' },
        { service: 'assemblyai', model: 'universal-3-pro' },
        { service: 'gladia', model: 'default' },
        { service: 'whisper', model: 'tiny' }
      ],
      audioDurationSeconds: 60
    })

    const sttSteps = result.steps.filter(s => s.step === 'stt')
    expect(sttSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'elevenlabs:scribe_v2',
      'assemblyai:universal-3-pro',
      'gladia:default',
      'whisper:tiny'
    ])
  })

  test('youtube-captions estimate is zero-cost when selected explicitly', () => {
    const result = computeEstimatedCosts({
      sttTargets: [
        { service: 'youtube-captions', model: 'subtitle-track' }
      ],
      audioDurationSeconds: 60
    })

    const sttStep = result.steps.find((step) => step.step === 'stt')
    expect(sttStep?.provider).toBe('youtube-captions')
    expect(sttStep?.model).toBe('subtitle-track')
    expect(sttStep?.cost).toBe(0)
  })

  test('no STT step when no model set and useReverb is false', () => {
    const result = computeEstimatedCosts({ audioDurationSeconds: 60 })
    const sttSteps = result.steps.filter(s => s.step === 'stt')
    expect(sttSteps).toHaveLength(0)
  })
})

describe('computeActualCosts STT', () => {
  test('computes STT cost from step1 duration and step2 transcription metadata', () => {
    const result = computeActualCosts({
      step1: {
        url: 'https://example.com/audio.mp3',
        duration: '1:00',
        title: 'Test',
        description: '',
        author: '',
        slug: 'test',
        audioFileName: 'test.mp3',
        audioFileSize: 0
      },
      step2: {
        transcriptionService: 'deepgram',
        transcriptionModel: 'nova-3',
        processingTime: 5000,
        tokenCount: 150
      }
    })
    const sttStep = result.steps.find(s => s.step === 'stt')
    expect(sttStep).toBeDefined()
    expect(sttStep?.provider).toBe('deepgram')
    expect(sttStep?.model).toBe('nova-3')
    expect(typeof sttStep?.cost).toBe('number')
  })

  test('computes one actual STT cost step per provider metadata entry', () => {
    const result = computeActualCosts({
      step1: {
        url: 'https://example.com/audio.mp3',
        duration: '1:00',
        title: 'Test',
        description: '',
        author: '',
        slug: 'test',
        audioFileName: 'test.mp3',
        audioFileSize: 0
      },
      step2: [
        {
          transcriptionService: 'elevenlabs',
          transcriptionModel: 'scribe_v2',
          processingTime: 500,
          tokenCount: 100
        },
        {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'universal-3-pro',
          processingTime: 600,
          tokenCount: 120
        },
        {
          transcriptionService: 'speechmatics',
          transcriptionModel: 'enhanced',
          processingTime: 700,
          tokenCount: 140
        },
        {
          transcriptionService: 'rev',
          transcriptionModel: 'machine',
          processingTime: 800,
          tokenCount: 160
        }
      ]
    })

    const sttSteps = result.steps.filter((step) => step.step === 'stt')
    expect(sttSteps).toHaveLength(4)
    expect(sttSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'elevenlabs:scribe_v2',
      'assemblyai:universal-3-pro',
      'speechmatics:enhanced',
      'rev:machine'
    ])
    expect(sttSteps[3]?.cost).toBeCloseTo(20 / 60, 8)
  })

  test('youtube-captions actual STT cost stays zero', () => {
    const result = computeActualCosts({
      step1: {
        url: 'https://www.youtube.com/watch?v=abc123',
        duration: '1:00',
        title: 'Test',
        description: '',
        author: '',
        slug: 'test',
        audioFileName: 'test.mp3',
        audioFileSize: 0
      },
      step2: {
        transcriptionService: 'youtube-captions',
        transcriptionModel: 'subtitle-track',
        processingTime: 250,
        tokenCount: 50,
        captionKind: 'manual',
        captionLanguage: 'en',
        captionFormat: 'vtt'
      }
    })

    const sttStep = result.steps.find((step) => step.step === 'stt')
    expect(sttStep?.provider).toBe('youtube-captions')
    expect(sttStep?.model).toBe('subtitle-track')
    expect(sttStep?.cost).toBe(0)
  })

  test('computes Rev actual cost without extra minimum billing above 15 seconds', () => {
    const result = computeActualCosts({
      step1: {
        url: 'https://example.com/audio.mp3',
        duration: '1:01',
        title: 'Test',
        description: '',
        author: '',
        slug: 'test',
        audioFileName: 'test.mp3',
        audioFileSize: 0
      },
      step2: {
        transcriptionService: 'rev',
        transcriptionModel: 'machine',
        processingTime: 5000,
        tokenCount: 150
      }
    })

    const sttStep = result.steps.find((step) => step.step === 'stt')
    expect(sttStep?.provider).toBe('rev')
    expect(sttStep?.model).toBe('machine')
    expect(sttStep?.cost).toBeCloseTo((61 / 3600) * 20, 8)
  })
})

describe('computeActualCosts extract routing', () => {
  test('estimates GLM OCR extract costs with heuristic token counts', () => {
    const result = computeEstimatedCosts({
      glmOcrModel: 'glm-ocr',
      extractPageCount: 2
    })

    const extractStep = result.steps.find((step) => step.step === 'extract')
    expect(extractStep).toBeDefined()
    expect(extractStep?.provider).toBe('glm')
    expect(extractStep?.model).toBe('glm-ocr')
    expect(extractStep?.promptTokens).toBe(8000)
    expect(extractStep?.completionTokens).toBe(0)
    expect(extractStep?.estimateType).toBe('heuristic')
    expect(extractStep?.cost).toBeCloseTo(0.024, 6)
  })

  test('estimates Firecrawl article extraction cost from the configured credit rate', () => {
    const result = computeEstimatedCosts({
      extractTargets: [{
        provider: 'firecrawl',
        model: 'firecrawl',
        pageCount: 1,
        estimateType: 'exact',
        note: 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'
      }]
    })

    const extractStep = result.steps.find((step) => step.step === 'extract')
    expect(extractStep).toBeDefined()
    expect(extractStep?.provider).toBe('firecrawl')
    expect(extractStep?.model).toBe('firecrawl')
    expect(extractStep?.pageCount).toBe(1)
    expect(extractStep?.costPer1kPagesCents).toBe(83)
    expect(extractStep?.estimateType).toBe('exact')
    expect(extractStep?.note).toContain('Firecrawl Standard plan rate')
    expect(extractStep?.cost).toBeCloseTo(0.083, 6)
  })

  test('computes actual GLM OCR cost from token usage metadata', () => {
    const result = computeActualCosts({
      step2: {
        extractionMethod: 'glm-ocr',
        totalPages: 4,
        ocrPages: 4,
        textPages: 0,
        processingTime: 800,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 100,
        ocrService: 'glm',
        ocrModel: 'glm-ocr',
        promptTokens: 16000,
        completionTokens: 500
      }
    })

    const extractStep = result.steps.find((step) => step.step === 'extract')
    expect(extractStep).toBeDefined()
    expect(extractStep?.provider).toBe('glm')
    expect(extractStep?.model).toBe('glm-ocr')
    expect(extractStep?.inputMetric).toBe('tokens')
    expect(extractStep?.inputValue).toBe(16500)
    expect(extractStep?.promptTokens).toBe(16000)
    expect(extractStep?.completionTokens).toBe(500)
    expect(extractStep?.cost).toBeCloseTo(0.0495, 6)
  })

  test('computes actual Firecrawl article extraction cost from extraction metadata', () => {
    const result = computeActualCosts({
      step2: {
        extractionMethod: 'html+firecrawl',
        totalPages: 1,
        ocrPages: 0,
        textPages: 1,
        processingTime: 800,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 100
      }
    })

    const extractStep = result.steps.find((step) => step.step === 'extract')
    expect(extractStep).toBeDefined()
    expect(extractStep?.provider).toBe('firecrawl')
    expect(extractStep?.model).toBe('firecrawl')
    expect(extractStep?.inputMetric).toBe('pages')
    expect(extractStep?.inputValue).toBe(1)
    expect(extractStep?.cost).toBeCloseTo(0.083, 6)
  })

  test('computes one actual extract step per extraction metadata entry', () => {
    const result = computeActualCosts({
      step2: [
        {
          extractionMethod: 'pdf+ocrmypdf',
          totalPages: 4,
          ocrPages: 4,
          textPages: 0,
          processingTime: 1200,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 100
        },
        {
          extractionMethod: 'mistral-ocr',
          totalPages: 4,
          ocrPages: 4,
          textPages: 0,
          processingTime: 800,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 100,
          ocrModel: 'mistral-ocr-2512'
        },
        {
          extractionMethod: 'glm-ocr',
          totalPages: 4,
          ocrPages: 4,
          textPages: 0,
          processingTime: 700,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 100,
          ocrService: 'glm',
          ocrModel: 'glm-ocr',
          promptTokens: 16000,
          completionTokens: 0
        },
        {
          extractionMethod: 'html+firecrawl',
          totalPages: 1,
          ocrPages: 0,
          textPages: 1,
          processingTime: 600,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 100
        }
      ]
    })

    const extractSteps = result.steps.filter((step) => step.step === 'extract')
    expect(extractSteps).toHaveLength(4)
    expect(extractSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'ocrmypdf:ocrmypdf',
      'mistral:mistral-ocr-2512',
      'glm:glm-ocr',
      'firecrawl:firecrawl'
    ])
  })

  test('computes actual extract timing for extraction metadata arrays', () => {
    const result = computeActualProcessingTimes({
      step2: [
        {
          extractionMethod: 'pdf+paddle-ocr',
          totalPages: 3,
          ocrPages: 3,
          textPages: 0,
          processingTime: 900,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 90
        },
        {
          extractionMethod: 'mistral-ocr',
          totalPages: 3,
          ocrPages: 3,
          textPages: 0,
          processingTime: 700,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 90,
          ocrModel: 'mistral-ocr-2512'
        },
        {
          extractionMethod: 'glm-ocr',
          totalPages: 3,
          ocrPages: 3,
          textPages: 0,
          processingTime: 600,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 90,
          ocrService: 'glm',
          ocrModel: 'glm-ocr',
          promptTokens: 12000,
          completionTokens: 0
        }
      ]
    })

    const extractSteps = result.steps.filter((step) => step.step === 'extract')
    expect(extractSteps).toHaveLength(3)
    expect(extractSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'paddle-ocr:paddle-ocr',
      'mistral:mistral-ocr-2512',
      'glm:glm-ocr'
    ])
  })

  test('youtube-captions estimated timing stays zero', () => {
    const result = computeEstimatedProcessingTimes({
      sttTargets: [
        { service: 'youtube-captions', model: 'subtitle-track' }
      ],
      audioDurationSeconds: 60
    })

    const sttStep = result.steps.find((step) => step.step === 'stt')
    expect(sttStep?.provider).toBe('youtube-captions')
    expect(sttStep?.model).toBe('subtitle-track')
    expect(sttStep?.processingTimeMs).toBe(0)
  })
})
