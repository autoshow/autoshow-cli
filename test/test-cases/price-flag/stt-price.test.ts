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
      '--provider',
      `whisper=${model}`,
      '--price'
    ])

    expect(result.exitCode).toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

defineSTTServicePriceTests({
  models: ['universal-3-pro'],
  provider: 'assemblyai',
  sttService: 'assemblyai',
})

defineSTTServicePriceTests({
  models: ['nova-3'],
  provider: 'deepgram',
  sttService: 'deepgram',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  provider: 'deepinfra',
  sttService: 'deepinfra',
})

defineSTTServicePriceTests({
  models: ['openai/whisper-large-v3'],
  provider: 'together',
  sttService: 'together',
})

defineSTTServicePriceTests({
  models: ['scribe_v2'],
  provider: 'elevenlabs',
  sttService: 'elevenlabs',
})

defineSTTServicePriceTests({
  models: ['default'],
  provider: 'gladia',
  sttService: 'gladia',
})

defineSTTServicePriceTests({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  provider: 'groq',
  sttService: 'groq',
})

defineSTTServicePriceTests({
  models: ['speech-to-text'],
  provider: 'grok',
  sttService: 'grok',
})

defineSTTServicePriceTests({
  models: ['voxtral-mini-2602'],
  provider: 'mistral',
  sttService: 'mistral',
})

defineSTTServicePriceTests({
  models: ['machine', 'low_cost'],
  provider: 'rev',
  sttService: 'rev',
})

defineSTTServicePriceTests({
  models: ['stt-async-v4'],
  provider: 'soniox',
  sttService: 'soniox',
})

defineSTTServicePriceTests({
  models: ['standard', 'enhanced'],
  provider: 'speechmatics',
  sttService: 'speechmatics',
})
