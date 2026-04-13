import { describe, expect, test } from 'bun:test'
import type { AggregatedPriceEstimate, RuntimeOptions } from '~/types'
import { buildExpectedFilesList, shouldRunCommandPreflight } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import {
  classifySttProviderFailure,
  filterEstimatedSttCosts,
  filterSttPreflightEstimate,
  prioritizeCloudSttTargetIndices,
  selectPrimaryPromptProvider,
} from '~/cli/commands/process-steps/process-stt'
import type { SttTarget } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { getSttEstimation } from '~/cli/commands/models/model-loader'

describe('STT runtime helpers', () => {
  test('skips command preflight when neither --price nor budget is active', () => {
    expect(shouldRunCommandPreflight({ price: false }, undefined)).toBe(false)
    expect(shouldRunCommandPreflight({ price: true }, undefined)).toBe(true)
    expect(shouldRunCommandPreflight({ price: false }, 25)).toBe(true)
  })

  test('advertises prompt.md for multi-provider STT outputs', () => {
    expect(buildExpectedFilesList('stt', {
      whisperExplicit: false,
      whisperModel: 'tiny',
      useReverb: false,
      elevenlabsSttModel: 'scribe_v2',
      mistralSttModel: 'voxtral-mini-latest'
    } as RuntimeOptions)).toEqual([
      'Shared audio artifact(s)',
      'providers/<service>-<model>/transcription.txt',
      'prompt.md',
      'metadata.json'
    ])
  })

  test('filters preflight estimates down to STT steps only', () => {
    const estimate: AggregatedPriceEstimate = {
      totalEstimatedCost: 65,
      steps: [
        { step: 'stt', provider: 'mistral', model: 'voxtral-mini-latest', durationSeconds: 60, totalCost: 10, costMultiplier: 1 },
        { step: 'video', provider: 'gemini', model: 'veo-3.1-fast-generate-preview', totalCost: 55, costMultiplier: 1 }
      ]
    }

    expect(filterSttPreflightEstimate(estimate)).toEqual({
      totalEstimatedCost: 10,
      steps: [
        { step: 'stt', provider: 'mistral', model: 'voxtral-mini-latest', durationSeconds: 60, totalCost: 10, costMultiplier: 1 }
      ]
    })
  })

  test('filters estimated STT costs down to STT steps only', () => {
    expect(filterEstimatedSttCosts({
      totalCost: 65,
      steps: [
        { step: 'stt', provider: 'mistral', model: 'voxtral-mini-latest', cost: 10, costMultiplier: 1, durationSeconds: 60 },
        { step: 'video', provider: 'gemini', model: 'veo-3.1-fast-generate-preview', cost: 55, costMultiplier: 1 }
      ]
    })).toEqual({
      totalCost: 10,
      steps: [
        { step: 'stt', provider: 'mistral', model: 'voxtral-mini-latest', cost: 10, costMultiplier: 1, durationSeconds: 60 }
      ]
    })
  })

  test('prioritizes AssemblyAI first among cloud STT targets and excludes local targets', () => {
    const targets: SttTarget[] = [
      { service: 'mistral', model: 'voxtral-mini-latest', local: false },
      { service: 'whisper', model: 'tiny', local: true },
      { service: 'elevenlabs', model: 'scribe_v2', local: false },
      { service: 'assemblyai', model: 'universal-3-pro', local: false }
    ]

    const ordered = prioritizeCloudSttTargetIndices(targets)

    expect(ordered).toHaveLength(3)
    expect(ordered[0]).toBe(3)
    expect(ordered.includes(1)).toBe(false)

    const trailing = ordered.slice(1).map((index) => targets[index] as SttTarget)
    expect(trailing).toHaveLength(2)
    expect(getSttEstimation(trailing[0]!.service, trailing[0]!.model).msPerSecond).toBeGreaterThanOrEqual(
      getSttEstimation(trailing[1]!.service, trailing[1]!.model).msPerSecond
    )
  })

  test('selects the first successful provider in target order for the root prompt', () => {
    const selected = selectPrimaryPromptProvider([
      undefined,
      {
        target: { service: 'mistral', model: 'voxtral-mini-latest', local: false },
        metadata: {
          transcriptionService: 'mistral',
          transcriptionModel: 'voxtral-mini-latest',
          transcriptionModelName: 'voxtral-mini-latest',
          processingTime: 123,
          tokenCount: 10
        },
        result: {
          text: 'second provider transcript',
          segments: [{ start: '00:00:00', end: '00:00:01', text: 'second provider transcript' }]
        }
      },
      {
        target: { service: 'assemblyai', model: 'universal-3-pro', local: false },
        metadata: {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'universal-3-pro',
          transcriptionModelName: 'universal-3-pro',
          processingTime: 99,
          tokenCount: 8
        },
        result: {
          text: 'later provider transcript',
          segments: [{ start: '00:00:00', end: '00:00:01', text: 'later provider transcript' }]
        }
      }
    ])

    expect(selected?.metadata.transcriptionService).toBe('mistral')
    expect(selected?.result.text).toBe('second provider transcript')
  })

  test('prefers a successful provider that honored the requested diarization hint for the root prompt', () => {
    const selected = selectPrimaryPromptProvider([
      {
        target: { service: 'mistral', model: 'voxtral-mini-latest', local: false, diarizationOptions: { enabled: true } },
        metadata: {
          transcriptionService: 'mistral',
          transcriptionModel: 'voxtral-mini-latest',
          transcriptionModelName: 'voxtral-mini-latest',
          processingTime: 123,
          tokenCount: 10
        },
        result: {
          text: 'first provider transcript',
          segments: [{ start: '00:00:00', end: '00:00:01', text: 'first provider transcript', speaker: 'speaker-1' }]
        }
      },
      {
        target: { service: 'assemblyai', model: 'universal-3-pro', local: false, diarizationOptions: { enabled: true, speakerCount: 2 } },
        metadata: {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'universal-3-pro',
          transcriptionModelName: 'universal-3-pro',
          processingTime: 99,
          tokenCount: 8
        },
        result: {
          text: 'later provider transcript',
          segments: [{ start: '00:00:00', end: '00:00:01', text: 'later provider transcript', speaker: 'speaker-1' }]
        }
      }
    ])

    expect(selected?.metadata.transcriptionService).toBe('assemblyai')
    expect(selected?.result.text).toBe('later provider transcript')
  })

  test('classifies retryable STT provider failures with status metadata', () => {
    const failure = classifySttProviderFailure(Object.assign(
      new Error('AssemblyAI upload failed (503): unavailable'),
      {
        status: 503,
        headers: new Headers({ 'retry-after': '0' }),
        stage: 'upload',
        retryClass: 'runtime_http_create_conservative'
      }
    ))

    expect(failure.retryable).toBe(true)
    expect(failure.stage).toBe('upload')
    expect(failure.status).toBe(503)
  })

  test('classifies non-retryable STT provider failures with status metadata', () => {
    const failure = classifySttProviderFailure(Object.assign(
      new Error('Mistral transcription failed (400): bad request'),
      {
        status: 400,
        headers: new Headers(),
        stage: 'transcribe',
        retryClass: 'runtime_http_create_conservative'
      }
    ))

    expect(failure.retryable).toBe(false)
    expect(failure.stage).toBe('transcribe')
    expect(failure.status).toBe(400)
  })

  test('treats conservative timeout failures as retryable for STT providers', () => {
    const failure = classifySttProviderFailure(Object.assign(
      new Error('elevenlabs-stt failed after 4 attempts (1200ms elapsed)'),
      {
        stage: 'transcribe',
        retryClass: 'runtime_http_create_conservative',
        cause: new DOMException('signal aborted', 'AbortError')
      }
    ))

    expect(failure.retryable).toBe(true)
    expect(failure.stage).toBe('transcribe')
    expect(failure.message).toContain('failed after 4 attempts')
  })
})
