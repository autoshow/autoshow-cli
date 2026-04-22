import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import {
  readRunMetadata,
  writeProviderResultFixture,
  writeRunManifestFixture
} from '../../test-utils/manifest-helpers'

const cleanupPaths = new Set<string>()

afterEach(async () => {
  for (const path of cleanupPaths) {
    await rm(path, { recursive: true, force: true }).catch(() => {})
  }
  cleanupPaths.clear()
})

const startSonioxResumeServer = async () => {
  const audioBytes = await Bun.file(STABLE_LOCAL_AUDIO_PATH).bytes()
  const state = {
    uploadCalls: 0,
    createCalls: 0,
    statusCalls: 0,
    transcriptCalls: 0
  }

  const server = createServer((req, res) => {
    const url = req.url ?? ''
    const method = req.method ?? 'GET'

    if (url === '/v1/files' && method === 'POST') {
      state.uploadCalls += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: `file-${state.uploadCalls}` }))
      return
    }

    if (url === '/v1/transcriptions' && method === 'POST') {
      state.createCalls += 1
      res.statusCode = 201
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: `tx-${state.createCalls}`, status: 'queued' }))
      return
    }

    const statusMatch = url.match(/^\/v1\/transcriptions\/(tx-\d+)$/)
    if (statusMatch && method === 'GET') {
      state.statusCalls += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: statusMatch[1], status: 'completed' }))
      return
    }

    const transcriptMatch = url.match(/^\/v1\/transcriptions\/(tx-\d+)\/transcript$/)
    if (transcriptMatch && method === 'GET') {
      state.transcriptCalls += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: transcriptMatch[1],
        text: 'Recovered Soniox transcript.',
        tokens: [
          { text: 'Recovered Soniox transcript.', start_ms: 0, end_ms: 1000, speaker: 0 }
        ]
      }))
      return
    }

    if ((url.startsWith('/v1/transcriptions/') || url.startsWith('/v1/files/')) && method === 'DELETE') {
      res.statusCode = 204
      res.end()
      return
    }

    if (url === '/audio' && method === 'GET') {
      res.statusCode = 200
      res.setHeader('content-type', 'audio/mpeg')
      res.end(Buffer.from(audioBytes))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine Soniox resume test server port')
  }

  return {
    server,
    state,
    baseUrl: `http://127.0.0.1:${address.port}`
  }
}

const stopServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error)
        return
      }
      resolveClose()
    })
  })
}

const buildBaseStep1 = () => ({
  title: 'resume-command-test',
  duration: '00:00:10',
  author: 'Local',
  description: '',
  url: `file://${resolve(STABLE_LOCAL_AUDIO_PATH)}`,
  slug: 'resume-command-test',
  audioFileName: 'resume-command-test.mp3',
  audioFileSize: 1234
})

test('resume accepts an explicit single STT output directory and reruns missing providers in place', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-single-'))
  cleanupPaths.add(tempDir)

  const cliEntry = resolve('src/cli/create-cli.ts')
  const outputRoot = join(tempDir, 'output')
  const outputDir = join(outputRoot, '2026-04-22_09-00-00-000_resume-single')
  await mkdir(outputDir, { recursive: true })

  await writeRunManifestFixture(outputDir, 'stt', {
    step1: buildBaseStep1(),
    step2: [],
    completionStatus: 'failed',
    requestedProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        artifactDir: '.',
        status: 'failed',
        attempts: 1,
        retryable: true,
        lastError: {
          message: 'temporary failure',
          retryable: true
        }
      }
    ],
    missingProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    errors: [
      {
        service: 'soniox',
        model: 'stt-async-v4',
        message: 'temporary failure',
        retryable: true
      }
    ]
  })

  const { server, state, baseUrl } = await startSonioxResumeServer()
  try {
    const resumed = await runCommand([
      cliEntry,
      'resume',
      outputDir,
      '--soniox-stt',
      'stt-async-v4',
      '--no-cache'
    ], {
      testName: 'resume explicit single stt output dir',
      cwd: tempDir,
      env: {
        SONIOX_API_KEY: 'soniox-test-key',
        SONIOX_BASE_URL: baseUrl
      }
    })

    expect(resumed.exitCode).toBe(0)
    expect(state.uploadCalls).toBe(1)
    expect(state.createCalls).toBe(1)
    expect(state.statusCalls).toBeGreaterThanOrEqual(1)
    expect(state.transcriptCalls).toBe(1)

    const updatedMetadata = await readRunMetadata(outputDir)
    expect(updatedMetadata['completionStatus']).toBe('full')
    expect(updatedMetadata['missingProviders']).toEqual([])
    expect((updatedMetadata['step2'] as Record<string, unknown>)['transcriptionService']).toBe('soniox')
    expect(await Bun.file(join(outputDir, 'transcription.txt')).exists()).toBe(true)
  } finally {
    await stopServer(server)
  }
})

test('resume auto-discovers the newest resumable STT output under ./output', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-auto-'))
  cleanupPaths.add(tempDir)

  const cliEntry = resolve('src/cli/create-cli.ts')
  const outputRoot = join(tempDir, 'output')
  const resumableOutputDir = join(outputRoot, '2026-04-21_09-00-00-000_resume-me')
  const fullOutputDir = join(outputRoot, '2026-04-22_09-00-00-000_already-full')
  const mistralDir = join(resumableOutputDir, 'providers', 'mistral-voxtral-mini-2602')

  await mkdir(mistralDir, { recursive: true })
  await mkdir(fullOutputDir, { recursive: true })

  await writeProviderResultFixture(mistralDir, 'mistral', 'voxtral-mini-2602', {
    transcriptionService: 'mistral',
    transcriptionModel: 'voxtral-mini-2602',
    processingTime: 100,
    tokenCount: 3
  }, {
    text: 'Existing Mistral transcript'
  })

  await writeRunManifestFixture(resumableOutputDir, 'stt', {
    step1: buildBaseStep1(),
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-2602',
        processingTime: 100,
        tokenCount: 3
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        artifactDir: 'providers/mistral-voxtral-mini-2602',
        status: 'succeeded',
        attempts: 1
      },
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        artifactDir: 'providers/soniox-stt-async-v4',
        status: 'failed',
        attempts: 1,
        retryable: true,
        lastError: {
          message: 'temporary failure',
          retryable: true
        }
      }
    ],
    missingProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    errors: [
      {
        service: 'soniox',
        model: 'stt-async-v4',
        message: 'temporary failure',
        retryable: true
      }
    ]
  })

  await writeRunManifestFixture(fullOutputDir, 'stt', {
    step1: {
      ...buildBaseStep1(),
      title: 'already-full'
    },
    step2: {
      transcriptionService: 'soniox',
      transcriptionModel: 'stt-async-v4',
      processingTime: 100,
      tokenCount: 3
    },
    completionStatus: 'full',
    requestedProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1
      }
    ],
    missingProviders: []
  })

  const { server, baseUrl } = await startSonioxResumeServer()
  try {
    const resumed = await runCommand([
      cliEntry,
      'resume',
      '--soniox-stt',
      'stt-async-v4',
      '--no-cache'
    ], {
      testName: 'resume auto-discovery single stt output',
      cwd: tempDir,
      env: {
        SONIOX_API_KEY: 'soniox-test-key',
        SONIOX_BASE_URL: baseUrl
      }
    })

    expect(resumed.exitCode).toBe(0)
    expect(`${resumed.stdout}\n${resumed.stderr}`).toContain('Auto-discovered resumable STT output')
    expect(`${resumed.stdout}\n${resumed.stderr}`).toContain('resumeOutput')

    const updatedMetadata = await readRunMetadata(resumableOutputDir)
    expect(updatedMetadata['completionStatus']).toBe('full')
    expect(updatedMetadata['missingProviders']).toEqual([])
    expect(Array.isArray(updatedMetadata['step2'])).toBe(true)
    expect((updatedMetadata['step2'] as unknown[])).toHaveLength(2)
    expect(await Bun.file(join(resumableOutputDir, 'providers', 'soniox-stt-async-v4', 'transcription.txt')).exists()).toBe(true)
  } finally {
    await stopServer(server)
  }
})
