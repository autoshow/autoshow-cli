import { expect, test } from 'bun:test'
import { defineSTTServicePriceTests } from '../../test-utils/define-stt-service-test'
import { runCommand, STABLE_EXAMPLE_AUDIO_URL } from '../../test-utils/test-helpers'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'

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
