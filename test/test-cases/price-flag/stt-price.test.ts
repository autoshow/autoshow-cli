import { expect, test } from 'bun:test'
import { defineSTTServicePriceTests } from '../../test-utils/define-stt-service-test'
import { runCommand, STABLE_EXAMPLE_AUDIO_URL } from '../../test-utils/test-helpers'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'
import { resolveDeapiTranscriptionPrice } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deapi/deapi-pricing'

for (const model of ['tiny', 'base', 'small', 'medium', 'large-v3-turbo'] as const) {
  test(`whisper model ${model} --price prints estimate`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_EXAMPLE_AUDIO_URL,
      '--whisper',
      model,
      '--price'
    ])

    expect(result.exitCode).toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

defineSTTServicePriceTests({
  models: ['universal-3-pro'],
  cliFlag: '--assemblyai',
  sttService: 'assemblyai',
})

defineSTTServicePriceTests({
  models: ['nova-3'],
  cliFlag: '--deepgram',
  sttService: 'deepgram',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  cliFlag: '--deepinfra',
  sttService: 'deepinfra',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3'],
  cliFlag: '--together',
  sttService: 'together',
})

defineSTTServicePriceTests({
  models: ['WhisperLargeV3'],
  cliFlag: '--deapi',
  sttService: 'deapi',
})

defineSTTServicePriceTests({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs',
  sttService: 'elevenlabs',
})

defineSTTServicePriceTests({
  models: ['default'],
  cliFlag: '--gladia',
  sttService: 'gladia',
})

defineSTTServicePriceTests({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq',
  sttService: 'groq',
})

defineSTTServicePriceTests({
  models: ['speech-to-text'],
  cliFlag: '--grok',
  sttService: 'grok',
})

defineSTTServicePriceTests({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral',
  sttService: 'mistral',
})

defineSTTServicePriceTests({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev',
  sttService: 'rev',
})

defineSTTServicePriceTests({
  models: ['stt-async-v4'],
  cliFlag: '--soniox',
  sttService: 'soniox',
})

defineSTTServicePriceTests({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics',
  sttService: 'speechmatics',
})

test('aws standard --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--aws',
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
    STABLE_EXAMPLE_AUDIO_URL,
    '--gcloud',
    'chirp_3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('gcloud')
  expect(`${result.stdout}\n${result.stderr}`).toContain('chirp_3')
}, E2E_TEST_TIMEOUT_MS)

test('deapi exact pricing uses duration payload for local audio', async () => {
  const originalFetch = globalThis.fetch
  const originalApiKey = process.env['DEAPI_API_KEY']
  const originalBaseUrl = process.env['DEAPI_BASE_URL']
  const requests: Array<{ url: string, init: RequestInit }> = []

  process.env['DEAPI_API_KEY'] = 'test-key'
  process.env['DEAPI_BASE_URL'] = 'https://deapi.test'
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      init: init ?? {}
    })

    return new Response(JSON.stringify({ data: { price: 0.0175 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }) as typeof fetch

  try {
    const price = await resolveDeapiTranscriptionPrice({
      model: 'WhisperLargeV3',
      durationSeconds: 12.34
    })

    expect(price).toEqual({
      totalCost: 1.7500000000000002,
      source: 'provider_quote',
      mode: 'duration',
      estimateType: 'exact'
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://deapi.test/api/v1/client/transcribe/price-calculation')
    expect(requests[0]?.init.method).toBe('POST')
    expect(requests[0]?.init.headers).toEqual({
      accept: 'application/json',
      authorization: 'Bearer test-key'
    })

    const body = requests[0]?.init.body
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('include_ts')).toBe('true')
    expect(form.get('model')).toBe('WhisperLargeV3')
    expect(form.get('duration_seconds')).toBe('12.34')
    expect(form.has('source_url')).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
    if (originalApiKey === undefined) {
      delete process.env['DEAPI_API_KEY']
    } else {
      process.env['DEAPI_API_KEY'] = originalApiKey
    }
    if (originalBaseUrl === undefined) {
      delete process.env['DEAPI_BASE_URL']
    } else {
      process.env['DEAPI_BASE_URL'] = originalBaseUrl
    }
  }
}, E2E_TEST_TIMEOUT_MS)
