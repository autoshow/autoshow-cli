import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/soniox/run-soniox-stt'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['SONIOX_API_KEY']
const originalBaseUrl = process.env['SONIOX_BASE_URL']
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-soniox-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) {
    delete process.env['SONIOX_API_KEY']
  } else {
    process.env['SONIOX_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['SONIOX_BASE_URL']
  } else {
    process.env['SONIOX_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runSonioxStt', () => {
  test('uploads, polls, normalizes diarized transcript tokens, and cleans up remote resources', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
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
            { text: 'Hello there.', start_ms: 0, end_ms: 1200, speaker: 0, confidence: 0.95 },
            { text: ' General Kenobi.', start_ms: 1300, end_ms: 2500, speaker: 1, confidence: 0.98 }
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
    const { audioPath, outputDir } = await createAudioFixture()
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
