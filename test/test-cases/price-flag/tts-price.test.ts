import { expect, test } from 'bun:test'
import {
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_GROK_TTS_VOICES,
  SUPPORTED_GROQ_ENGLISH_TTS_VOICES,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_VOICES
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'
import { runCommand, STABLE_EXAMPLE_AUDIO_URL, STABLE_TTS_MD_PATH } from '../../test-utils/test-helpers'

const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const OPENAI_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const REMOVED_GROQ_TTS_MODEL = ['canopylabs/orpheus', 'arabic-saudi'].join('-')
const REMOVED_GROQ_TTS_VOICE = ['no', 'ura'].join('')

const NO_PAID_TTS_ENV = {
  ANTHROPIC_API_KEY: '',
  DEEPGRAM_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  GEMINI_API_KEY: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  GOOGLE_CLOUD_PROJECT: '',
  GROK_API_KEY: '',
  HUME_API_KEY: '',
  GROQ_API_KEY: '',
  MISTRAL_API_KEY: '',
  MINIMAX_API_KEY: '',
  OPENAI_API_KEY: '',
  CARTESIA_API_KEY: '',
  SPEECHIFY_API_KEY: '',
  XAI_API_KEY: ''
} as const

const runTtsPriceCommand = async (
  args: string[],
  env: Record<string, string | undefined> = {}
) => await runCommand(args, {
  env: {
    ...NO_PAID_TTS_ENV,
    ...env
  }
})

const expectPriceEstimateForModel = (
  result: Awaited<ReturnType<typeof runCommand>>,
  model: string
): void => {
  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain(model)
}

const defineTTSServicePriceTests = ({
  models,
  provider,
  ttsService,
}: {
  models: readonly string[]
  provider: string
  ttsService: string
}): void => {
  for (const model of models) {
    test(`${ttsService} ${model} --price prints estimate`, async () => {
      const result = await runTtsPriceCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        '--provider',
        `${provider}=${model}`,
        '--price'
      ])

      expectPriceEstimateForModel(result, model)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

const defineTTSVoicePriceTests = ({
  provider,
  model,
  voices,
}: {
  provider: string
  model: string
  voices: readonly string[]
}): void => {
  for (const voice of voices) {
    test(`${provider} ${model} --tts-voice ${voice} --price prints estimate`, async () => {
      const result = await runTtsPriceCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        '--provider',
        `${provider}=${model}`,
        '--tts-voice',
        voice,
        '--price'
      ])

      expectPriceEstimateForModel(result, model)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

defineTTSServicePriceTests({
  models: ['gpt-4o-mini-tts'],
  provider: 'openai',
  ttsService: 'openai',
})

defineTTSServicePriceTests({
  models: ['gemini-3.1-flash-tts-preview'],
  provider: 'gemini',
  ttsService: 'gemini',
})

defineTTSServicePriceTests({
  models: ['speech-2.8-turbo', 'speech-2.8-hd'],
  provider: 'minimax',
  ttsService: 'minimax',
})

defineTTSServicePriceTests({
  models: ['eleven_v3'],
  provider: 'elevenlabs',
  ttsService: 'elevenlabs',
})

defineTTSServicePriceTests({
  models: ['canopylabs/orpheus-v1-english'],
  provider: 'groq',
  ttsService: 'groq',
})

defineTTSServicePriceTests({
  models: ['grok-tts'],
  provider: 'grok',
  ttsService: 'grok',
})

defineTTSServicePriceTests({
  models: SUPPORTED_DEEPGRAM_TTS_MODELS,
  provider: 'deepgram',
  ttsService: 'deepgram',
})

defineTTSServicePriceTests({
  models: ['simba-english', 'simba-multilingual'],
  provider: 'speechify',
  ttsService: 'speechify',
})

defineTTSServicePriceTests({
  models: SUPPORTED_HUME_TTS_MODELS,
  provider: 'hume',
  ttsService: 'hume',
})

defineTTSServicePriceTests({
  models: SUPPORTED_CARTESIA_TTS_MODELS,
  provider: 'cartesia',
  ttsService: 'cartesia',
})

defineTTSVoicePriceTests({
  provider: 'kitten',
  model: 'kitten-tts-mini',
  voices: SUPPORTED_KITTEN_TTS_VOICES,
})

defineTTSVoicePriceTests({
  provider: 'groq',
  model: 'canopylabs/orpheus-v1-english',
  voices: SUPPORTED_GROQ_ENGLISH_TTS_VOICES,
})

defineTTSVoicePriceTests({
  provider: 'grok',
  model: 'grok-tts',
  voices: SUPPORTED_GROK_TTS_VOICES,
})

for (const model of SUPPORTED_DEEPGRAM_TTS_MODELS) {
  defineTTSVoicePriceTests({
    provider: 'deepgram',
    model,
    voices: [model],
  })
}

test('mistral --price works without a voice source', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${MISTRAL_TTS_MODEL}`,
    '--price'
  ])

  expectPriceEstimateForModel(result, MISTRAL_TTS_MODEL)
  expect(`${result.stdout}\n${result.stderr}`).toContain('speech')
})

test('mistral rejects voice and reference audio together before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${MISTRAL_TTS_MODEL}`,
    '--tts-voice',
    'voice_abc123',
    '--tts-ref-audio',
    MISTRAL_REF_AUDIO_PATH,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
})

test('openai custom voice --price includes setup estimate without an API key', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'openai=gpt-4o-mini-tts',
    '--tts-ref-audio',
    OPENAI_REF_AUDIO_PATH,
    '--openai-tts-consent-id',
    'cons_123',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gpt-4o-mini-tts')
  expect(output).toContain('setup')
  expect(output).toContain('speech')
})

test('openai custom voice rejects missing consent source before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'openai=gpt-4o-mini-tts',
    '--tts-ref-audio',
    OPENAI_REF_AUDIO_PATH,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
})

test('rejects invalid deepgram voice override before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'deepgram=aura-2-thalia-en',
    '--tts-voice',
    'invalid-model',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --deepgram-voice "invalid-model"')
})

test('rejects removed Groq voice before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'groq=canopylabs/orpheus-v1-english',
    '--tts-voice',
    REMOVED_GROQ_TTS_VOICE,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain(`Invalid --groq-voice "${REMOVED_GROQ_TTS_VOICE}"`)
})

test('rejects removed Groq model before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `groq=${REMOVED_GROQ_TTS_MODEL}`,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain(`Invalid --groq-tts model "${REMOVED_GROQ_TTS_MODEL}"`)
})

test('rejects invalid grok voice override before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'grok=grok-tts',
    '--tts-voice',
    'invalid-voice',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --grok-tts-voice "invalid-voice"')
})

test('multi-provider --price prints both TTS targets and renamed output files', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'kitten=kitten-tts-mini',
    '--provider',
    'openai=gpt-4o-mini-tts',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('kitten')
  expect(output).toContain('kitten-tts-mini')
  expect(output).toContain('openai')
  expect(output).toContain('gpt-4o-mini-tts')
  expect(output).toContain('speech-kitten-kitten-tts-mini.wav')
  expect(output).toContain('speech-openai-gpt-4o-mini-tts.wav')
})

test('write --price omits TTS estimates when multiple LLM providers are selected', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_EXAMPLE_AUDIO_URL,
    '--llm',
    'openai=gpt-5.4',
    '--llm',
    'groq=openai/gpt-oss-20b',
    '--tts',
    'kitten=kitten-tts-mini',
    '--tts',
    'openai=gpt-4o-mini-tts',
    '--price'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).not.toContain('TTS estimate omitted')
  expect(output).not.toContain('speech-kitten-kitten-tts-mini.wav')
  expect(output).not.toContain('speech-openai-gpt-4o-mini-tts.wav')
})
