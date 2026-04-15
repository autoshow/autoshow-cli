import { describe, expect, test } from 'bun:test'
import { parseDurationToSeconds, computeEstimatedCosts, computeActualCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'

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

  test('openaiSttModel routes to openai', () => {
    const result = computeEstimatedCosts({ openaiSttModel: 'gpt-4o-mini-transcribe', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('openai')
    expect(result.steps[0]?.model).toBe('gpt-4o-mini-transcribe')
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
    expect(result.steps[0]?.cost).toBe(0)
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
        { service: 'assemblyai', model: 'universal-2' },
        { service: 'whisper', model: 'tiny' }
      ],
      audioDurationSeconds: 60
    })

    const sttSteps = result.steps.filter(s => s.step === 'stt')
    expect(sttSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'elevenlabs:scribe_v2',
      'assemblyai:universal-2',
      'whisper:tiny'
    ])
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
        transcriptionModelName: 'nova-3',
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
          transcriptionModelName: 'scribe_v2',
          processingTime: 500,
          tokenCount: 100
        },
        {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'universal-2',
          transcriptionModelName: 'universal-2',
          processingTime: 600,
          tokenCount: 120
        },
        {
          transcriptionService: 'speechmatics',
          transcriptionModel: 'enhanced',
          transcriptionModelName: 'enhanced',
          processingTime: 700,
          tokenCount: 140
        },
        {
          transcriptionService: 'rev',
          transcriptionModel: 'machine',
          transcriptionModelName: 'machine',
          processingTime: 800,
          tokenCount: 160
        }
      ]
    })

    const sttSteps = result.steps.filter((step) => step.step === 'stt')
    expect(sttSteps).toHaveLength(4)
    expect(sttSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'elevenlabs:scribe_v2',
      'assemblyai:universal-2',
      'speechmatics:enhanced',
      'rev:machine'
    ])
  })
})

describe('computeActualCosts extract routing', () => {
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
          ocrModel: 'mistral-ocr-latest'
        }
      ]
    })

    const extractSteps = result.steps.filter((step) => step.step === 'extract')
    expect(extractSteps).toHaveLength(2)
    expect(extractSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'ocrmypdf:ocrmypdf',
      'mistral:mistral-ocr-latest'
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
          ocrModel: 'mistral-ocr-latest'
        }
      ]
    })

    const extractSteps = result.steps.filter((step) => step.step === 'extract')
    expect(extractSteps).toHaveLength(2)
    expect(extractSteps.map((step) => `${step.provider}:${step.model}`)).toEqual([
      'paddle-ocr:paddle-ocr',
      'mistral:mistral-ocr-latest'
    ])
  })
})
