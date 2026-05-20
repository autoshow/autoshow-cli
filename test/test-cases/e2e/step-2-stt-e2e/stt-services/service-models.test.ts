import { createServer, type IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from 'bun:test'
import { defineSTTServiceTest } from '../../../../test-utils/define-stt-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
  SHORT_LOCAL_AUDIO_PATH,
  SHORT_LOCAL_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar, runCommandAndExpectOutputDir } from '../../../../test-utils/service-test-kit'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const YOUTUBE_TRANSCRIPT_URL = 'https://www.youtube.com/watch?v=MORMZXEaONk'
const YOUTUBE_TRANSCRIPT_TITLE = 'MORMZXEaONk'

const findStep2Metadata = (
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Record<string, unknown> | undefined => {
  const step2 = metadata['step2']
  if (isRecord(step2)) {
    return step2
  }
  return toRecordArray(step2).find((entry) =>
    entry['transcriptionService'] === service && entry['transcriptionModel'] === model
  )
}

const resolveTranscriptArtifactDir = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Promise<string> => {
  const providerState = toRecordArray(metadata['providerStates']).find((entry) =>
    entry['service'] === service && entry['model'] === model
  )
  const artifactDir = providerState && typeof providerState['artifactDir'] === 'string'
    ? providerState['artifactDir']
    : undefined

  if (artifactDir) {
    return join(outputDir, artifactDir)
  }

  if (await fileExists(join(outputDir, 'transcription.txt'))) {
    return outputDir
  }

  return join(outputDir, 'providers', `${service}-${model}`)
}

const defineUrlTranscriptServiceTest = ({
  service,
  model,
  cliFlag,
  envVarKey,
  envVarDescription,
}: {
  service: string
  model: string
  cliFlag: string
  envVarKey: string
  envVarDescription: string
}): void => {
  const budgetKey = `transcribe-${service}-${model}`

  budgetedTest(budgetKey, `${service} ${model} retrieves YouTube URL transcript`, async () => {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

    await cleanupTestOutput(YOUTUBE_TRANSCRIPT_TITLE)

    const outputDir = await runCommandAndExpectOutputDir(YOUTUBE_TRANSCRIPT_TITLE, [
      'src/cli/create-cli.ts',
      'extract',
      YOUTUBE_TRANSCRIPT_URL,
      cliFlag,
      model
    ])

    expect(await fileExists(join(outputDir, 'run.json'))).toBe(true)

    const metadata = await readRunMetadata(outputDir)
    const step2 = findStep2Metadata(metadata, service, model)
    expect(step2?.['transcriptionService']).toBe(service)
    expect(step2?.['transcriptionModel']).toBe(model)

    const artifactDir = await resolveTranscriptArtifactDir(outputDir, metadata, service, model)
    const transcriptPath = join(artifactDir, 'transcription.txt')
    expect(await fileExists(transcriptPath)).toBe(true)
    expect((await Bun.file(transcriptPath).text()).length).toBeGreaterThan(0)
    expect(await fileExists(join(artifactDir, 'result.json'))).toBe(true)
  }, E2E_TEST_TIMEOUT_MS)
}

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
  cliFlag: '--assemblyai',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
})

defineSTTServiceTest({
  models: ['nova-3'],
  cliFlag: '--deepgram',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  cliFlag: '--deepinfra',
  sttService: 'deepinfra',
  envVarKey: 'DEEPINFRA_API_KEY',
  envVarDescription: 'DeepInfra transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3'],
  cliFlag: '--together',
  sttService: 'together',
  envVarKey: 'TOGETHER_API_KEY',
  envVarDescription: 'Together transcription',
})

defineSTTServiceTest({
  models: ['WhisperLargeV3'],
  cliFlag: '--deapi',
  sttService: 'deapi',
  envVarKey: 'DEAPI_API_KEY',
  envVarDescription: 'deAPI transcription',
})

defineSTTServiceTest({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs',
  sttService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs transcription',
})

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})

defineSTTServiceTest({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
})

defineSTTServiceTest({
  models: ['speech-to-text'],
  cliFlag: '--grok',
  sttService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok transcription',
})

defineSTTServiceTest({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
})

defineSTTServiceTest({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev',
  sttService: 'rev',
  envVarKey: 'REVAI_ACCESS_TOKEN',
  envVarDescription: 'Rev transcription',
})

defineSTTServiceTest({
  models: ['stt-async-v4'],
  cliFlag: '--soniox',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
})

defineSTTServiceTest({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
})

defineSTTServiceTest({
  models: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe'],
  cliFlag: '--openai',
  sttService: 'openai-stt',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineSTTServiceTest({
  models: ['gemini-3-flash-preview'],
  cliFlag: '--gemini',
  sttService: 'gemini-stt',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineSTTServiceTest({
  models: ['glm-asr-2512'],
  cliFlag: '--glm',
  sttService: 'glm-stt',
  envVarKey: 'GLM_API_KEY',
  envVarDescription: 'GLM transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineUrlTranscriptServiceTest({
  service: 'supadata',
  model: 'auto',
  cliFlag: '--supadata',
  envVarKey: 'SUPADATA_API_KEY',
  envVarDescription: 'Supadata YouTube transcript retrieval',
})

defineUrlTranscriptServiceTest({
  service: 'scrapecreators',
  model: 'youtube-transcript',
  cliFlag: '--scrapecreators',
  envVarKey: 'SCRAPECREATORS_API_KEY',
  envVarDescription: 'ScrapeCreators YouTube transcript retrieval',
})

test('deapi run manifest records exact estimated and actual STT cost fields', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  const { server, baseUrl, state } = await startDeapiStubServer()
  const configDir = await mkdtemp(join(tmpdir(), 'autoshow-deapi-config-'))
  const configPath = join(configDir, 'autoshow.json')
  await Bun.write(configPath, `${JSON.stringify({
    pricing: { maxCents: 100 }
  }, null, 2)}\n`)

  try {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_EXAMPLE_AUDIO_URL,
      '--deapi',
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

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
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
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('transcribe-elevenlabs-scribe_v2', 'elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  await requireConfiguredEnvVar('ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY is required for ElevenLabs transcription')

  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--elevenlabs',
    'scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${STABLE_EXAMPLE_AUDIO_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step2?: { transcriptionService?: string, transcriptionModel?: string }
  }
  expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
  expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
}, E2E_TEST_TIMEOUT_MS)
