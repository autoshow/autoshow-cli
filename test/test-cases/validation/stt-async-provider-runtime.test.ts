import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runAssemblyAiTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/gladia/run-gladia-stt'
import { runRevStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/rev/run-rev-stt'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'
import { readProviderCheckpointMetadata } from '../../test-utils/manifest-helpers'
import {
  createTempOutputTracker,
  installNoopSleep,
  restoreSleep,
  snapshotEnv
} from '../../test-utils/stt-runtime-helpers'

const originalFetch = globalThis.fetch
const originalBunSleep = Bun.sleep
const restoreEnv = snapshotEnv([
  'ASSEMBLYAI_API_KEY',
  'ASSEMBLYAI_BASE_URL',
  'GLADIA_API_KEY',
  'GLADIA_BASE_URL',
  'REVAI_ACCESS_TOKEN',
  'REVAI_BASE_URL',
  'SONIOX_API_KEY',
  'SONIOX_BASE_URL',
  'SPEECHMATICS_API_KEY',
  'SPEECHMATICS_BASE_URL'
] as const)
const tempOutput = createTempOutputTracker()

beforeEach(() => {
  installNoopSleep()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreSleep(originalBunSleep)
  restoreEnv()
  await tempOutput.cleanup()
})

describe('runAssemblyAiTranscribe', () => {
  test('retries a transient upload failure and completes successfully', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-assemblyai-stt-')
    process.env['ASSEMBLYAI_API_KEY'] = 'test-key'
    process.env['ASSEMBLYAI_BASE_URL'] = 'https://assemblyai.test'

    let uploadAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://assemblyai.test/v2/upload') {
        uploadAttempts += 1
        if (uploadAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.test/audio.wav' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://assemblyai.test/v2/transcript' && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'tx-123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://assemblyai.test/v2/transcript/tx-123' && init?.method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-123',
          status: 'completed',
          text: 'Hello world',
          utterances: [
            {
              confidence: 0.9,
              start: 0,
              end: 900,
              text: 'Hello world',
              speaker: 'A'
            }
          ]
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-3-pro',
      segmentOffsetMinutes: 0
    })

    expect(uploadAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(result.text).toBe('Hello world')
    expect(metadata.transcriptionService).toBe('assemblyai')
    expect(metadata.transcriptionModel).toBe('universal-3-pro')
  })
})

describe('runGladiaStt', () => {
  test('retries a transient upload failure and completes successfully', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-gladia-stt-')
    process.env['GLADIA_API_KEY'] = 'test-key'
    process.env['GLADIA_BASE_URL'] = 'https://gladia.test'

    let uploadAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://gladia.test/v2/upload') {
        uploadAttempts += 1
        if (uploadAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({
          audio_url: 'https://cdn.gladia.test/audio.wav',
          audio_metadata: {
            id: 'asset-123',
            filename: 'sample.wav',
            extension: 'wav',
            size: 2048,
            audio_duration: 3.2,
            number_of_channels: 1
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://gladia.test/v2/pre-recorded' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          id: 'tx-123',
          result_url: 'https://gladia.test/v2/pre-recorded/tx-123'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://gladia.test/v2/pre-recorded/tx-123' && init?.method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-123',
          status: 'done',
          result: {
            transcription: {
              full_transcript: 'Hello world',
              utterances: [
                {
                  start: 0,
                  end: 0.9,
                  confidence: 0.9,
                  text: 'Hello world',
                  speaker: 1,
                  words: [
                    {
                      start: 0,
                      end: 0.4,
                      confidence: 0.95,
                      word: 'Hello'
                    },
                    {
                      start: 0.41,
                      end: 0.9,
                      confidence: 0.94,
                      word: 'world'
                    }
                  ]
                }
              ]
            }
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runGladiaStt(audioPath, outputDir, {
      model: 'default',
      segmentOffsetMinutes: 0
    })

    expect(uploadAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(result.text).toBe('Hello world')
    expect(metadata.transcriptionService).toBe('gladia')
    expect(metadata.transcriptionModel).toBe('default')
  })
})

describe('runSonioxStt', () => {
  test('uploads, polls, normalizes diarized transcript tokens, and cleans up remote resources', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-soniox-stt-')
    process.env['SONIOX_API_KEY'] = 'test-key'
    process.env['SONIOX_BASE_URL'] = 'https://soniox.test'

    const deleteCalls: string[] = []
    let pollAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://soniox.test/v1/files' && method === 'POST') {
        expect(init?.body).toBeInstanceOf(FormData)
        const body = init?.body as FormData
        expect(body.get('file')).toBeTruthy()
        return new Response(JSON.stringify({ id: 'file-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
        expect(typeof init?.body).toBe('string')
        expect(JSON.parse(String(init?.body))).toEqual({
          model: 'stt-async-v4',
          file_id: 'file-1',
          enable_speaker_diarization: true
        })
        return new Response(JSON.stringify({ id: 'tx-1', status: 'queued' }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions/tx-1' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-1',
          status: pollAttempts === 1 ? 'processing' : 'completed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions/tx-1/transcript' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'tx-1',
          text: 'Hello there. General Kenobi.',
          tokens: [
            { text: 'Hello there.', start_ms: 0, end_ms: 1200, speaker: 0, confidence: 0.95, language: null, translation_status: null },
            { text: ' General Kenobi.', start_ms: 1300, end_ms: 2500, speaker: 1, confidence: 0.98, is_audio_event: null }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (method === 'DELETE') {
        deleteCalls.push(url)
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runSonioxStt(audioPath, outputDir, {
      model: 'stt-async-v4',
      segmentOffsetMinutes: 0,
      diarizationOptions: { enabled: true }
    })

    expect(pollAttempts).toBe(2)
    expect(result.text).toBe('Hello there. General Kenobi.')
    expect(result.segments).toEqual([
      {
        start: '00:00:00',
        end: '00:00:01',
        text: 'Hello there.',
        speaker: 'speaker-0'
      },
      {
        start: '00:00:01',
        end: '00:00:02',
        text: 'General Kenobi.',
        speaker: 'speaker-1'
      }
    ])
    expect(metadata.transcriptionService).toBe('soniox')
    expect(metadata.transcriptionModel).toBe('stt-async-v4')

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toContain('[speaker-0] Hello there.')
    expect(transcript).toContain('[speaker-1] General Kenobi.')
    expect(deleteCalls).toEqual([
      'https://soniox.test/v1/transcriptions/tx-1',
      'https://soniox.test/v1/files/file-1'
    ])
  })

  test('fails immediately on non-retryable create errors and still cleans up uploaded files', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-soniox-stt-')
    process.env['SONIOX_API_KEY'] = 'test-key'
    process.env['SONIOX_BASE_URL'] = 'https://soniox.test'

    let createAttempts = 0
    const deleteCalls: string[] = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://soniox.test/v1/files' && method === 'POST') {
        return new Response(JSON.stringify({ id: 'file-2' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
        createAttempts += 1
        return new Response('invalid request', {
          status: 400,
          headers: { 'content-type': 'text/plain' }
        })
      }

      if (url === 'https://soniox.test/v1/files/file-2' && method === 'DELETE') {
        deleteCalls.push(url)
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(runSonioxStt(audioPath, outputDir, {
      model: 'stt-async-v4',
      segmentOffsetMinutes: 0,
      diarizationOptions: { enabled: true }
    })).rejects.toThrow('Soniox create failed (400): invalid request')

    expect(createAttempts).toBe(1)
    expect(deleteCalls).toEqual(['https://soniox.test/v1/files/file-2'])
  })
})

describe('runSpeechmaticsStt', () => {
  test('retries a transient create failure, parses speaker labels, and cleans up the remote job', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-speechmatics-stt-')
    process.env['SPEECHMATICS_API_KEY'] = 'test-key'
    process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'

    let createAttempts = 0
    let pollAttempts = 0
    let transcriptAttempts = 0
    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
        createAttempts += 1
        if (createAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({
          id: 'job-123'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          job: {
            id: 'job-123',
            status: 'done'
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123/transcript?format=json-v2' && method === 'GET') {
        transcriptAttempts += 1
        return new Response(JSON.stringify({
          format: '2.1',
          results: [
            { type: 'word', start_time: 0, end_time: 0.3, alternatives: [{ content: 'Hello', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 0.3, end_time: 0.3, alternatives: [{ content: ',', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'word', start_time: 0.31, end_time: 0.7, alternatives: [{ content: 'there', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 0.7, end_time: 0.7, is_eos: true, alternatives: [{ content: '.', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'word', start_time: 1.0, end_time: 1.4, alternatives: [{ content: 'Unknown', speaker: 'UU', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 1.4, end_time: 1.4, is_eos: true, alternatives: [{ content: '.', speaker: 'UU', confidence: 0.99, language: 'en' }] }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runSpeechmaticsStt(audioPath, outputDir, {
      model: 'enhanced',
      segmentOffsetMinutes: 0
    })

    expect(createAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(transcriptAttempts).toBe(1)
    expect(deleteAttempts).toBe(1)
    expect(result.text).toBe('Hello, there. Unknown.')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Hello, there.', speaker: 'S1' },
      { start: '00:00:01', end: '00:00:01', text: 'Unknown.', speaker: 'UU' }
    ])
    expect(metadata.transcriptionService).toBe('speechmatics')
    expect(metadata.transcriptionModel).toBe('enhanced')
    expect(metadata.runtime?.stage).toBe('cleanup-complete')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
  })

  test('cleans up a terminally rejected job and surfaces the provider error', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-speechmatics-stt-')
    process.env['SPEECHMATICS_API_KEY'] = 'test-key'
    process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-rejected'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-rejected' && method === 'GET') {
        return new Response(JSON.stringify({
          job: {
            id: 'job-rejected',
            status: 'rejected',
            errors: [
              { message: 'Unsupported model for this account' }
            ]
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-rejected' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runSpeechmaticsStt(audioPath, outputDir, {
        model: 'enhanced',
        segmentOffsetMinutes: 0
      })
    ).rejects.toThrow('Unsupported model for this account')

    expect(deleteAttempts).toBe(1)
  })
})

describe('runRevStt', () => {
  test('retries transient create and poll failures, normalizes transcript monologues, and records cleanup metadata', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-rev-stt-')
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let createAttempts = 0
    let pollAttempts = 0
    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        createAttempts += 1
        if (createAttempts === 1) {
          return new Response('throttled', { status: 429, headers: { 'retry-after': '0' } })
        }
        if (createAttempts === 2) {
          return new Response('bad gateway', { status: 502, headers: { 'retry-after': '0' } })
        }
        if (createAttempts === 3) {
          return new Response('unavailable', { status: 503, headers: { 'retry-after': '0' } })
        }

        expect(init?.body).toBeInstanceOf(FormData)
        const body = init?.body as FormData
        expect(body.get('media')).toBeTruthy()
        expect(JSON.parse(String(body.get('options')))).toEqual({
          transcriber: 'machine',
          remove_disfluencies: true
        })

        return new Response(JSON.stringify({
          id: 'job-123',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-123' && method === 'GET') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return new Response('bad gateway', { status: 502, headers: { 'retry-after': '0' } })
        }

        return new Response(JSON.stringify({
          id: 'job-123',
          status: 'transcribed'
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      if (url === 'https://rev.test/jobs/job-123/transcript' && method === 'GET') {
        expect(init?.headers).toEqual(expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/vnd.rev.transcript.v1.0+json'
        }))

        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Hello', ts: 0, end_ts: 0.3 },
                { type: 'punct', value: ',' },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'there', ts: 0.31, end_ts: 0.7 },
                { type: 'punct', value: '.' }
              ]
            },
            {
              speaker: 1,
              elements: []
            },
            {
              speaker: 2,
              elements: [
                { type: 'text', value: 'General', ts: 1.0, end_ts: 1.4 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'Kenobi', ts: 1.41, end_ts: 1.9 },
                { type: 'punct', value: '!' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-123' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'machine',
      segmentOffsetMinutes: 0
    })

    expect(createAttempts).toBe(4)
    expect(pollAttempts).toBe(2)
    expect(deleteAttempts).toBe(1)
    expect(result.text).toBe('Hello, there. General Kenobi!')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Hello, there.', speaker: 'speaker-0' },
      { start: '00:00:01', end: '00:00:01', text: 'General Kenobi!', speaker: 'speaker-2' }
    ])
    expect(metadata.transcriptionService).toBe('rev')
    expect(metadata.transcriptionModel).toBe('machine')
    expect(metadata.runtime?.stage).toBe('cleanup-complete')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(metadata.timings?.retryCount).toBeGreaterThan(0)

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toContain('[speaker-0] Hello, there.')
    expect(transcript).toContain('[speaker-2] General Kenobi!')
  })

  test('sends low_cost to the Rev transcriber when requested', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-rev-stt-')
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        expect(init?.body).toBeInstanceOf(FormData)
        const body = init?.body as FormData
        expect(JSON.parse(String(body.get('options')))).toEqual({
          transcriber: 'low_cost',
          remove_disfluencies: true
        })

        return new Response(JSON.stringify({
          id: 'job-low-cost',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-low-cost',
          status: 'transcribed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost/transcript' && method === 'GET') {
        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Turbo', ts: 0, end_ts: 0.4 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'mode', ts: 0.41, end_ts: 0.8 },
                { type: 'punct', value: '.' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'low_cost',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('Turbo mode.')
    expect(metadata.transcriptionService).toBe('rev')
    expect(metadata.transcriptionModel).toBe('low_cost')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(deleteAttempts).toBe(1)
  })

  test('uses the default Rev API base path when REVAI_BASE_URL is unset', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-rev-stt-')
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    delete process.env['REVAI_BASE_URL']

    const requests: string[] = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push(`${method} ${url}`)

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-default',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-default',
          status: 'transcribed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default/transcript' && method === 'GET') {
        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Default', ts: 0, end_ts: 0.3 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'base', ts: 0.31, end_ts: 0.6 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'works', ts: 0.61, end_ts: 1.0 },
                { type: 'punct', value: '.' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'machine',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('Default base works.')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(requests).toEqual([
      'POST https://api.rev.ai/speechtotext/v1/jobs',
      'GET https://api.rev.ai/speechtotext/v1/jobs/job-default',
      'GET https://api.rev.ai/speechtotext/v1/jobs/job-default/transcript',
      'DELETE https://api.rev.ai/speechtotext/v1/jobs/job-default'
    ])
  })

  test('cleans up a terminally failed job and persists cleanup metadata', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-rev-stt-')
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-failed',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-failed' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-failed',
          status: 'failed',
          failure: 'download_failure',
          failure_detail: 'Source media could not be processed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-failed' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runRevStt(audioPath, outputDir, {
        model: 'machine',
        segmentOffsetMinutes: 0
      })
    ).rejects.toThrow('Source media could not be processed')

    expect(deleteAttempts).toBe(1)

    const metadata = await readProviderCheckpointMetadata(outputDir)
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      stage: 'cleanup-complete',
      remoteJobId: 'job-failed',
      cleanup: expect.objectContaining({
        remoteJobDeleted: true
      })
    }))
  })
})
