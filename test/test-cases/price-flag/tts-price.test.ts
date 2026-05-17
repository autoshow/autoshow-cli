import { expect, test } from 'bun:test'
import {
  GCLOUD_DEFAULT_TTS_VOICES,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS,
  SUPPORTED_GROK_TTS_VOICES,
  SUPPORTED_GROQ_ARABIC_SAUDI_TTS_VOICES,
  SUPPORTED_GROQ_ENGLISH_TTS_VOICES,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_VOICES
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'
import { runCommand, STABLE_LOCAL_AUDIO_PATH, STABLE_TTS_MD_PATH } from '../../test-utils/test-helpers'

const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const OPENAI_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'

const NO_PAID_TTS_ENV = {
  ANTHROPIC_API_KEY: '',
  AUTOSHOW_GCLOUD_BIN: '/usr/bin/false',
  AUTOSHOW_GCLOUD_PROJECT: '',
  AWS_ACCESS_KEY_ID: '',
  AWS_SECRET_ACCESS_KEY: '',
  AWS_SESSION_TOKEN: '',
  DEAPI_API_KEY: '',
  DEEPGRAM_API_KEY: '',
  DEEPGRAM_TTS_VOICE: '',
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  GCLOUD_TTS_LANGUAGE: '',
  GCLOUD_TTS_VOICE: '',
  GEMINI_API_KEY: '',
  GEMINI_TTS_VOICE: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  GOOGLE_CLOUD_PROJECT: '',
  GROK_API_KEY: '',
  HUME_API_KEY: '',
  HUME_BASE_URL: '',
  HUME_TTS_VOICE: '',
  HUME_TTS_VOICE_PROVIDER: '',
  GROQ_API_KEY: '',
  GROQ_TTS_VOICE: '',
  MISTRAL_API_KEY: '',
  MISTRAL_TTS_REF_AUDIO: '',
  MISTRAL_TTS_VOICE: '',
  MINIMAX_API_KEY: '',
  OPENAI_API_KEY: '',
  OPENAI_BASE_URL: '',
  OPENAI_TTS_VOICE: '',
  CARTESIA_API_KEY: '',
  CARTESIA_BASE_URL: '',
  CARTESIA_VERSION: '',
  CARTESIA_TTS_VOICE: '',
  SPEECHIFY_API_KEY: '',
  SPEECHIFY_TTS_VOICE: '',
  XAI_API_KEY: '',
  XAI_TTS_VOICE: ''
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
  cliFlag,
  ttsService,
}: {
  models: readonly string[]
  cliFlag: string
  ttsService: string
}): void => {
  for (const model of models) {
    test(`${ttsService} ${model} --price prints estimate`, async () => {
      const result = await runTtsPriceCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        cliFlag,
        model,
        '--price'
      ])

      expectPriceEstimateForModel(result, model)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

const defineTTSVoicePriceTests = ({
  provider,
  modelFlag,
  model,
  voiceFlag,
  voices,
}: {
  provider: string
  modelFlag: string
  model: string
  voiceFlag: string
  voices: readonly string[]
}): void => {
  for (const voice of voices) {
    test(`${provider} ${model} ${voiceFlag} ${voice} --price prints estimate`, async () => {
      const result = await runTtsPriceCommand([
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        modelFlag,
        model,
        voiceFlag,
        voice,
        '--price'
      ])

      expectPriceEstimateForModel(result, model)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

defineTTSServicePriceTests({
  models: ['gpt-4o-mini-tts'],
  cliFlag: '--openai-tts',
  ttsService: 'openai',
})

defineTTSServicePriceTests({
  models: ['gemini-3.1-flash-tts-preview'],
  cliFlag: '--gemini-tts',
  ttsService: 'gemini',
})

defineTTSServicePriceTests({
  models: ['speech-2.8-turbo', 'speech-2.8-hd'],
  cliFlag: '--minimax-tts',
  ttsService: 'minimax',
})

defineTTSServicePriceTests({
  models: ['eleven_v3'],
  cliFlag: '--elevenlabs-tts',
  ttsService: 'elevenlabs',
})

defineTTSServicePriceTests({
  models: ['canopylabs/orpheus-v1-english', 'canopylabs/orpheus-arabic-saudi'],
  cliFlag: '--groq-tts',
  ttsService: 'groq',
})

defineTTSServicePriceTests({
  models: ['grok-tts'],
  cliFlag: '--grok-tts',
  ttsService: 'grok',
})

defineTTSServicePriceTests({
  models: SUPPORTED_DEEPGRAM_TTS_MODELS,
  cliFlag: '--deepgram-tts',
  ttsService: 'deepgram',
})

defineTTSServicePriceTests({
  models: ['simba-english', 'simba-multilingual'],
  cliFlag: '--speechify-tts',
  ttsService: 'speechify',
})

defineTTSServicePriceTests({
  models: SUPPORTED_HUME_TTS_MODELS,
  cliFlag: '--hume-tts',
  ttsService: 'hume',
})

defineTTSServicePriceTests({
  models: SUPPORTED_CARTESIA_TTS_MODELS,
  cliFlag: '--cartesia-tts',
  ttsService: 'cartesia',
})

defineTTSServicePriceTests({
  models: ['studio', 'chirp3-hd'],
  cliFlag: '--gcloud-tts',
  ttsService: 'gcloud',
})

defineTTSVoicePriceTests({
  provider: 'kitten',
  modelFlag: '--kitten-tts',
  model: 'kitten-tts-mini',
  voiceFlag: '--kitten-voice',
  voices: SUPPORTED_KITTEN_TTS_VOICES,
})

defineTTSVoicePriceTests({
  provider: 'groq',
  modelFlag: '--groq-tts',
  model: 'canopylabs/orpheus-v1-english',
  voiceFlag: '--groq-voice',
  voices: SUPPORTED_GROQ_ENGLISH_TTS_VOICES,
})

defineTTSVoicePriceTests({
  provider: 'groq',
  modelFlag: '--groq-tts',
  model: 'canopylabs/orpheus-arabic-saudi',
  voiceFlag: '--groq-voice',
  voices: SUPPORTED_GROQ_ARABIC_SAUDI_TTS_VOICES,
})

defineTTSVoicePriceTests({
  provider: 'grok',
  modelFlag: '--grok-tts',
  model: 'grok-tts',
  voiceFlag: '--grok-tts-voice',
  voices: SUPPORTED_GROK_TTS_VOICES,
})

for (const model of SUPPORTED_DEEPGRAM_TTS_MODELS) {
  defineTTSVoicePriceTests({
    provider: 'deepgram',
    modelFlag: '--deepgram-tts',
    model,
    voiceFlag: '--deepgram-voice',
    voices: [model],
  })
}

for (const model of SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS) {
  defineTTSVoicePriceTests({
    provider: 'gcloud',
    modelFlag: '--gcloud-tts',
    model,
    voiceFlag: '--gcloud-tts-voice',
    voices: [GCLOUD_DEFAULT_TTS_VOICES[model]],
  })
}

test('gcloud instant custom voice --price works with an existing voice cloning key', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--gcloud-tts',
    'instant-custom-voice',
    '--gcloud-tts-voice-cloning-key',
    'test-key',
    '--price'
  ])

  expectPriceEstimateForModel(result, 'instant-custom-voice')
})

test('mistral --price works without a voice source', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
    MISTRAL_TTS_MODEL,
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
    '--mistral-tts',
    MISTRAL_TTS_MODEL,
    '--mistral-tts-voice',
    'voice_abc123',
    '--mistral-tts-ref-audio',
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
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
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
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
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
    '--deepgram-tts',
    'aura-2-thalia-en',
    '--deepgram-voice',
    'invalid-model',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --deepgram-voice "invalid-model"')
})

test('rejects Arabic Saudi Groq voice with English model before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--groq-tts',
    'canopylabs/orpheus-v1-english',
    '--groq-voice',
    'noura',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --groq-voice "noura" for canopylabs/orpheus-v1-english')
})

test('rejects English Groq voice with Arabic Saudi model before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--groq-tts',
    'canopylabs/orpheus-arabic-saudi',
    '--groq-voice',
    'troy',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --groq-voice "troy" for canopylabs/orpheus-arabic-saudi')
})

test('rejects invalid grok voice override before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--grok-tts',
    'grok-tts',
    '--grok-tts-voice',
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
    '--kitten-tts',
    'kitten-tts-mini',
    '--openai-tts',
    'gpt-4o-mini-tts',
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
    STABLE_LOCAL_AUDIO_PATH,
    '--openai',
    'gpt-5.4',
    '--groq',
    'openai/gpt-oss-20b',
    '--kitten-tts',
    'kitten-tts-mini',
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--price'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).not.toContain('TTS estimate omitted')
  expect(output).not.toContain('speech-kitten-kitten-tts-mini.wav')
  expect(output).not.toContain('speech-openai-gpt-4o-mini-tts.wav')
})
