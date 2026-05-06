import { createServer, type IncomingMessage } from 'node:http'
import { expect, test } from 'bun:test'
import { defineSTTServicePriceTests } from '../../test-utils/define-stt-service-test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'

const readBodyText = async (request: IncomingMessage): Promise<string> => {
  let body = ''
  for await (const chunk of request) {
    body += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  }
  return body
}

const isAddressInUseError = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'EADDRINUSE'
}

const listenOnPort = async (server: ReturnType<typeof createServer>, port: number): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      server.off('error', onError)
      server.off('listening', onListening)
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onListening = () => {
      cleanup()
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

const startDeapiStubServer = async (): Promise<{
  server: ReturnType<typeof createServer>
  baseUrl: string
  state: { priceBodies: string[] }
}> => {
  const state = { priceBodies: [] as string[] }

  const createStubServer = () => createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/api/v1/client/transcribe/price-calculation') {
      state.priceBodies.push(await readBodyText(req))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: { price: 0.0175 } }))
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: `${req.method} ${url.pathname} not stubbed` }))
  })

  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = createStubServer()
    const port = 32000 + Math.floor(Math.random() * 20000)
    try {
      await listenOnPort(server, port)
      return { server, baseUrl: `http://127.0.0.1:${port}`, state }
    } catch (error) {
      lastError = error
      if (!isAddressInUseError(error)) {
        throw error
      }
    }
  }

  throw new Error(`Failed to start deAPI stub server after repeated port attempts: ${String(lastError)}`)
}

const stopServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

for (const model of ['tiny', 'base', 'small', 'medium', 'large-v3-turbo'] as const) {
  test(`whisper model ${model} --price prints estimate`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_LOCAL_AUDIO_PATH,
      '--whisper-stt',
      model,
      '--price'
    ])

    expect(result.exitCode).toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

defineSTTServicePriceTests({
  models: ['universal-3-pro'],
  cliFlag: '--assemblyai-stt',
  sttService: 'assemblyai',
})

defineSTTServicePriceTests({
  models: ['nova-3'],
  cliFlag: '--deepgram-stt',
  sttService: 'deepgram',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  cliFlag: '--deepinfra-stt',
  sttService: 'deepinfra',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3'],
  cliFlag: '--together-stt',
  sttService: 'together',
})

defineSTTServicePriceTests({
  models: ['WhisperLargeV3'],
  cliFlag: '--deapi-stt',
  sttService: 'deapi',
})

defineSTTServicePriceTests({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs-stt',
  sttService: 'elevenlabs',
})

defineSTTServicePriceTests({
  models: ['default'],
  cliFlag: '--gladia-stt',
  sttService: 'gladia',
})

defineSTTServicePriceTests({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq-stt',
  sttService: 'groq',
})

defineSTTServicePriceTests({
  models: ['speech-to-text'],
  cliFlag: '--grok-stt',
  sttService: 'grok',
})

defineSTTServicePriceTests({
  models: ['whisper-large-v3-turbo', 'whisper'],
  cliFlag: '--cloudflare-stt',
  sttService: 'cloudflare',
})

defineSTTServicePriceTests({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral-stt',
  sttService: 'mistral',
})

defineSTTServicePriceTests({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev-stt',
  sttService: 'rev',
})

defineSTTServicePriceTests({
  models: ['stt-async-v4'],
  cliFlag: '--soniox-stt',
  sttService: 'soniox',
})

defineSTTServicePriceTests({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics-stt',
  sttService: 'speechmatics',
})

test('aws standard --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    '--aws-stt',
    'standard',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('aws')
  expect(`${result.stdout}\n${result.stderr}`).toContain('standard')
}, E2E_TEST_TIMEOUT_MS)

test('gcloud chirp_3 --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    '--gcloud-stt',
    'chirp_3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('gcloud')
  expect(`${result.stdout}\n${result.stderr}`).toContain('chirp_3')
}, E2E_TEST_TIMEOUT_MS)

test('deapi --price uses the exact pricing endpoint for local audio', async () => {
  let stub: Awaited<ReturnType<typeof startDeapiStubServer>>
  try {
    stub = await startDeapiStubServer()
  } catch (error) {
    if (String(error).includes('Failed to start deAPI stub server after repeated port attempts')) {
      console.warn(`Skipping deAPI exact pricing endpoint assertion: ${String(error)}`)
      return
    }
    throw error
  }

  const { server, baseUrl, state } = stub

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
}, E2E_TEST_TIMEOUT_MS)
