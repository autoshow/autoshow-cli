import { describe, expect, test } from 'bun:test'
import { parseDurationToSeconds, computeEstimatedCosts, computeActualCosts } from '~/utils/pricing/compute-costs'

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

  test('openaiSttModel routes to openai', () => {
    const result = computeEstimatedCosts({ openaiSttModel: 'gpt-4o-mini-transcribe', audioDurationSeconds: 60 })
    expect(result.steps[0]?.provider).toBe('openai')
    expect(result.steps[0]?.model).toBe('gpt-4o-mini-transcribe')
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
        transcriptionService: 'whisper',
        transcriptionModel: 'large-v3-turbo',
        transcriptionModelName: 'large-v3-turbo',
        processingTime: 5000,
        tokenCount: 150
      }
    })
    const sttStep = result.steps.find(s => s.step === 'stt')
    expect(sttStep).toBeDefined()
    expect(sttStep?.provider).toBe('whisper')
    expect(sttStep?.model).toBe('large-v3-turbo')
    expect(typeof sttStep?.cost).toBe('number')
  })
})
