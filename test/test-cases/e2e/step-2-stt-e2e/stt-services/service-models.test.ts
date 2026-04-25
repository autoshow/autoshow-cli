import { createServer, type IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from 'bun:test'
import { defineSTTServiceTest } from '../../../../test-utils/define-stt-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  hasConfiguredEnvVar,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const readBodyText = async (request: IncomingMessage): Promise<string> => {
  let body = ''
  for await (const chunk of request) {
    body += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  }
  return body
}

const startDeapiStubServer = async (): Promise<{
  server: ReturnType<typeof createServer>
  baseUrl: string
  state: {
    priceBodies: string[]
    uploadBodies: string[]
    pollCount: number
  }
}> => {
  const state = {
    priceBodies: [] as string[],
    uploadBodies: [] as string[],
    pollCount: 0
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/api/v1/client/transcribe/price-calculation') {
      state.priceBodies.push(await readBodyText(req))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: { price: 0.0175 } }))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/client/audiofile2txt') {
      state.uploadBodies.push(await readBodyText(req))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ request_id: 'req-local-123' }))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/client/request-status/req-local-123') {
      state.pollCount += 1
      res.writeHead(200, {
        'content-type': 'application/json',
        'retry-after': '0'
      })
      res.end(JSON.stringify({
        status: 'completed',
        result: {
          text: 'Local deAPI transcript',
          segments: [
            { start: 0, end: 1.2, text: 'Local deAPI transcript' }
          ]
        }
      }))
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: `${req.method} ${url.pathname} not stubbed` }))
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve deAPI stub server address')
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    state
  }
}

const stopServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

defineSTTServiceTest({
  models: ['universal-3-pro'],
  cliFlag: '--assemblyai-stt',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
})

defineSTTServiceTest({
  models: ['nova-3'],
  cliFlag: '--deepgram-stt',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  cliFlag: '--deepinfra-stt',
  sttService: 'deepinfra',
  envVarKey: 'DEEPINFRA_API_KEY',
  envVarDescription: 'DeepInfra transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3'],
  cliFlag: '--together-stt',
  sttService: 'together',
  envVarKey: 'TOGETHER_API_KEY',
  envVarDescription: 'Together transcription',
})

defineSTTServiceTest({
  models: ['WhisperLargeV3'],
  cliFlag: '--deapi-stt',
  sttService: 'deapi',
  envVarKey: 'DEAPI_API_KEY',
  envVarDescription: 'deAPI transcription',
})

defineSTTServiceTest({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs-stt',
  sttService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs transcription',
})

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia-stt',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})

defineSTTServiceTest({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq-stt',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
})

defineSTTServiceTest({
  models: ['whisper-v3-turbo', 'whisper-v3'],
  cliFlag: '--fireworks-stt',
  sttService: 'fireworks',
  envVarKey: 'FIREWORKS_API_KEY',
  envVarDescription: 'Fireworks transcription',
})

defineSTTServiceTest({
  models: ['whisper-large-v3-turbo', 'whisper'],
  cliFlag: '--cloudflare-stt',
  sttService: 'cloudflare',
  envVarKey: 'CLOUDFLARE_API_TOKEN',
  extraEnvVarKeys: ['CLOUDFLARE_ACCOUNT_ID'],
  envVarDescription: 'Cloudflare transcription',
})

defineSTTServiceTest({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral-stt',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
})

defineSTTServiceTest({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev-stt',
  sttService: 'rev',
  envVarKey: 'REVAI_ACCESS_TOKEN',
  envVarDescription: 'Rev transcription',
  timeoutMs: 90_000,
})

defineSTTServiceTest({
  models: ['stt-async-v4'],
  cliFlag: '--soniox-stt',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
})

defineSTTServiceTest({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics-stt',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
  timeoutMs: 30_000,
})

test('deapi --price uses the exact pricing endpoint for local audio', async () => {
  const { server, baseUrl, state } = await startDeapiStubServer()

  try {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_LOCAL_AUDIO_PATH,
      '--deapi-stt',
      'WhisperLargeV3',
      '--price'
    ], {
      env: {
        DEAPI_API_KEY: 'test-key',
        DEAPI_BASE_URL: baseUrl
      }
    })

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('deapi')
    expect(`${result.stdout}\n${result.stderr}`).toContain('WhisperLargeV3')
    expect(state.priceBodies).toHaveLength(1)
    expect(state.priceBodies[0]).toContain('name="duration_seconds"')
    expect(state.priceBodies[0]).toContain('name="model"')
    expect(state.priceBodies[0]).toContain('WhisperLargeV3')
    expect(state.priceBodies[0]).not.toContain('name="source_url"')
  } finally {
    await stopServer(server)
  }
}, 30_000)

test('deapi run manifest records exact estimated and actual STT cost fields', async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  const { server, baseUrl, state } = await startDeapiStubServer()
  const configDir = await mkdtemp(join(tmpdir(), 'autoshow-deapi-config-'))
  const configPath = join(configDir, 'autoshow.json')
  await Bun.write(configPath, `${JSON.stringify({
    version: 2,
    pricing: { maxCents: 100 }
  }, null, 2)}\n`)

  try {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_LOCAL_AUDIO_PATH,
      '--deapi-stt',
      'WhisperLargeV3',
      '--config-path',
      configPath
    ], {
      env: {
        DEAPI_API_KEY: 'test-key',
        DEAPI_BASE_URL: baseUrl
      }
    })

    expect(result.exitCode).toBe(0)
    expect(state.priceBodies).toHaveLength(2)
    expect(state.uploadBodies).toHaveLength(1)
    expect(state.uploadBodies[0]).toContain('name="audio"')
    expect(state.uploadBodies[0]).toContain('name="return_result_in_response"')
    expect(state.pollCount).toBe(1)

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()
    if (!outputDir) {
      throw new Error('Expected deAPI output directory')
    }

    const metadata = await readRunMetadata(outputDir)
    const step2 = isRecord(metadata['step2']) ? metadata['step2'] : null
    const cost = isRecord(metadata['cost']) ? metadata['cost'] : null
    const estimated = cost && isRecord(cost['estimated']) ? cost['estimated'] : null
    const actual = cost && isRecord(cost['actual']) ? cost['actual'] : null
    const estimatedSttStep = toRecordArray(estimated?.['steps']).find((step) => step['step'] === 'stt')
    const actualSttStep = toRecordArray(actual?.['steps']).find((step) => step['step'] === 'stt')

    expect(step2).toEqual(expect.objectContaining({
      transcriptionService: 'deapi',
      transcriptionModel: 'WhisperLargeV3',
      billing: expect.objectContaining({
        source: 'provider_quote',
        mode: 'duration'
      })
    }))
    expect(((step2?.['billing'] as Record<string, unknown> | undefined)?.['totalCost']) as number).toBeCloseTo(1.75, 8)
    expect(estimated?.['totalCost']).toBeCloseTo(1.75, 8)
    expect(actual?.['totalCost']).toBeCloseTo(1.75, 8)
    expect(estimatedSttStep).toEqual(expect.objectContaining({
      provider: 'deapi',
      model: 'WhisperLargeV3',
      estimateType: 'exact'
    }))
    expect((estimatedSttStep?.['cost']) as number).toBeCloseTo(1.75, 8)
    expect(actualSttStep).toEqual(expect.objectContaining({
      provider: 'deapi',
      model: 'WhisperLargeV3'
    }))
    expect((actualSttStep?.['cost']) as number).toBeCloseTo(1.75, 8)
  } finally {
    await stopServer(server)
    await rm(configDir, { recursive: true, force: true })
  }
}, 30_000)

test('elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  if (!await hasConfiguredEnvVar('ELEVENLABS_API_KEY')) {
    console.log('Skipping: ELEVENLABS_API_KEY is required for ElevenLabs transcription')
    return
  }

  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-stt',
    'scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionService?: string, transcriptionModel?: string }
    }
    expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
    expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
  }
}, 30_000)
